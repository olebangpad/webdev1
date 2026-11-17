// WORLDFALL: screens, input, the loop, and a demo that plays itself (?demo).
import { audio, setPalette, PALETTES, palName, lang, setLang } from './pix.js'
import { HEROES, STAGES } from './data.js'
import { UPGRADES } from './data.js'
import { newGame, step, choose, reroll } from './game.js'
import { autopilot, autoChoose } from './pilot.js'
import { hasHero, buyHero, buyUpgrade, bank } from './meta.js'
import { loadSave, storeSave } from './save.js'
import { W, H, setContext, drawWorld, drawHud, drawChoices, drawOver, drawPause, drawTitle, drawShop, drawTouch, resetGround } from './render.js'

const canvas = document.getElementById('game')
const ctx = canvas.getContext('2d')

const params = new URLSearchParams(location.search)
// language: ?lang=ko, or what was chosen last time (L), or the browser's
const stored = (() => { try { return localStorage.getItem('worldfall.lang') } catch { return null } })()
setLang(params.get('lang') ?? stored ?? ((navigator.language ?? '').startsWith('ko') ? 'ko' : 'en'))
document.fonts?.load("16px 'DungGeunMo'").then(() => setLang(lang), () => {}) // draw Korean again once its font is in
function toggleLang() { setLang(lang === 'ko' ? 'en' : 'ko'); try { localStorage.setItem('worldfall.lang', lang) } catch { /* not remembered */ } }
const demo = params.has('demo')
const fixed = (name, list) => { const v = params.get(name); const i = list.findIndex((x) => x.id === v); return i >= 0 ? i : null } // ?hero=viking&stage=frost
const ui = { shopSel: 0, result: null, screen: 'title', hero: fixed('hero', HEROES) ?? Math.floor(Math.random() * HEROES.length), stage: fixed('stage', STAGES) ?? 0, tall: params.has('tall'), sel: 0, boxes: [], demo, t: 0 }
let g = null
// what lasts between runs; the demo plays with everything open and banks nothing
const save = loadSave()
if (demo) save.heroes = HEROES.map((h) => h.id)
if (fixed('hero', HEROES) == null) { const mine = HEROES.map((h, i) => i).filter((i) => hasHero(save, HEROES[i].id)); ui.hero = mine[Math.floor(Math.random() * mine.length)] } // open on a hero you own

function start() {
  const hero = HEROES[ui.hero]
  if (!hasHero(save, hero.id)) { // locked: Enter buys it, if the bank allows
    if (buyHero(save, hero.id)) { storeSave(save); audio.sfx('unlock', undefined, 0.5) } else audio.sfx('error', undefined, 0.4)
    return
  }
  g = newGame(STAGES[ui.stage], hero.id, { sfx: (n, o, v) => audio.sfx(n, o, v), upgrades: demo ? {} : save.upgrades })
  g.tall = ui.tall
  ui.result = null
  if (demo) { g.stats.maxHp *= 4; g.p.hp = g.stats.maxHp; g.stats.armor += 2 } // the demo plays a long run
  ui.screen = 'game'; ui.sel = 0
  audio.music(STAGES[ui.stage].music)
  const warm = Number(params.get('warm') ?? 0) // fast-forward that many seconds (recordings start mid-fight)
  for (let t = 0; t < warm; t += 1 / 30) { step(g, 1 / 30, autopilot(g)); if (g.choices) autoChoose(g) }
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
  if (e.pointerType === 'touch') ui.touch = true
  const [x, y] = toCanvas(e)
  const hit = ui.boxes.find(([, , bx, by, bw, bh]) => x >= bx && x < bx + bw && y >= by && y < by + bh)
  if (ui.screen === 'title') {
    if (hit?.[0] === 'hero') { if (ui.hero === hit[1]) start(); else ui.hero = hit[1]; return audio.sfx('select') }
    if (hit?.[0] === 'stage') { if (ui.stage === hit[1]) start(); else ui.stage = hit[1]; return audio.sfx('select') }
    if (hit?.[0] === 'shop') { ui.screen = 'shop'; return audio.sfx('select') }
    if (hit?.[0] === 'start') return start()
    if (hit?.[0] === 'tall') { ui.tall = !ui.tall; return audio.sfx('select') }
    if (hit?.[0] === 'lang') { toggleLang(); return audio.sfx('select') }
    return
  }
  if (ui.screen === 'shop') {
    if (hit?.[0] === 'back') { ui.screen = 'title'; return audio.sfx('select') }
    if (hit?.[0] === 'upgrade') { if (ui.shopSel === hit[1]) buy(); else { ui.shopSel = hit[1]; audio.sfx('select') } } else if (!hit) { ui.screen = 'title' }
    return
  }
  if (g?.choices) { if (hit?.[0] === 'card') choose(g, g.choices[hit[1]]); else if (hit?.[0] === 'reroll') reroll(g); return }
  if (hit?.[0] === 'dash') { g.wantDash = true; return }
  if (hit?.[0] === 'again') return start()
  if (hit?.[0] === 'resume') { g.paused = false; return }
  if (hit?.[0] === 'title') return toTitle()
  if (g?.over) return press('enter')
  if (hit?.[0] === 'pause') { g.paused = !g.paused; return }
  if (g?.paused) { g.paused = false; return }
  stick = { id: e.pointerId, x0: x, y0: y, dx: 0, dy: 0 } // where the finger went down, in game pixels
})
addEventListener('pointermove', (e) => { if (stick && e.pointerId === stick.id) { const [x, y] = toCanvas(e); stick.dx = x - stick.x0; stick.dy = y - stick.y0 } })
for (const ev of ['pointerup', 'pointercancel']) addEventListener(ev, (e) => { if (stick && e.pointerId === stick.id) stick = null })

function press(k) {
  if (k === 'm') return audio.toggle()
  if (k === 'l') return toggleLang()
  if (k === 'p') { setPalette(PALETTES[(PALETTES.indexOf(palName) + 1) % PALETTES.length]); return resetGround() }
  if (ui.screen === 'title') {
    if (k === 'arrowright' || k === 'd') ui.hero = (ui.hero + 1) % HEROES.length
    if (k === 'arrowleft' || k === 'a') ui.hero = (ui.hero + HEROES.length - 1) % HEROES.length
    if (k === 'arrowdown' || k === 's' || k === 'arrowup' || k === 'w') ui.hero = (ui.hero + 5) % HEROES.length
    if (k === 'e') ui.stage = (ui.stage + 1) % STAGES.length
    if (k === 'q') ui.stage = (ui.stage + STAGES.length - 1) % STAGES.length
    if (k === 't') ui.tall = !ui.tall
    if (k === 'u') ui.screen = 'shop'
    if (k === 'enter' || k === ' ') return start()
    return audio.sfx('select')
  }
  if (ui.screen === 'shop') {
    const n = Object.keys(UPGRADES).length
    if (k === 'arrowright' || k === 'd' || k === 'arrowleft' || k === 'a') ui.shopSel ^= 1
    if (k === 'arrowdown' || k === 's') ui.shopSel = (ui.shopSel + 2) % n
    if (k === 'arrowup' || k === 'w') ui.shopSel = (ui.shopSel + n - 2) % n
    if (k === 'enter' || k === ' ') return buy()
    if (k === 'escape' || k === 'u') ui.screen = 'title'
    return audio.sfx('select')
  }
  if (!g) return
  if (g.choices) {
    if (/^[1-4]$/.test(k) && g.choices[Number(k) - 1]) return choose(g, g.choices[Number(k) - 1])
    if (k === 'r') return reroll(g)
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
  if (g.paused && k === 'q') return toTitle()
  if (k === ' ' || k === 'shift') g.wantDash = true
}
function toTitle() { ui.screen = 'title'; g = null; audio.music('title') }
function buy() {
  if (buyUpgrade(save, Object.keys(UPGRADES)[ui.shopSel])) { storeSave(save); audio.sfx('buy', undefined, 0.5) } else audio.sfx('error', undefined, 0.4)
}

function input() {
  if (demo) return autopilot(g)
  let dx = 0, dy = 0
  if (keys.has('arrowleft') || keys.has('a')) dx--
  if (keys.has('arrowright') || keys.has('d')) dx++
  if (keys.has('arrowup') || keys.has('w')) dy--
  if (keys.has('arrowdown') || keys.has('s')) dy++
  if (stick && Math.hypot(stick.dx, stick.dy) > 4) { dx = stick.dx; dy = stick.dy }
  return dx || dy ? [dx, dy] : null
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
    ui.boxes = drawTitle(ui, t, save)
    if (demo && ui.t > 2.5) { if (fixed('stage', STAGES) == null) ui.stage = Math.floor(Math.random() * STAGES.length); start() }
  } else if (ui.screen === 'shop') {
    ui.boxes = drawShop(save, ui.shopSel, t, STAGES[ui.stage])
  } else {
    if (g.choices && demo) autoChoose(g)
    step(g, dt, input())
    drawWorld(g, t)
    drawHud(g)
    ui.boxes = ui.touch && !g.choices && !g.over && !g.paused ? drawTouch(g, stick) : []
    if (g.choices) ui.boxes = drawChoices(g, ui.sel, t)
    else if (g.over) {
      if (!ui.result && !demo) { ui.result = bank(save, g); storeSave(save) } // once: the run goes in the books
      ui.boxes = drawOver(g, ui.result)
      if (demo && (g.overT = (g.overT ?? 0) + dt) > 5) { ui.t = 0; ui.hero = Math.floor(Math.random() * HEROES.length); ui.screen = 'title' }
    }
    else if (g.paused) ui.boxes = drawPause(g)
  }
}

function fit() {
  const s = Math.min(innerWidth / W, (innerHeight - 40) / H)
  const z = s >= 2 ? Math.floor(s) : s // whole pixels when there's room; on a phone, as big as it fits
  canvas.style.width = `${Math.round(W * z)}px`; canvas.style.height = `${Math.round(H * z)}px`
  const k = Math.max(1, Math.min(4, Math.ceil(z * (devicePixelRatio || 1)))) // device pixels to one game pixel
  canvas.width = W * k; canvas.height = H * k
  setContext(ctx, k)
}
addEventListener('resize', fit)
fit()
audio.music('title')
requestAnimationFrame(frame)
window.game = () => ({ ui, g }) // for tests and recordings
