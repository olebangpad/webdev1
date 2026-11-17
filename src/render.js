// Drawing: the ground, everyone on it, every effect, the HUD and the menus. Everything is a PixSpell image.
import { spell, Pixmap, walk, idle, fx, sprite, frames, white, big, label, color } from './pix.js'
import { HEROES, WEAPONS, PASSIVES, EVOLUTIONS, STAGES, DASH } from './data.js'
import { evolutionFor } from './game.js'

export const W = 400, H = 225
const CHUNK = 32 // tiles per ground chunk (it repeats)

let ctx
export function setContext(c) { ctx = c; ctx.imageSmoothingEnabled = false }
const draw = (img, x, y) => ctx.drawImage(img.canvas, Math.round(x), Math.round(y))
const drawCentered = (img, x, y) => draw(img, x - img.w / 2, y - img.h / 2)
const heroSpec = (id) => spell.char.world.find((w) => w.id === id).spec
export const heroName = (id) => spell.char.world.find((w) => w.id === id).name.toUpperCase()

// ------------------------------------------------------------------ the ground: one chunk that repeats with no seam
const grounds = new Map()
export function resetGround() { grounds.clear() }
function ground(stage) {
  if (grounds.has(stage.id)) return grounds.get(stage.id)
  const T = 16, N = CHUNK, TAU = Math.PI * 2
  // periodic noise: the left edge continues the right one, so the chunk tiles forever
  const noise = (x, y, s) => Math.sin(TAU * (x / N) * 2 + s) * Math.cos(TAU * (y / N) * 3 + s * 2) * 0.5 + Math.sin(TAU * (x / N + y / N) * 3 + s * 3) * 0.3 + Math.cos(TAU * (x / N) * 5 + s) * Math.sin(TAU * (y / N) * 4) * 0.2
  const c = document.createElement('canvas')
  c.width = c.height = N * T
  const g = c.getContext('2d')
  const base = sprite(stage.base)
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) g.drawImage(base.canvas, x * T, y * T)
  stage.patches.forEach(([tile, th], i) => {
    // one cell of margin all round, from the wrapped noise, then cut back to the chunk
    const cells = Array.from({ length: N + 2 }, (_, y) => Array.from({ length: N + 2 }, (_, x) => noise((x - 1 + N) % N, (y - 1 + N) % N, i * 1.7 + 0.3) > th - 0.3))
    const img = spell.autotile(tile, null).draw(cells)
    g.drawImage(img.canvas, T, T, N * T, N * T, 0, 0, N * T, N * T)
  })
  let seed = stage.id.length * 9973
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 70; i++) {
    const id = stage.decor[Math.floor(r() * stage.decor.length)]
    try { g.drawImage(sprite(id).canvas, Math.floor(r() * N) * T, Math.floor(r() * N) * T) } catch {}
  }
  grounds.set(stage.id, c)
  return c
}

// ------------------------------------------------------------------ the world
export function camera(g) {
  const sx = g.shake > 0 ? Math.round((Math.random() - 0.5) * 6 * Math.min(1, g.shake * 5)) : 0
  const sy = g.shake > 0 ? Math.round((Math.random() - 0.5) * 6 * Math.min(1, g.shake * 5)) : 0
  return [Math.round(g.p.x - W / 2) + sx, Math.round(g.p.y - 10 - H / 2) + sy]
}

export function drawWorld(g, now) {
  const [cx, cy] = camera(g)
  const gr = ground(g.stage), size = gr.width
  for (let x = Math.floor(cx / size) * size; x < cx + W; x += size) for (let y = Math.floor(cy / size) * size; y < cy + H; y += size) ctx.drawImage(gr, x - cx, y - cy)
  // things on the ground
  for (const d of g.drops) {
    const id = d.kind === 'chest' ? 'chest-gold' : d.kind === 'meat' ? 'meat' : d.kind === 'compass' ? 'compass' : 'coin'
    const f = frames(id)
    drawCentered(f[Math.floor(now * 6) % f.length], d.x - cx, d.y - cy - 4 + Math.sin(now * 4) * 1.5)
  }
  for (const gem of g.gems) {
    const id = gem.v >= 20 ? 'gem-diamond' : gem.v >= 4 ? 'gem-emerald' : 'gem-sapphire'
    drawCentered(sprite(id, { grid: 8 }), gem.x - cx, gem.y - cy)
  }
  // zones under everyone: pools, holes, tornadoes, breath
  for (const z of g.zones) {
    if (z.fx) { const f = fx(z.fx.name, z.fx.opts); drawCentered(f[Math.floor(now * (f.fps ?? 12)) % f.length], z.x - cx, z.y - cy - 4) }
    if (z.kind === 'breath') {
      const f = fx('dragon-breath', { size: Math.round(z.r * 1.3) }), [fx0, fy0] = g.p.face
      rotated(f[Math.floor(now * 14) % f.length], z.x - cx + fx0 * z.r * 0.55, z.y - 8 - cy + fy0 * z.r * 0.55, Math.atan2(fy0, fx0))
    }
  }
  for (const w of g.weapons) if (w.def.kind === 'aura') {
    const r = w.def.radius * g.stats.area * (1 + 0.12 * (w.lv - 1))
    const f = fx('aura', { size: Math.round(r * 2), element: 'holy' })
    ctx.globalAlpha = 0.6; drawCentered(f[Math.floor(now * 10) % f.length], g.p.x - cx, g.p.y - 8 - cy); ctx.globalAlpha = 1
  }
  // everyone, the lower in front; shadows first
  const list = g.enemies.filter((e) => e.x > cx - 40 && e.x < cx + W + 40 && e.y > cy - 20 && e.y < cy + H + 60)
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  for (const e of list) { ctx.beginPath(); ctx.ellipse(e.x - cx, e.y - cy, e.big ? 12 : 6, e.big ? 4 : 2, 0, 0, Math.PI * 2); ctx.fill() }
  ctx.beginPath(); ctx.ellipse(g.p.x - cx, g.p.y - cy, 6, 2, 0, 0, Math.PI * 2); ctx.fill()
  const order = [...list, g.p].sort((a, b) => a.y - b.y)
  for (const e of order) {
    if (e === g.p) { drawHero(g, now, cx, cy); continue }
    const key = e.kind + e.dir
    let f = walk(e.def.spec, e.dir)
    if (e.big) f = big(f, key)
    if (e.flash > 0) f = white(f, key + (e.big ? 'B' : ''))
    const img = f[(((Math.floor(now * (f.fps ?? 6) + e.x * 0.01)) % f.length) + f.length) % f.length] // a different step for each, never a negative index
    draw(img, e.x - cx - f.origin[0], e.y - cy - f.origin[1])
  }
  // what flies
  for (const s of g.shots) {
    if (s.delay > 0) continue
    if (s.sprite) { const img = sprite(s.sprite); rotated(img, s.x - cx, s.y - cy, s.kind === 'boomerang' ? now * 18 : now * 10, s.scale ?? 1, s.scale ?? 1); continue }
    const f = fx(s.name, s.opts), img = f[Math.floor(now * (f.fps ?? 14)) % f.length]
    rotated(img, s.x - cx, s.y - cy, s.spinRot ? now * 12 : Math.atan2(s.vy, s.vx))
  }
  for (const w of g.weapons) {
    if (w.def.kind === 'orbit' && w.points) for (const [x, y, look] of w.points) drawCentered(sprite(look), x - cx, y - cy)
    if (w.def.kind === 'sweep' && w.beams) { // rays that turn around you: one laser image stretched along each
      const f = fx('laser', { size: 48, element: w.def.el }), img = f[Math.floor(now * 16) % f.length]
      for (const a of w.beams) rotated(img, g.p.x - cx + Math.cos(a) * (w.len / 2 + 6), g.p.y - 8 - cy + Math.sin(a) * (w.len / 2 + 6), a, w.len / img.w, 0.6)
    }
  }
  // effects that play once
  g.fx = g.fx.filter((e) => {
    if (e.t < 0) return true
    const f = fx(e.name, e.opts), i = Math.floor(e.t * (f.fps ?? 14))
    if (i >= f.length) return false
    const img = f[i]
    if (e.rot != null) rotated(img, e.x - cx, e.y - cy, e.rot, e.scaleX); else drawCentered(img, e.x - cx, e.y - cy)
    return true
  })
  // numbers
  for (const n of g.numbers) {
    ctx.globalAlpha = Math.min(1, (0.7 - n.t) * 4)
    const img = label(n.n, n.hurt ? '#ff5a4a' : n.crit ? '#ffd23f' : '#ffffff')
    drawCentered(img, n.x - cx, n.y - cy - n.t * 22)
    ctx.globalAlpha = 1
  }
  // your health, under your feet
  ctx.fillStyle = color('#10141a'); ctx.fillRect(Math.round(g.p.x - cx - 12), Math.round(g.p.y - cy + 3), 24, 3)
  ctx.fillStyle = color('#e8443a'); ctx.fillRect(Math.round(g.p.x - cx - 11), Math.round(g.p.y - cy + 4), Math.round((22 * g.p.hp) / g.stats.maxHp), 1)
  // and the dash, filling up again
  const ready = 1 - g.p.dashCd / (DASH.cd * (g.dashCdMul ?? 1))
  ctx.fillStyle = color(ready >= 1 ? '#7fe3ff' : '#3a6a88'); ctx.fillRect(Math.round(g.p.x - cx - 11), Math.round(g.p.y - cy + 7), Math.round(22 * Math.max(0, ready)), 1)
}
function rotated(img, x, y, a, sx = 1, sy = 1) {
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(a); if (sx !== 1 || sy !== 1) ctx.scale(sx, sy)
  ctx.drawImage(img.canvas, -img.w / 2, -img.h / 2); ctx.restore()
}
function drawHero(g, now, cx, cy) {
  const spec = { ...heroSpec(g.hero.id), ...(g.tall ? { height: 24 } : {}) }
  // standing still keeps the way it was facing: the first walk frame is the standing pose of that view
  // (facing the camera it breathes with its idle animation instead)
  const breathing = !g.p.moving && g.p.dir === 'down'
  const f = breathing ? idle(spec) : walk(spec, g.p.dir)
  const i = g.p.moving ? Math.floor(now * (f.fps ?? 6)) % f.length : breathing ? Math.floor(now * 3) % f.length : 0
  for (const q of g.p.trail) { // where the dash just was, fading
    ctx.globalAlpha = 0.5 * (1 - (g.t - q.t) / 0.25)
    draw(f[i], q.x - cx - f.origin[0], q.y - cy - f.origin[1])
  }
  ctx.globalAlpha = 1
  if (g.p.blink > 0 && Math.floor(now * 20) % 2) return // blink after a hit, while you can't be hurt again
  const fr = g.p.hurt > 0 ? white(f, 'hero' + g.hero.id + !!g.tall + g.p.dir + breathing) : f
  draw(fr[i], g.p.x - cx - f.origin[0], g.p.y - cy - f.origin[1])
}

// ------------------------------------------------------------------ HUD
const mmss = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`
export function drawHud(g) {
  ctx.fillStyle = color('#10141a'); ctx.fillRect(0, 0, W, 5)
  ctx.fillStyle = color('#4fc3ff'); ctx.fillRect(0, 0, Math.round((W * g.xp) / g.next), 4)
  draw(label(`LV ${g.lv}`, '#ffffff'), W - 30, 6)
  const t = label(mmss(g.t), '#ffffff', 2)
  draw(t, (W - t.w) / 2, 7)
  draw(label(`${g.kills}`, '#ffd23f'), W - 30, 15)
  draw(label(`${g.gold}G`, '#ffd23f'), W - 30, 24)
  g.weapons.forEach((w, i) => {
    if (w.evo) { ctx.fillStyle = color('#ffd23f'); ctx.globalAlpha = 0.35; ctx.fillRect(2 + i * 18, 6, 18, 18); ctx.globalAlpha = 1 }
    draw(sprite(w.def.icon), 3 + i * 18, 7)
    draw(label(w.evo ? '*' : w.lv, '#ffd23f'), 13 + i * 18, 17)
  })
  Object.entries(g.passives).forEach(([id, lv], i) => { draw(sprite(PASSIVES[id].icon, { grid: 8 }), 3 + i * 12, 27); draw(label(lv, '#cfe8d4'), 9 + i * 12, 31) })
  if (g.boss && !g.boss.dead) {
    const bw = 200, x = (W - bw) / 2, y = H - 14
    ctx.fillStyle = color('#10141a'); ctx.fillRect(x - 1, y - 1, bw + 2, 6)
    ctx.fillStyle = color('#ff4fd8'); ctx.fillRect(x, y, Math.round((bw * g.boss.hp) / g.boss.maxHp), 4)
    const n = label(g.boss.name, '#ff9af0'); draw(n, (W - n.w) / 2, y - 9)
  }
  if (g.banner && !g.over && !g.choices && !g.paused) {
    const k = g.banner.t, b = label(g.banner.text, g.banner.warn ? '#ff5a4a' : '#ffd23f', 3)
    ctx.globalAlpha = Math.min(1, k * 4, (3 - k) * 2)
    draw(b, (W - b.w) / 2, 40)
    const sub = g.banner.warn ? 'A BOSS IS COMING' : g.banner.sub
    if (sub) { const s = label(sub, '#ffffff'); draw(s, (W - s.w) / 2, 62) }
    ctx.globalAlpha = 1
  }
}

// ------------------------------------------------------------------ menus
function dim(a = 0.6) { ctx.fillStyle = color('#0b0f14'); ctx.globalAlpha = a; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1 }
const panel = (w, h) => sprite('panel').nineSlice(w, h)
const centered = (img, y) => draw(img, Math.round((W - img.w) / 2), y)

/** Level-up cards; returns their boxes so clicks and taps can find them. */
export function drawChoices(g, sel, now = 0) {
  dim(0.55)
  centered(label('LEVEL UP!', '#ffd23f', 2), 22)
  const n = g.choices.length, cw = n === 4 ? 92 : 112, gap = 6, x0 = (W - (n * cw + (n - 1) * gap)) / 2, y = 46, ch = 112
  const boxes = g.choices.map((c, i) => {
    const x = x0 + i * (cw + gap)
    const evo = c.type === 'evo' ? EVOLUTIONS[c.id] : null
    const def = evo ? evo.def : c.type === 'w' ? WEAPONS[c.id] : c.type === 'p' ? PASSIVES[c.id] : null
    draw(panel(cw, ch), x, y)
    if (evo) { ctx.fillStyle = color('#ffd23f'); ctx.globalAlpha = 0.25 + 0.15 * Math.sin(now * 6); ctx.fillRect(x + 2, y + 2, cw - 4, ch - 4); ctx.globalAlpha = 1 }
    if (i === sel || evo) { ctx.strokeStyle = color(evo ? '#fff3a0' : '#ffd23f'); ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1) }
    if (def) {
      const icon = sprite(def.icon).scale(2)
      draw(icon, x + (cw - icon.w) / 2, y + 8)
      const name = label(def.name, '#ffffff'); draw(name, x + (cw - name.w) / 2, y + 44)
      const lv = label(evo ? 'EVOLVE!' : c.lv === 1 ? 'NEW!' : `LV ${c.lv}`, evo ? '#fff3a0' : c.lv === 1 ? '#7dff8a' : '#ffd23f'); draw(lv, x + (cw - lv.w) / 2, y + 54)
      words(def.desc, cw - 10).forEach((line, j) => { const l = label(line, '#cfe8d4'); draw(l, x + (cw - l.w) / 2, y + 66 + j * 8) })
      // what it takes to evolve: the weapon and the passive that go together
      const pair = c.type === 'w' && EVOLUTIONS[c.id] && !g.weapons.find((w) => w.id === c.id)?.evo ? [PASSIVES[EVOLUTIONS[c.id].needs].icon, !!g.passives[EVOLUTIONS[c.id].needs]]
        : c.type === 'p' ? (() => { const w = g.weapons.find((w) => EVOLUTIONS[w.id]?.needs === c.id && !w.evo); return w ? [w.def.icon, true] : null })() : null
      if (pair) {
        const t = label('EVO +', pair[1] ? '#fff3a0' : '#8a7a50')
        draw(t, x + (cw - t.w - 10) / 2, y + ch - 13); draw(sprite(pair[0], { grid: 8 }), x + (cw - t.w - 10) / 2 + t.w + 2, y + ch - 15)
      }
    } else {
      const l = label(c.type === 'heal' ? 'FULL HEAL' : '+25 GOLD', '#ffffff'); draw(l, x + (cw - l.w) / 2, y + 44)
    }
    const k = label(String(i + 1), '#6f8f78'); draw(k, x + 4, y + 4)
    return ['card', i, x, y, cw, ch]
  })
  // deal again
  const r = label(`R: REROLL (${g.rerolls})`, g.rerolls > 0 ? '#ffffff' : '#6f8f78'), rw = r.w + 12, rx = Math.round((W - rw) / 2), ry = y + ch + 8
  draw(panel(rw, 15), rx, ry); draw(r, rx + 6, ry + 5)
  boxes.push(['reroll', 0, rx, ry, rw, 15])
  return boxes
}
function words(s, width) { // wrap pixel text by width (5 px font: 6 px a letter)
  const out = []; let line = ''
  for (const w of s.split(' ')) { if ((line + ' ' + w).trim().length * 6 > width) { out.push(line); line = w } else line = (line + ' ' + w).trim() }
  if (line) out.push(line)
  return out
}

export function drawOver(g) {
  dim(0.7)
  centered(label(g.won ? 'VICTORY!' : 'YOU FELL', g.won ? '#ffd23f' : '#ff5a4a', 3), 40)
  const lines = [`${heroName(g.hero.id)} OF ${g.hero.from}`, `${g.stage.name}  ${mmss(g.t)}`, `LEVEL ${g.lv}   ${g.kills} DEFEATED   ${g.gold} GOLD`]
  lines.forEach((s, i) => centered(label(s, '#ffffff'), 78 + i * 12))
  g.weapons.forEach((w, i) => { const icon = sprite(w.def.icon); draw(icon, (W - g.weapons.length * 20) / 2 + i * 20, 118) })
  centered(label('ENTER: AGAIN   ESC: HEROES', '#cfe8d4'), 150)
}

export function drawPause(g) {
  dim(0.7)
  centered(label('PAUSED', '#ffffff', 3), 14)
  // your weapons, and what each needs to evolve
  g.weapons.forEach((w, i) => {
    const y = 44 + i * 19, evo = EVOLUTIONS[w.id]
    draw(sprite(w.def.icon), 60, y)
    draw(label(`${w.def.name}  ${w.evo ? 'EVOLVED' : 'LV ' + w.lv}`, w.evo ? '#fff3a0' : '#ffffff'), 80, y + 2)
    if (evo && !w.evo) {
      const have = !!g.passives[evo.needs], ready = !!evolutionFor(g, w)
      draw(label(ready ? 'READY: NEXT LEVEL UP' : `LV 5 + ${PASSIVES[evo.needs].name} = ${evo.def.name}`, ready ? '#7dff8a' : have ? '#fff3a0' : '#8fa39a'), 80, y + 10)
      draw(sprite(PASSIVES[evo.needs].icon, { grid: 8 }), 68, y + 9)
    } else draw(label(w.def.desc, '#8fa39a'), 80, y + 10)
  })
  Object.entries(g.passives).forEach(([id, lv], i) => { draw(sprite(PASSIVES[id].icon), 262, 44 + i * 19); draw(label(`${PASSIVES[id].name} ${lv}`, '#ffffff'), 282, 46 + i * 19); draw(label(PASSIVES[id].desc, '#8fa39a'), 282, 54 + i * 19) })
  centered(label('ESC: GO ON   M: SOUND   P: COLORS   Q: QUIT', '#cfe8d4'), 208)
}

/** The title: pick a hero, then a stage. Returns the boxes that can be clicked. */
export function drawTitle(state, now) {
  const st = STAGES[state.stage]
  const gr = ground(st)
  ctx.drawImage(gr, (now * 12) % 256, 40, W, H, 0, 0, W, H)
  dim(0.55)
  const logo = label('WORLDFALL', '#ffd23f', 4)
  centered(logo, 8)
  centered(label('HEROES OF THE WORLD AGAINST THE FALLING HORDE', '#cfe8d4'), 34)
  const boxes = []
  HEROES.forEach((h, i) => {
    const x = 28 + (i % 5) * 26, y = 52 + Math.floor(i / 5) * 32
    const f = walk(heroSpec(h.id), 'down')
    if (i === state.hero) { ctx.fillStyle = color('#ffd23f'); ctx.globalAlpha = 0.3; ctx.fillRect(x - 1, y - 1, 26, 30); ctx.globalAlpha = 1 }
    draw(f[i === state.hero ? Math.floor(now * 8) % f.length : 0], x, y)
    boxes.push(['hero', i, x - 1, y - 1, 26, 30])
  })
  const h = HEROES[state.hero], spec = { ...heroSpec(h.id), ...(state.tall ? { height: 24 } : {}) }
  const f = walk(spec, 'down'), img = f[Math.floor(now * 8) % f.length].scale(3)
  draw(img, 220, 128 - img.h)
  draw(label(heroName(h.id), '#ffffff', 2), 290, 56)
  draw(label(h.from, '#8fa39a'), 290, 70)
  draw(sprite(WEAPONS[h.weapon].icon), 290, 80); draw(label(WEAPONS[h.weapon].name, '#ffd23f'), 308, 85)
  words(h.note, 104).forEach((l, i) => draw(label(l, '#cfe8d4'), 290, 100 + i * 8))
  draw(label(`HP ${h.hp}  SPEED ${h.speed}`, '#8fa39a'), 290, 118)
  const evo = EVOLUTIONS[h.weapon]
  if (evo) { draw(sprite(PASSIVES[evo.needs].icon, { grid: 8 }), 290, 127); draw(label(`= ${evo.def.name}`, '#fff3a0'), 300, 129) }
  // stage strip
  STAGES.forEach((s, i) => {
    const x = 28 + i * 118, y = 150, w = 110, hh = 40
    const thumb = ground(s)
    ctx.drawImage(thumb, 0, 0, w, hh, x, y, w, hh)
    if (i === state.stage) { ctx.strokeStyle = color('#ffd23f'); ctx.strokeRect(x + 0.5, y + 0.5, w - 1, hh - 1) } else { ctx.fillStyle = color('#0b0f14'); ctx.globalAlpha = 0.45; ctx.fillRect(x, y, w, hh); ctx.globalAlpha = 1 }
    const n = label(s.name, '#ffffff'); draw(n, x + (w - n.w) / 2, y + hh - 10)
    boxes.push(['stage', i, x, y, w, hh])
  })
  const hint = label('ARROWS: HERO  Q/E: STAGE  T: TALL  ENTER: START', '#ffffff')
  centered(label('IN A RUN: SPACE DASHES - LEVEL 5 WEAPON + ITS PASSIVE EVOLVES', '#8fa39a'), 141)
  if (Math.floor(now * 2) % 2 || state.demo) centered(hint, 200)
  centered(label('EVERY PIXEL AND SOUND IS PIXSPELL CODE', '#6f8f78'), 213)
  return boxes
}
