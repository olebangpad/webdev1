// WORLDFALL: screens, input, the loop, and a demo that plays itself (?demo).
import { audio, setPalette, PALETTES, palName } from './pix.js'
import { HEROES, STAGES, WEAPONS, CLOSE } from './data.js'
import { newGame, step, choose } from './game.js'
import { W, H, setContext, drawWorld, drawHud, drawChoices, drawOver, drawPause, drawTitle, resetGround } from './render.js'

const canvas = document.getElementById('game')
const ctx = canvas.getContext('2d')
canvas.width = W; canvas.height = H
setContext(ctx)

const params = new URLSearchParams(location.search)
const demo = params.has('demo')
const fixed = (name, list) => { const v = params.get(name); const i = list.findIndex((x) => x.id === v); return i >= 0 ? i : null } // ?hero=viking&stage=frost
const ui = { screen: 'title', hero: fixed('hero', HEROES) ?? Math.floor(Math.random() * HEROES.length), stage: fixed('stage', STAGES) ?? 0, tall: params.has('tall'), sel: 0, boxes: [], demo, t: 0 }
let g = null

function start() {
  g = newGame(STAGES[ui.stage], HEROES[ui.hero].id, { sfx: (n, o, v) => audio.sfx(n, o, v) })
  g.tall = ui.tall
  if (demo) { g.stats.maxHp *= 4; g.p.hp = g.stats.maxHp; g.stats.armor += 2 } // the demo plays a long run
  ui.screen = 'game'; ui.sel = 0
  audio.music(STAGES[ui.stage].music)
  const warm = Number(params.get('warm') ?? 0) // fast-forward that many seconds (recordings start mid-fight)
  for (let t = 0; t < warm; t += 1 / 30) { step(g, 1 / 30, autopilot()); if (g.choices) autoChoose() }
}

// ------------------------------------------------------------------ input
const keys = new Set()
let stick = null // touch: drag anywhere to move
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase()
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault()
  audio.unlock(); keys.add(k); press(k)
})
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()))
addEventListener('blur', () => keys.clear())
const toCanvas = (e) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height)] }
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock()
  const [x, y] = toCanvas(e)
  const hit = ui.boxes.find(([, , bx, by, bw, bh]) => x >= bx && x < bx + bw && y >= by && y < by + bh)
  if (ui.screen === 'title') {
    if (hit?.[0] === 'hero') { if (ui.hero === hit[1]) start(); else ui.hero = hit[1]; return audio.sfx('select') }
    if (hit?.[0] === 'stage') { if (ui.stage === hit[1]) start(); else ui.stage = hit[1]; return audio.sfx('select') }
    return
  }
  if (g?.choices) { if (hit) choose(g, g.choices[hit[1]]); return }
  if (g?.over) return press('enter')
  stick = { x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 }
})
addEventListener('pointermove', (e) => { if (stick) { stick.dx = e.clientX - stick.x0; stick.dy = e.clientY - stick.y0 } })
addEventListener('pointerup', () => { stick = null })

function press(k) {
  if (k === 'm') return audio.toggle()
  if (k === 'p') { setPalette(PALETTES[(PALETTES.indexOf(palName) + 1) % PALETTES.length]); return resetGround() }
  if (ui.screen === 'title') {
    if (k === 'arrowright' || k === 'd') ui.hero = (ui.hero + 1) % HEROES.length
    if (k === 'arrowleft' || k === 'a') ui.hero = (ui.hero + HEROES.length - 1) % HEROES.length
    if (k === 'arrowdown' || k === 's' || k === 'arrowup' || k === 'w') ui.hero = (ui.hero + 5) % HEROES.length
    if (k === 'e') ui.stage = (ui.stage + 1) % STAGES.length
    if (k === 'q') ui.stage = (ui.stage + STAGES.length - 1) % STAGES.length
    if (k === 't') ui.tall = !ui.tall
    if (k === 'enter' || k === ' ') return start()
    return audio.sfx('select')
  }
  if (!g) return
  if (g.choices) {
    if (/^[1-4]$/.test(k) && g.choices[Number(k) - 1]) return choose(g, g.choices[Number(k) - 1])
    if (k === 'arrowright' || k === 'd') ui.sel = (ui.sel + 1) % g.choices.length
    if (k === 'arrowleft' || k === 'a') ui.sel = (ui.sel + g.choices.length - 1) % g.choices.length
    if (k === 'enter' || k === ' ') { choose(g, g.choices[ui.sel] ?? g.choices[0]); ui.sel = 0 }
    return
  }
  if (g.over) {
    if (k === 'enter' || k === ' ') start()
    if (k === 'escape') toTitle()
    return
  }
  if (k === 'escape') { g.paused = !g.paused; return }
  if (g.paused && k === 'q') toTitle()
}
function toTitle() { ui.screen = 'title'; g = null; audio.music('title') }

function input() {
  if (demo) return autopilot()
  let dx = 0, dy = 0
  if (keys.has('arrowleft') || keys.has('a')) dx--
  if (keys.has('arrowright') || keys.has('d')) dx++
  if (keys.has('arrowup') || keys.has('w')) dy--
  if (keys.has('arrowdown') || keys.has('s')) dy++
  if (stick && Math.hypot(stick.dx, stick.dy) > 8) { dx = stick.dx; dy = stick.dy }
  return dx || dy ? [dx, dy] : null
}

// ------------------------------------------------------------------ the demo: dodge the crowd, sweep up gems, circle
function autopilot() {
  if (!g) return null
  const p = g.p
  let vx = 0, vy = 0, close = null, cd = 1e9
  for (const e of g.enemies) {
    const dx = p.x - e.x, dy = p.y - e.y, d2 = dx * dx + dy * dy
    if (d2 < cd) { cd = d2; close = e }
    if (d2 < 70 * 70) { const w = (e.big ? 3 : 1) / Math.max(60, d2); vx += dx * w; vy += dy * w }
  }
  // keep the nearest one at fighting distance: back off when it's on you, step in when it's far, else circle it
  if (close) {
    const near = CLOSE.has(WEAPONS[g.hero.weapon].kind) ? 18 : 34, far = near * 2
    const d = Math.sqrt(cd) || 1, ux = (close.x - p.x) / d, uy = (close.y - p.y) / d
    if (d > far) { vx += ux * 0.02; vy += uy * 0.02 } else if (d > near) { vx += -uy * 0.015; vy += ux * 0.015 }
  }
  let best = null, bd = 1e9
  for (const gem of g.gems) { const d = (gem.x - p.x) ** 2 + (gem.y - p.y) ** 2; if (d < bd) { bd = d; best = gem } }
  for (const d of g.drops) { const dd = (d.x - p.x) ** 2 + (d.y - p.y) ** 2; if (dd < bd * 2) { bd = dd / 2; best = d } }
  if (best && bd < 150 * 150) { const d = Math.sqrt(bd) || 1; vx += ((best.x - p.x) / d) * 0.01; vy += ((best.y - p.y) / d) * 0.01 }
  const a = g.t * 0.35 // and keep drifting round in a slow circle, so the camera travels
  vx += Math.cos(a) * 0.004; vy += Math.sin(a) * 0.004
  return Math.hypot(vx, vy) > 0.0005 ? [vx, vy] : null
}
function autoChoose() {
  const c = g.choices
  const pickIt = c.find((x) => x.type === 'w' && x.lv === 1) ?? c.find((x) => x.type === 'w') ?? c[0]
  choose(g, pickIt)
}

// ------------------------------------------------------------------ the loop
let last = performance.now()
function frame(now) {
  try { tick(now) } catch (e) { console.error(e) } // one bad frame must not stop the game
  requestAnimationFrame(frame)
}
function tick(now) {
  const dt = Math.min(1 / 20, (now - last) / 1000)
  last = now
  const t = now / 1000
  ui.t += dt
  ctx.fillStyle = '#0b0f14'; ctx.fillRect(0, 0, W, H)
  if (ui.screen === 'title') {
    ui.boxes = drawTitle(ui, t)
    if (demo && ui.t > 2.5) { if (fixed('stage', STAGES) == null) ui.stage = Math.floor(Math.random() * STAGES.length); start() }
  } else {
    if (g.choices && demo) autoChoose()
    step(g, dt, input())
    drawWorld(g, t)
    drawHud(g)
    ui.boxes = []
    if (g.choices) ui.boxes = drawChoices(g, ui.sel).map((b, i) => ['card', i, ...b])
    else if (g.over) { drawOver(g); if (demo && (g.overT = (g.overT ?? 0) + dt) > 5) { ui.t = 0; ui.hero = Math.floor(Math.random() * HEROES.length); ui.screen = 'title' } }
    else if (g.paused) drawPause()
  }
}

function fit() {
  const s = Math.min(innerWidth / W, (innerHeight - 40) / H)
  const z = s >= 2 ? Math.floor(s) : s // whole pixels when there's room; on a phone, as big as it fits
  canvas.style.width = `${Math.round(W * z)}px`; canvas.style.height = `${Math.round(H * z)}px`
}
addEventListener('resize', fit)
fit()
audio.music('title')
requestAnimationFrame(frame)
window.game = () => ({ ui, g }) // for tests and recordings
