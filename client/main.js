// 달무리 온라인, the browser side: draws the world the server describes, with PixSpell, and sends what you do.
import { PIXSPELL } from '/config.js'
import { MAPS, walkable } from '/shared/maps.js'
import { JOBS, MONSTERS, COLORS, DIRS, STEP_MS, TILE } from '/shared/data.js'

const { spell } = await import(PIXSPELL)
const SWATCH = { red: '#d0483c', blue: '#3c6fd8', gold: '#e2b23a', purple: '#8a52d4', leather: '#8a5a32' }

const VW = 20, VH = 14 // view in tiles
const $ = (s) => document.querySelector(s)
const canvas = $('#game'), ctx = canvas.getContext('2d')
let Z = 3 // pixels per art pixel, from the window size
const FONT = "'DungGeunMo', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"

// ------------------------------------------------------------------ looks (made once, kept)
const memo = new Map()
const once = (k, f) => (memo.has(k) ? memo.get(k) : (memo.set(k, f()), memo.get(k)))
const key = (spec) => JSON.stringify(spec)
const specOf = (e) => (e.kind === 'p' ? { ...JOBS[e.job].spec, ...(COLORS[e.color] ? { A: COLORS[e.color] } : {}) } : e.kind === 'm' ? MONSTERS[e.type].spec : e.spec)
const walkOf = (spec, dir) => once('w' + key(spec) + dir, () => spell.walk(spec, dir))
const idleOf = (spec) => once('i' + key(spec), () => spell.char.frames(spec))
const fxOf = (name, opts = {}) => once('x' + name + key(opts), () => spell.fx(name, opts))
const tileOf = (id) => once('t' + id, () => spell(id))
const framesOf = (id) => once('f' + id, () => spell.frames(id))
/** An effect's frames turned to fly in a direction (they're drawn flying right). */
const turnedFx = (name, opts, dir) => once('r' + name + key(opts) + dir, () => fxOf(name, opts).map((f) => (dir === 'right' ? f : f.rotate({ down: 90, left: 180, up: 270 }[dir]))))

/** The ground of a map, drawn once onto a canvas: base tiles, autotiled roads and water, houses. */
function buildMap(def) {
  return once('map' + def.id, () => {
    const c = document.createElement('canvas')
    c.width = def.w * TILE; c.height = def.h * TILE
    const g = c.getContext('2d')
    const put = (img, x, y) => g.drawImage(img.canvas, x, y)
    for (let y = 0; y < def.h; y++) for (let x = 0; x < def.w; x++) put(tileOf(def.base), x * TILE, y * TILE)
    for (const l of def.layers) put(spell.autotile(l.tile, null).draw(l.cells), 0, 0)
    for (const h of def.houses) {
      for (let y = h.y; y < h.y + h.h; y++) for (let x = h.x; x < h.x + h.w; x++) put(tileOf(y < h.y + 2 ? h.roof : h.wall), x * TILE, y * TILE)
      put(tileOf('door'), h.door * TILE, (h.y + 3) * TILE)
      for (const wx of [h.x + 1, h.x + h.w - 2]) if (wx !== h.door) put(tileOf('window-lit'), wx * TILE + 3, (h.y + 2) * TILE + 2)
    }
    return c
  })
}

// ------------------------------------------------------------------ state
const S = { me: null, map: null, ents: new Map(), stats: null, fx: [], floaters: [], bubbles: new Map(), cam: [0, 0], atkAt: 0, skillAt: 0, lastStep: 0, keys: [], dialog: null }
const feet = (x, y) => [x * TILE + 8, y * TILE + 14]
function ent(id) { return S.ents.get(id) }
function place(e, x, y, now, snap) {
  if (e.x === x && e.y === y && e.px != null) return
  const [tx, ty] = feet(x, y)
  const far = e.px == null || Math.abs(x - e.x) + Math.abs(y - e.y) > 2
  if (snap || far) { e.px = tx; e.py = ty; e.from = null } else { e.from = [e.px, e.py]; e.to = [tx, ty]; e.t0 = now }
  e.x = x; e.y = y
}
function motion(e, now) {
  if (!e.from) return false
  const k = Math.min(1, (now - e.t0) / STEP_MS)
  e.px = e.from[0] + (e.to[0] - e.from[0]) * k; e.py = e.from[1] + (e.to[1] - e.from[1]) * k
  if (k >= 1) e.from = null
  return true
}

// ------------------------------------------------------------------ sound
let unlocked = false
const sfx = (name, opts, volume = 0.45) => { if (unlocked) try { spell.sfx(name, opts).play({ volume }) } catch {} }
function music(name) { if (unlocked && name) spell.music.play(name, { fade: 0.8 }) }
spell.volume('music', 0.35)
addEventListener('pointerdown', () => { if (!unlocked) { unlocked = true; if (S.map) music(MAPS[S.map].music) } }, { once: false })

// ------------------------------------------------------------------ network
let ws = null
const send = (msg) => { if (ws?.readyState === 1) ws.send(JSON.stringify(msg)) }
function connect(join) {
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`)
  ws.onopen = () => send({ t: 'join', ...join })
  ws.onmessage = (ev) => onMessage(JSON.parse(ev.data))
  ws.onclose = () => { if (S.me) $('#lost').classList.remove('hidden'); else loginError('서버에 연결할 수 없습니다.') }
}

function enterMap(mapId, x, y) {
  S.map = mapId
  S.ents.clear()
  S.fx = []; S.floaters = []; S.bubbles.clear()
  const me = { id: S.me, kind: 'p', name: S.name, job: S.job, color: S.color, dir: 'down' }
  S.ents.set(S.me, me)
  place(me, x, y, performance.now(), true)
  buildMap(MAPS[mapId])
  music(MAPS[mapId].music)
  log(`${MAPS[mapId].name}에 들어왔습니다.`, 'sys')
}

function onMessage(m) {
  const now = performance.now()
  switch (m.t) {
    case 'error': ws.close(); S.me = null; return loginError(m.text)
    case 'welcome':
      localStorage.setItem(`dalmuri.token.${m.name}`, m.token)
      localStorage.setItem('dalmuri.last', m.name)
      Object.assign(S, { me: m.id, name: m.name, job: m.job, color: m.color })
      $('#login').classList.add('hidden'); $('#frame').classList.remove('hidden')
      fit()
      return enterMap(m.map, m.x, m.y)
    case 'map': return enterMap(m.map, m.x, m.y)
    case 'warp': { const me = ent(S.me); if (me) { place(me, m.x, m.y, now, true); if (m.dir) me.dir = m.dir } return }
    case 's': {
      for (const a of m.add ?? []) if (a.id !== S.me) S.ents.set(a.id, { ...a, dir: 'down' })
        else Object.assign(ent(S.me) ?? {}, { color: a.color })
      for (const id of m.del ?? []) if (id !== S.me) S.ents.delete(id)
      for (const [id, x, y, dir, hp, dead] of m.e) {
        const e = ent(id)
        if (!e) continue
        e.hp = hp; e.dead = !!dead
        if (id === S.me) { // the server has the last word, but not while our own step is still on its way
          if ((e.x !== x || e.y !== y) && now - S.lastStep > 450) place(e, x, y, now, Math.abs(e.x - x) + Math.abs(e.y - y) > 1)
          continue
        }
        e.dir = dir
        place(e, x, y, now)
      }
      return
    }
    case 'me': S.stats = m; return
    case 'chat': {
      log(`<b>${esc(m.name)}</b> ${esc(m.text)}`)
      S.bubbles.set(m.id, { text: m.text, t0: now })
      if (m.id !== S.me) sfx('text', undefined, 0.2)
      return
    }
    case 'sys': log(esc(m.text), m.big ? 'big' : 'sys'); if (m.big) sfx('fanfare', undefined, 0.4); return
    case 'say': {
      S.dialog = { name: m.name, text: m.text, t0: now }
      $('#dialog').innerHTML = `<b>${esc(m.name)}</b>${esc(m.text)}`
      $('#dialog').classList.remove('hidden')
      return sfx('text', undefined, 0.3)
    }
    case 'fx': return effect(m, now)
  }
}

function effect(m, now) {
  const e = ent(m.id), t = m.to && ent(m.to)
  const me = ent(S.me)
  const near = e && me && Math.abs(e.x - me.x) < VW && Math.abs(e.y - me.y) < VH
  const vol = e?.id === S.me || t?.id === S.me ? 0.5 : 0.18
  switch (m.k) {
    case 'atk':
      if (!e) return
      e.atkAt = now; e.dir = m.dir ?? e.dir
      if (e.kind === 'p') sfx(spell.action.styleOf(specOf(e)), undefined, vol)
      if (m.ranged && t) projectile(e, t, e.job === 'mage' ? 'orb' : 'arrow', now, e.job === 'mage' ? { element: 'fire', size: 16 } : { size: 20 })
      return
    case 'hit':
      if (!e) return
      e.hitAt = now
      S.floaters.push({ text: String(m.n), color: e.id === S.me ? '#ff6b5a' : m.crit ? '#ffd36a' : '#ffffff', big: m.crit, x: e.px, y: e.py - 26, t0: now })
      S.fx.push({ frames: fxOf(e.kind === 'p' ? 'claw' : 'impact', { size: 20, ...(m.el ? { element: m.el } : {}) }), x: e.px, y: e.py - 8, t0: now })
      if (near) sfx(m.crit ? 'crit' : e.id === S.me ? 'hurt' : 'hit', undefined, vol)
      return
    case 'die':
      if (!e) return
      S.fx.push({ frames: fxOf('poof'), x: e.px, y: e.py - 8, t0: now })
      if (near) sfx(e.kind === 'p' ? 'lose' : 'death', undefined, vol)
      return
    case 'lvl':
      if (!e) return
      S.fx.push({ frames: fxOf('sparkle-burst', { element: 'holy' }), x: e.px, y: e.py - 10, t0: now }, { frames: fxOf('aura', { element: 'holy' }), x: e.px, y: e.py - 10, t0: now + 150 })
      S.floaters.push({ text: 'LEVEL UP!', color: '#ffd36a', big: true, x: e.px, y: e.py - 34, t0: now })
      if (e.id === S.me) sfx('levelup', undefined, 0.5)
      return
    case 'heal':
      if (!e) return
      S.fx.push({ frames: fxOf('heal'), x: e.px, y: e.py - 10, t0: now })
      if (m.n) S.floaters.push({ text: `+${m.n}`, color: '#7dff8a', x: e.px, y: e.py - 26, t0: now })
      if (near) sfx('heal', undefined, vol)
      return
    case 'skill':
      if (!e) return
      e.atkAt = now
      if (m.skill === 'spin') { S.fx.push({ frames: fxOf('whirlwind', { size: 48 }), x: e.px, y: e.py - 8, t0: now }); sfx('dash', undefined, vol) }
      if (m.skill === 'bolt') sfx('fire', undefined, vol)
      if (m.skill === 'heal') sfx('cast', undefined, vol)
      if (m.skill === 'volley') sfx('shoot', undefined, vol)
      return
    case 'shot': if (e && t) projectile(e, t, 'arrow', now + m.i * 120, { size: 20 }); return
    case 'bolt': {
      if (!e) return
      const [dx, dy] = DIRS[m.dir]
      const to = t ?? { px: e.px + dx * 6 * TILE, py: e.py + dy * 6 * TILE }
      projectile(e, to, 'energy-bolt', now, { element: m.el ?? 'fire', size: 24 })
    }
  }
}
function projectile(from, to, name, t0, opts = {}) {
  const dx = to.px - from.px, dy = to.py - from.py
  const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
  S.fx.push({ frames: turnedFx(name, opts, dir), x: from.px, y: from.py - 10, x2: to.px, y2: to.py - 10, t0, dur: Math.max(120, Math.hypot(dx, dy) * 2.2), loop: true })
}

// ------------------------------------------------------------------ input
const held = new Set()
const KEYDIR = { arrowup: 'up', arrowdown: 'down', arrowleft: 'left', arrowright: 'right', w: 'up', s: 'down', a: 'left', d: 'right' }
addEventListener('keydown', (e) => {
  if (!S.me) return
  const k = e.key.toLowerCase()
  const typing = document.activeElement === $('#say')
  if (typing) {
    if (k === 'enter') { const v = $('#say').value.trim(); if (v) send({ t: 'chat', text: v }); $('#say').value = ''; $('#say').blur() }
    if (k === 'escape') $('#say').blur()
    return
  }
  if (!unlocked) { unlocked = true; music(MAPS[S.map]?.music) }
  if (k === 'enter') { e.preventDefault(); return $('#say').focus() }
  if (KEYDIR[k]) { e.preventDefault(); held.add(KEYDIR[k]); S.keys = [...held] }
  if (k === ' ' || k === 'control') { e.preventDefault(); act() }
  if (k === '1' || k === 'q') skill()
})
addEventListener('keyup', (e) => { const d = KEYDIR[e.key.toLowerCase()]; if (d) { held.delete(d); S.keys = [...held] } })
addEventListener('blur', () => { held.clear(); S.keys = [] })
for (const b of document.querySelectorAll('#dpad button')) {
  const d = b.dataset.dir
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); unlocked = true; held.add(d); S.keys = [...held]; S.tap = d }) // a quick tap still takes one step
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => { held.delete(d); S.keys = [...held] })
}
$('#b-act').addEventListener('pointerdown', (e) => { e.preventDefault(); act() })
$('#b-skill').addEventListener('pointerdown', (e) => { e.preventDefault(); skill() })

function facingNpc() {
  const me = ent(S.me), [dx, dy] = DIRS[me.dir]
  return MAPS[S.map].npcs.find((n) => n.x === me.x + dx && n.y === me.y + dy)
}
function act() {
  if (!S.map || ent(S.me)?.dead) return
  if (facingNpc()) return send({ t: 'talk' })
  const now = performance.now()
  if (now - S.atkAt < JOBS[S.job].cooldown) return
  S.atkAt = now
  send({ t: 'attack' })
}
function skill() {
  const now = performance.now(), s = JOBS[S.job].skill
  if (!S.map || ent(S.me)?.dead || now - S.skillAt < s.cooldown) return
  if (S.stats && S.stats.mp < s.mp) return log('마력이 모자랍니다.', 'sys')
  S.skillAt = now
  send({ t: 'skill' })
}
function walk(now) {
  const me = ent(S.me)
  if (!me || me.dead || (!S.keys.length && !S.tap) || now - S.lastStep < STEP_MS) return
  const dir = S.keys[S.keys.length - 1] ?? S.tap, [dx, dy] = DIRS[dir], x = me.x + dx, y = me.y + dy
  S.tap = null
  const def = MAPS[S.map]
  const blocked = !walkable(def, x, y) || [...S.ents.values()].some((e) => e.kind === 'm' && !e.dead && e.x === x && e.y === y)
  if (me.dir !== dir) { me.dir = dir; send({ t: 'face', dir }) }
  if (blocked) { S.lastStep = now - STEP_MS + 120; return }
  S.lastStep = now
  place(me, x, y, now)
  send({ t: 'move', dir })
  if (S.dialog) { S.dialog = null; $('#dialog').classList.add('hidden') }
}

// ------------------------------------------------------------------ drawing
const draw = (img, x, y) => ctx.drawImage(img.canvas ?? img, Math.round(x * Z), Math.round(y * Z), img.w * Z, img.h * Z)
function textAt(s, x, y, { color = '#fff', size = 11, align = 'center', outline = '#000' } = {}) {
  ctx.font = `${Math.round(size * Z / 3 + 4)}px ${FONT}`
  ctx.textAlign = align; ctx.textBaseline = 'middle'
  ctx.lineWidth = Math.max(2, Z); ctx.strokeStyle = outline; ctx.lineJoin = 'round'
  ctx.strokeText(s, x * Z, y * Z)
  ctx.fillStyle = color; ctx.fillText(s, x * Z, y * Z)
}
function actorFrame(e, spec, now) {
  const moving = motion(e, now)
  if (e.kind === 'p' && !moving && e.dir === 'down') { const f = idleOf(spec); return [f, f[Math.floor(now / 400) % f.length]] }
  const f = walkOf(spec, e.dir ?? 'down')
  return [f, moving ? f[Math.floor(now / (STEP_MS / 2)) % f.length] : e.kind === 'm' ? f[Math.floor(now / 500) % f.length] : f[0]]
}

function render(now) {
  const def = MAPS[S.map], me = ent(S.me)
  if (!def || !me) return
  motion(me, now)
  const camX = Math.round(Math.max(0, Math.min(def.w * TILE - VW * TILE, me.px - (VW * TILE) / 2)))
  const camY = Math.round(Math.max(0, Math.min(def.h * TILE - VH * TILE, me.py - 8 - (VH * TILE) / 2)))
  S.cam = [camX, camY]
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(buildMap(def), camX, camY, VW * TILE, VH * TILE, 0, 0, VW * TILE * Z, VH * TILE * Z)
  // everything that stands, sorted so the lower one is in front
  const list = []
  const inView = (x, y) => x > camX - 32 && x < camX + VW * TILE + 32 && y > camY - 16 && y < camY + VH * TILE + 40
  for (const p of def.props) { const x = p.x * TILE, y = p.y * TILE; if (inView(x, y)) list.push([y + 15, () => { const f = framesOf(p.id); draw(f[Math.floor(now / 250) % f.length], x - camX, y - camY) }]) }
  for (const n of def.npcs) {
    const [fx, fy] = feet(n.x, n.y)
    if (!inView(fx, fy)) continue
    list.push([fy, () => {
      const f = n.dir === 'down' ? idleOf(n.spec) : walkOf(n.spec, n.dir)
      const img = n.dir === 'down' ? f[Math.floor(now / 400) % f.length] : f[0]
      draw(img, fx - camX - f.origin[0], fy - camY - f.origin[1])
      textAt(n.name, fx - camX, fy - camY + 6, { color: '#ffd36a', size: 9 })
    }])
  }
  for (const e of S.ents.values()) {
    if (e.px == null) continue
    list.push([e.py + (e.id === S.me ? 0.1 : 0), () => drawActor(e, now, camX, camY)])
  }
  list.sort((a, b) => a[0] - b[0]).forEach(([, f]) => f())
  // effects, numbers, speech
  S.fx = S.fx.filter((f) => {
    if (now < f.t0) return true
    const t = now - f.t0, frames = f.frames, fps = frames.fps ?? 14
    let x = f.x, y = f.y
    if (f.dur) { const k = Math.min(1, t / f.dur); x = f.x + (f.x2 - f.x) * k; y = f.y + (f.y2 - f.y) * k; if (k >= 1) { S.fx.push({ frames: fxOf('impact', { size: 20 }), x: f.x2, y: f.y2, t0: now }); return false } }
    const i = Math.floor((t / 1000) * fps)
    if (!f.loop && i >= frames.length) return false
    const img = frames[f.loop ? i % frames.length : i]
    draw(img, x - camX - img.w / 2, y - camY - img.h / 2)
    return true
  })
  S.floaters = S.floaters.filter((f) => {
    const t = (now - f.t0) / 1000
    if (t > 1) return false
    ctx.globalAlpha = Math.min(1, 2 - t * 2)
    textAt(f.text, f.x - camX, f.y - camY - t * 14, { color: f.color, size: f.big ? 14 : 11 })
    ctx.globalAlpha = 1
    return true
  })
  for (const [id, b] of S.bubbles) {
    const e = ent(id)
    if (!e || now - b.t0 > 4500) { S.bubbles.delete(id); continue }
    bubble(b.text, e.px - camX, e.py - camY - (e.kind === 'p' ? 30 : 24))
  }
  hud(def, now)
}

function drawActor(e, now, camX, camY) {
  const spec = specOf(e)
  if (e.dead && e.kind === 'p') ctx.globalAlpha = 0.45
  const [frames, img] = actorFrame(e, spec, now)
  let ox = 0, oy = 0
  if (e.atkAt && now - e.atkAt < 160) { const [dx, dy] = DIRS[e.dir ?? 'down']; const k = Math.sin(((now - e.atkAt) / 160) * Math.PI) * 4; ox = dx * k; oy = dy * k } // a lunge
  if (e.hitAt && now - e.hitAt < 120) ox += Math.sin(now / 15) * 2
  draw(img, e.px - camX - frames.origin[0] + ox, e.py - camY - frames.origin[1] + oy)
  ctx.globalAlpha = 1
  const x = e.px - camX, y = e.py - camY
  if (e.kind === 'p') textAt(e.name, x, y + 6, { color: e.id === S.me ? '#9be06a' : '#ffffff', size: 9 })
  if (e.kind === 'm' && e.hp < 100) {
    const w = 18
    ctx.fillStyle = '#000'; ctx.fillRect((x - w / 2) * Z, (y + 3) * Z, w * Z, 2 * Z)
    ctx.fillStyle = MONSTERS[e.type].boss ? '#ff4fd8' : '#ff5a4a'; ctx.fillRect((x - w / 2) * Z, (y + 3) * Z, (w * e.hp / 100) * Z, 2 * Z)
  }
  if (e.kind === 'm' && (MONSTERS[e.type].boss || e.hp < 100)) textAt(MONSTERS[e.type].name, x, y + 9, { color: MONSTERS[e.type].boss ? '#ff9af0' : '#ffb0a0', size: 8 })
}

function bubble(text, x, y) {
  ctx.font = `${Math.round(9 * Z / 3 + 4)}px ${FONT}`
  const lines = [], max = 14
  for (let i = 0; i < text.length; i += max) lines.push(text.slice(i, i + max))
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) / Z + 8, lh = (9 * Z / 3 + 6) / Z, h = lines.length * lh + 4
  const bx = x - w / 2, by = y - h
  ctx.fillStyle = '#fffbe8'; ctx.strokeStyle = '#3a2f20'; ctx.lineWidth = Z
  ctx.beginPath(); ctx.roundRect(bx * Z, by * Z, w * Z, h * Z, 3 * Z); ctx.fill(); ctx.stroke()
  ctx.fillStyle = '#2a2018'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
  lines.forEach((l, i) => ctx.fillText(l, x * Z, (by + 2 + i * lh) * Z))
}

function hud(def, now) {
  const s = S.stats
  textAt(`${def.name}`, VW * TILE - 4, 8, { align: 'right', color: '#ffd36a', size: 11 })
  if (!s) return
  const bar = (y, v, max, color, label) => {
    ctx.fillStyle = '#000a'; ctx.fillRect(4 * Z, y * Z, 72 * Z, 6 * Z)
    ctx.fillStyle = color; ctx.fillRect(5 * Z, (y + 1) * Z, Math.round((70 * v) / Math.max(1, max)) * Z, 4 * Z)
    textAt(label, 80, y + 3, { align: 'left', size: 8 })
  }
  textAt(`${S.name}  Lv.${s.lv} ${JOBS[S.job].name}`, 4, 6, { align: 'left', size: 10, color: '#9be06a' })
  bar(12, s.hp, s.maxHp, '#e8443a', `체력 ${s.hp}/${s.maxHp}`)
  bar(20, s.mp, s.maxMp, '#3a8be8', `마력 ${s.mp}/${s.maxMp}`)
  bar(28, s.exp, s.next, '#e8c23a', `경험 ${Math.floor((100 * s.exp) / s.next)}%  ${s.gold}냥`)
  const sk = JOBS[S.job].skill, cd = Math.max(0, sk.cooldown - (now - S.skillAt))
  textAt(`[1] ${sk.name}${cd ? ` ${(cd / 1000).toFixed(1)}` : ''}`, VW * TILE - 4, VH * TILE - 8, { align: 'right', size: 9, color: cd || (s.mp < sk.mp) ? '#8fa39a' : '#ffffff' })
}

// ------------------------------------------------------------------ chat log and dialog
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
function log(html, cls = '') {
  const div = document.createElement('div')
  div.className = cls; div.innerHTML = html
  $('#log').append(div)
  while ($('#log').children.length > 40) $('#log').firstChild.remove()
}

// ------------------------------------------------------------------ the loop
function fit() {
  const w = innerWidth, h = innerHeight, upright = matchMedia('(pointer: coarse) and (orientation: portrait)').matches
  const z = Math.min(w / (VW * TILE), (upright ? h * 0.55 : h) / (VH * TILE))
  Z = z >= 2 ? Math.floor(z) : Math.max(0.75, z) // whole pixels when there's room, otherwise as big as it fits
  canvas.width = Math.round(VW * TILE * Z); canvas.height = Math.round(VH * TILE * Z)
  $('#frame').style.width = `${canvas.width}px`
  $('#frame').style.marginTop = upright ? '0' : `${Math.max(0, (h - canvas.height) / 2)}px`
}
addEventListener('resize', fit)
// ?bot: plays by itself (finds the nearest monster, walks there, fights; leaves the village by the east gate).
// For tests and recordings: ?bot&name=돌쇠&job=bow logs in on its own.
const params = new URLSearchParams(location.search)
const BOT = params.has('bot')
function pathDir(from, goal, avoid) { // breadth-first search over walkable tiles; the first step toward goal
  const def = MAPS[S.map], seen = new Set([from.join()]), q = [[from[0], from[1], null]]
  while (q.length) {
    const [x, y, first] = q.shift()
    for (const [d, [dx, dy]] of Object.entries(DIRS)) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny
      if (seen.has(k)) continue
      seen.add(k)
      if (goal(nx, ny)) return first ?? d
      if (!walkable(def, nx, ny) || avoid.has(k) || seen.size > 4000) continue
      q.push([nx, ny, first ?? d])
    }
  }
  return null
}
function bot(now) {
  const me = ent(S.me), def = MAPS[S.map]
  S.keys = []
  if (!me || me.dead || me.from) return
  const s = S.stats
  if (S.job === 'heal' && s && s.hp < s.maxHp * 0.6) return skill()
  const mons = [...S.ents.values()].filter((e) => e.kind === 'm' && !e.dead)
  const avoid = new Set(mons.map((m) => m.x + ',' + m.y))
  const range = JOBS[S.job].range
  // a monster in reach, in a straight line we're facing? swing (or use the skill now and then)
  for (const m of mons) {
    const dx = m.x - me.x, dy = m.y - me.y, d = Math.abs(dx) + Math.abs(dy)
    if ((dx === 0 || dy === 0) && d <= range) {
      const dir = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up'
      if (me.dir !== dir) { me.dir = dir; send({ t: 'face', dir }) }
      if (s && s.mp >= JOBS[S.job].skill.mp && Math.random() < 0.3) skill(); else act()
      return
    }
  }
  // not where it wants to hunt yet (town -> meadow -> forest)? head for the gate on the way
  const ROUTE = ['town', 'meadow', 'forest'], want = params.get('to') ?? 'meadow', here = ROUTE.indexOf(S.map), there = ROUTE.indexOf(want)
  if (here !== there) {
    const next = ROUTE[here + Math.sign(there - here)], gate = def.portals.find((q) => q.to === next)
    const d = gate && pathDir([me.x, me.y], (x, y) => x === gate.x && y === gate.y, avoid)
    if (d) S.keys = [d]
    return
  }
  const near = mons.sort((a, b) => Math.abs(a.x - me.x) + Math.abs(a.y - me.y) - Math.abs(b.x - me.x) - Math.abs(b.y - me.y))[0]
  if (!near) return
  const d = pathDir([me.x, me.y], (x, y) => (x === near.x || y === near.y) && Math.abs(x - near.x) + Math.abs(y - near.y) <= range && !avoid.has(x + ',' + y), avoid)
  if (d) S.keys = [d]
}
function frame(now) {
  if (S.map) {
    if (BOT) bot(now)
    walk(now)
    if (S.dialog && now - S.dialog.t0 > 5000) { S.dialog = null; $('#dialog').classList.add('hidden') }
    render(now)
  }
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

// ------------------------------------------------------------------ login
const jobsEl = $('#jobs'), colorsEl = $('#colors')
let pick = { job: 'sword', color: 0 }
const previews = []
for (const [id, j] of Object.entries(JOBS)) {
  const b = document.createElement('button')
  b.className = 'job'; b.type = 'button'; b.dataset.job = id
  b.innerHTML = `<canvas width="24" height="24"></canvas><b>${j.name}</b><small>${j.about}</small>`
  b.onclick = () => { pick.job = id; showPicks() }
  jobsEl.append(b)
  previews.push([id, b.querySelector('canvas')])
}
COLORS.forEach((c, i) => {
  const b = document.createElement('button')
  b.className = 'swatch'; b.type = 'button'; b.title = c ?? '기본'
  b.style.background = c ? SWATCH[c] : 'linear-gradient(135deg,#6a8,#468)'
  b.onclick = () => { pick.color = i; showPicks() }
  colorsEl.append(b)
})
function showPicks() {
  for (const b of jobsEl.children) b.setAttribute('aria-pressed', String(b.dataset.job === pick.job))
  ;[...colorsEl.children].forEach((b, i) => b.setAttribute('aria-pressed', String(i === pick.color)))
}
function animatePreviews(now) {
  if ($('#login').classList.contains('hidden')) return
  for (const [id, c] of previews) {
    const spec = { ...JOBS[id].spec, ...(COLORS[pick.color] ? { A: COLORS[pick.color] } : {}) }
    const f = walkOf(spec, 'down'), img = f[Math.floor(now / 180) % f.length]
    const g = c.getContext('2d'); g.clearRect(0, 0, 24, 24); g.drawImage(img.canvas, 0, 0)
  }
  requestAnimationFrame(animatePreviews)
}
requestAnimationFrame(animatePreviews)
showPicks()
$('#name').value = localStorage.getItem('dalmuri.last') ?? ''
function loginError(text) { $('#err').textContent = text; $('#go').disabled = false }
function start() {
  const name = $('#name').value.trim()
  if (!name) return loginError('이름을 적어 주세요.')
  $('#go').disabled = true; $('#err').textContent = ''
  unlocked = true
  S.color = pick.color
  connect({ name, job: pick.job, color: pick.color, token: localStorage.getItem(`dalmuri.token.${name}`) ?? undefined })
}
$('#go').onclick = start
if (BOT && params.get('name')) { $('#name').value = params.get('name'); pick.job = params.get('job') ?? 'sword'; pick.color = Number(params.get('color') ?? 0); start() }
$('#name').addEventListener('keydown', (e) => { if (e.key === 'Enter') start() })
window.game = () => S // for tests
