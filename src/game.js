// The run: a hero, waves of monsters, weapons that fire by themselves, gems, level-ups, bosses.
// Pure simulation (no drawing): render.js draws whatever is in the game object, sfx() reports sounds.
import { HEROES, WEAPONS, PASSIVES, ENEMIES, RUN_SECONDS, xpFor } from './data.js'

const TAU = Math.PI * 2
const rnd = (a, b) => a + Math.random() * (b - a)
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2
const MAX_ENEMIES = 320

export function newGame(stage, heroId, { sfx = () => {} } = {}) {
  const hero = HEROES.find((h) => h.id === heroId)
  const g = {
    stage, hero, sfx, t: 0, over: false, won: false, lv: 1, xp: 0, next: xpFor(1), kills: 0, gold: 0, levels: 0, choices: null,
    p: { x: 0, y: 0, face: [1, 0], dir: 'right', moving: false, hp: hero.hp, inv: 0, hurt: 0 },
    stats: { might: 1, armor: 0, maxHp: hero.hp, haste: 0, area: 1, speed: 1, magnet: 1, crit: 0.05, growth: 1, regen: 0 },
    weapons: [], passives: {},
    enemies: [], shots: [], zones: [], fx: [], gems: [], drops: [], numbers: [],
    spawnT: 0, eliteT: 60, bossIndex: 0, boss: null, banner: null, shake: 0, grid: new Map(),
  }
  addWeapon(g, hero.weapon)
  return g
}

// ------------------------------------------------------------------ weapons and passives
export function addWeapon(g, id) {
  const have = g.weapons.find((w) => w.id === id)
  if (have) have.lv++
  else g.weapons.push({ id, def: WEAPONS[id], lv: 1, t: 0.3, spin: 0, cast: 0 })
}
export function addPassive(g, id) {
  const p = PASSIVES[id]
  g.passives[id] = (g.passives[id] ?? 0) + 1
  g.stats[p.stat] += p.step
  if (p.stat === 'maxHp') g.p.hp += p.step
}
const dmgOf = (g, w) => w.def.dmg * (1 + 0.25 * (w.lv - 1)) * g.stats.might
const cdOf = (g, w) => (w.def.cd * (1 - 0.06 * (w.lv - 1))) / (1 + g.stats.haste)
const amountOf = (w) => 1 + w.def.more.filter((l) => w.lv >= l).length
const areaOf = (g) => g.stats.area

/** Up to 3 (or 4 with luck) things to pick from at a level up. */
export function makeChoices(g) {
  const opts = []
  for (const w of g.weapons) if (w.lv < 5) opts.push({ type: 'w', id: w.id, lv: w.lv + 1, weight: 3 })
  if (g.weapons.length < 6) for (const id of Object.keys(WEAPONS)) if (!g.weapons.some((w) => w.id === id)) opts.push({ type: 'w', id, lv: 1, weight: 1 })
  const owned = Object.keys(g.passives)
  for (const id of owned) if (g.passives[id] < 5) opts.push({ type: 'p', id, lv: g.passives[id] + 1, weight: 2 })
  if (owned.length < 6) for (const id of Object.keys(PASSIVES)) if (!g.passives[id]) opts.push({ type: 'p', id, lv: 1, weight: 1 })
  const out = []
  const n = g.stats.crit > 0.2 ? 4 : 3
  while (out.length < n && opts.length) {
    let r = Math.random() * opts.reduce((s, o) => s + o.weight, 0), i = 0
    for (; i < opts.length - 1; i++) if ((r -= opts[i].weight) <= 0) break
    out.push(opts.splice(i, 1)[0])
  }
  if (!out.length) out.push({ type: 'heal' }, { type: 'gold' })
  return out
}
export function choose(g, c) {
  if (c.type === 'w') addWeapon(g, c.id)
  else if (c.type === 'p') addPassive(g, c.id)
  else if (c.type === 'heal') g.p.hp = g.stats.maxHp
  else g.gold += 25
  g.choices = null
  g.levels--
  g.sfx('equip')
}

// ------------------------------------------------------------------ hitting things
function damage(g, e, amount, { kx = 0, ky = 0, knock = 40, el } = {}) {
  if (e.dead) return
  const crit = Math.random() < g.stats.crit
  const n = Math.max(1, Math.round(amount * (crit ? 2 : 1)))
  e.hp -= n
  e.flash = 0.08
  if (!e.boss) { const l = Math.hypot(kx, ky) || 1; e.kx += (kx / l) * knock * (e.big ? 0.3 : 1); e.ky += (ky / l) * knock * (e.big ? 0.3 : 1) }
  if (g.numbers.length < 70) g.numbers.push({ x: e.x + rnd(-4, 4), y: e.y - (e.big ? 34 : 18), n, crit, t: 0 })
  g.sfx(crit ? 'crit' : 'hit', el ? { element: el } : undefined, 0.18)
  if (e.hp <= 0) kill(g, e)
}
function kill(g, e) {
  e.dead = true
  g.kills++
  const v = e.xp
  g.gems.push({ x: e.x, y: e.y - 4, v, pull: false })
  if (e.big || e.boss) {
    g.drops.push({ kind: 'chest', x: e.x, y: e.y })
    g.fx.push({ name: 'boom', opts: { size: 64 }, x: e.x, y: e.y - 12, t: 0 })
    g.shake = Math.max(g.shake, e.boss ? 0.6 : 0.25)
    g.sfx(e.boss ? 'boom' : 'death', undefined, 0.5)
  } else {
    if (g.fx.length < 80) g.fx.push({ name: 'poof', opts: { size: 24 }, x: e.x, y: e.y - 8, t: 0 })
    g.sfx('death', undefined, 0.12)
    const r = Math.random()
    if (r < 0.006) g.drops.push({ kind: 'meat', x: e.x, y: e.y })
    else if (r < 0.008) g.drops.push({ kind: 'compass', x: e.x, y: e.y })
    else if (r < 0.02) g.drops.push({ kind: 'coin', x: e.x, y: e.y })
  }
  if (e.boss) {
    g.boss = null
    if (e.final) { g.won = true; g.over = true; g.sfx('fanfare', undefined, 0.6) }
    else g.banner = { text: `${e.name} FALLS`, t: 0 }
  }
}

// a grid of who is where, so finding neighbors is cheap with hundreds of monsters
const CELL = 32
const cellKey = (x, y) => ((Math.floor(x / CELL) & 0xffff) << 16) | (Math.floor(y / CELL) & 0xffff)
function rebuildGrid(g) {
  g.grid.clear()
  for (const e of g.enemies) {
    const k = cellKey(e.x, e.y)
    let c = g.grid.get(k)
    if (!c) g.grid.set(k, (c = []))
    c.push(e)
  }
}
export function near(g, x, y, r, fn) {
  const r2 = r * r
  for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++) {
    for (let cy = Math.floor((y - r) / CELL); cy <= Math.floor((y + r) / CELL); cy++) {
      const c = g.grid.get(((cx & 0xffff) << 16) | (cy & 0xffff))
      if (c) for (const e of c) if (!e.dead && (e.x - x) ** 2 + (e.y - y) ** 2 <= (r + e.r) ** 2 && r2 >= 0) fn(e)
    }
  }
}
function nearest(g, x, y, n = 1, max = 220) {
  const list = []
  near(g, x, y, max, (e) => list.push(e))
  return list.sort((a, b) => dist2(a, { x, y }) - dist2(b, { x, y })).slice(0, n)
}
const onScreen = (g, e) => Math.abs(e.x - g.p.x) < 200 && Math.abs(e.y - g.p.y) < 115

// ------------------------------------------------------------------ what each kind of weapon does
function fire(g, w) {
  const p = g.p, def = w.def, dmg = dmgOf(g, w), n = amountOf(w), area = areaOf(g)
  const [fx0, fy0] = p.face
  const angle0 = Math.atan2(fy0, fx0)
  switch (def.kind) {
    case 'arc': { // a blade at the nearest foe in reach, or in front (then behind, then the sides)
      const dirs = [0, Math.PI, Math.PI / 2, -Math.PI / 2]
      const close = nearest(g, p.x, p.y, 1, (def.long ?? def.reach * 2.5) * area)[0]
      const aim = close ? Math.atan2(close.y - p.y, close.x - p.x) : angle0
      for (let i = 0; i < n; i++) {
        const a = aim + dirs[i % 4], dx = Math.cos(a), dy = Math.sin(a)
        if (def.long) { // a spear: everything along a line
          const len = def.long * area
          for (let s = 8; s <= len; s += 10) near(g, p.x + dx * s, p.y - 6 + dy * s, 9 * area, (e) => { if (e.hitStamp !== g.t) { e.hitStamp = g.t; damage(g, e, dmg, { kx: dx, ky: dy }) } })
          g.fx.push({ name: def.fx, opts: { size: 48 }, x: p.x + dx * len * 0.5, y: p.y - 6 + dy * len * 0.5, rot: a, t: -i * 0.08, scaleX: len / 40 })
        } else {
          const cx = p.x + dx * def.reach * area, cy = p.y - 6 + dy * def.reach * area
          near(g, cx, cy, (def.size / 2) * area, (e) => damage(g, e, dmg, { kx: dx, ky: dy }))
          g.fx.push({ name: def.fx, opts: { size: Math.round(def.size * area) + 8 }, x: cx, y: cy, rot: a, t: -i * 0.08 })
        }
      }
      g.sfx(def.fx === 'thrust' ? 'thrust' : def.fx === 'stab' ? 'stab' : 'slash', undefined, 0.25)
      return
    }
    case 'slam': {
      const r = def.radius * area * (1 + 0.1 * (w.lv - 1))
      near(g, p.x, p.y, r, (e) => damage(g, e, dmg, { kx: e.x - p.x, ky: e.y - p.y, knock: 120 }))
      g.fx.push({ name: def.fx, opts: { size: Math.round(r * 2) }, x: p.x, y: p.y - 4, t: 0 }, { name: 'smash', opts: { size: 40 }, x: p.x + fx0 * 10, y: p.y - 6, t: 0 })
      g.shake = Math.max(g.shake, 0.15)
      g.sfx('quake', undefined, 0.35)
      return
    }
    case 'shot': {
      const targets = nearest(g, p.x, p.y, n)
      for (let i = 0; i < n; i++) {
        const t = targets[i] ?? targets[0]
        const a = t ? Math.atan2(t.y - 6 - (p.y - 8), t.x - p.x) : angle0 + (i - (n - 1) / 2) * 0.3
        g.shots.push({ kind: 'shot', x: p.x, y: p.y - 8, vx: Math.cos(a) * def.speed, vy: Math.sin(a) * def.speed, dmg, pierce: def.pierce + Math.floor((w.lv - 1) / 2), life: 2, hit: new Set(), name: def.fx, opts: { size: 20, ...(def.el ? { element: def.el } : {}) }, homing: def.homing ? t : null, el: def.el, delay: i * 0.06 })
      }
      g.sfx(def.fx === 'arrow' ? 'shoot' : 'magic', undefined, 0.2)
      return
    }
    case 'ring': {
      const count = def.count + n - 1
      w.spin += 0.4
      for (let i = 0; i < count; i++) {
        const a = w.spin + (i / count) * TAU
        g.shots.push({ kind: 'shot', x: p.x, y: p.y - 8, vx: Math.cos(a) * def.speed, vy: Math.sin(a) * def.speed, dmg, pierce: def.pierce, life: 1.4, hit: new Set(), name: def.fx, opts: { size: 16 }, spinRot: true })
      }
      g.sfx('throw', undefined, 0.2)
      return
    }
    case 'boomerang': {
      for (let i = 0; i < n; i++) {
        const t = nearest(g, p.x, p.y, n)[i]
        const a = t ? Math.atan2(t.y - p.y, t.x - p.x) : angle0 + i * 0.6
        g.shots.push({ kind: 'boomerang', x: p.x, y: p.y - 8, vx: Math.cos(a) * def.speed, vy: Math.sin(a) * def.speed, dmg, life: 2.4, age: 0, hitAt: new Map(), sprite: def.icon })
      }
      g.sfx('throw', undefined, 0.25)
      return
    }
    case 'strike': {
      const pool = g.enemies.filter((e) => !e.dead && onScreen(g, e))
      for (let i = 0; i < n && pool.length; i++) {
        const e = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]
        g.zones.push({ kind: 'strike', x: e.x, y: e.y, r: def.radius * area, dmg, delay: def.delay ?? 0.12, life: (def.delay ?? 0.12) + 0.05, done: false, el: def.el })
        g.fx.push({ name: def.fx, opts: { size: def.size ?? (def.fx === 'holy-beam' ? 48 : 40), ...(def.el && def.fx !== 'meteor' ? { element: def.el } : def.fx === 'meteor' ? { element: 'fire' } : {}) }, x: e.x, y: e.y - (def.fx === 'meteor' ? 16 : 20), t: -i * 0.05 })
      }
      g.sfx(def.fx === 'meteor' ? 'meteor' : def.fx === 'holy-beam' ? 'holy' : 'zap', undefined, 0.3)
      return
    }
    case 'orbit': return // always on: handled every frame
    case 'aura': {
      const r = def.radius * area * (1 + 0.12 * (w.lv - 1))
      near(g, p.x, p.y - 6, r, (e) => damage(g, e, dmg, { kx: e.x - p.x, ky: e.y - p.y, knock: 10, el: def.el }))
      return
    }
    case 'nova': {
      const r = def.radius * area * (1 + 0.12 * (w.lv - 1))
      near(g, p.x, p.y - 6, r, (e) => { damage(g, e, dmg, { kx: e.x - p.x, ky: e.y - p.y, knock: 60, el: def.el }); e.slow = 2 })
      g.fx.push({ name: def.fx, opts: { size: Math.round(r * 2), element: 'ice' }, x: p.x, y: p.y - 6, t: 0 })
      g.sfx('ice', undefined, 0.3)
      return
    }
    case 'tornado': {
      for (let i = 0; i < n; i++) {
        const a = rnd(0, TAU)
        g.zones.push({ kind: 'tornado', x: p.x, y: p.y - 6, vx: Math.cos(a) * def.speed, vy: Math.sin(a) * def.speed, r: 14 * area, dmg, life: def.life, tick: 0.35, hitAt: new Map(), fx: { name: def.fx, opts: { size: 40 } } })
      }
      g.sfx('wind', undefined, 0.25)
      return
    }
    case 'pool': {
      for (let i = 0; i < n; i++) {
        const t = pick(g.enemies.filter((e) => !e.dead && onScreen(g, e))) ?? { x: p.x + fx0 * 40, y: p.y + fy0 * 40 }
        g.zones.push({ kind: 'pool', x: t.x, y: t.y, r: def.radius * area, dmg, life: def.life + 0.3 * w.lv, tick: 0.5, hitAt: new Map(), el: def.el, fx: { name: def.fx, opts: { size: Math.round(def.radius * area * 2), element: 'poison' } } })
      }
      g.sfx('poison', undefined, 0.25)
      return
    }
    case 'bomb': {
      for (let i = 0; i < n; i++) {
        const t = pick(g.enemies.filter((e) => !e.dead && onScreen(g, e)))
        const tx = t ? t.x : p.x + rnd(-80, 80), ty = t ? t.y : p.y + rnd(-50, 50)
        g.shots.push({ kind: 'bomb', x: p.x, y: p.y - 10, sx: p.x, sy: p.y - 10, tx, ty, age: 0, flight: 0.55, dmg, r: def.radius * area, sprite: 'bomb' })
      }
      g.sfx('throw', undefined, 0.25)
      return
    }
    case 'breath': {
      g.zones.push({ kind: 'breath', x: p.x, y: p.y, r: def.reach * area, dmg, life: def.life + 0.15 * w.lv, tick: 0.2, hitAt: new Map(), el: def.el, follow: true })
      g.sfx('fire', undefined, 0.35)
      return
    }
    case 'hole': {
      g.zones.push({ kind: 'hole', x: p.x + fx0 * 60, y: p.y + fy0 * 60, r: def.radius * area, dmg, life: def.life + 0.4 * w.lv, tick: 0.3, hitAt: new Map(), el: def.el, fx: { name: def.fx, opts: { size: 56 } } })
      g.sfx('portal', undefined, 0.3)
    }
  }
}

// ------------------------------------------------------------------ monsters arrive
function spawn(g, kind, at) {
  const def = ENEMIES[kind], t = g.t
  const a = at ?? rnd(0, TAU), d = 240
  const x = g.p.x + Math.cos(a) * d * 1.05, y = g.p.y + Math.sin(a) * d * 0.7
  const hpMul = def.boss ? 1 : 1 + t / 170
  g.enemies.push({
    kind, def, x, y, hp: def.hp * hpMul, maxHp: def.hp * hpMul, speed: def.speed * (1 + t / 900) * rnd(0.9, 1.1), dmg: def.dmg, xp: def.xp,
    r: def.big ? 14 : 7, kx: 0, ky: 0, flash: 0, slow: 0, dir: 'left', big: !!def.big, boss: !!def.boss, final: !!def.final, name: def.boss,
  })
  return g.enemies.at(-1)
}
function spawning(g, dt) {
  const st = g.stage, t = g.t
  // the bosses
  const next = st.bosses[g.bossIndex]
  if (next && t >= next[0] && !g.boss) {
    g.bossIndex++
    g.boss = spawn(g, next[1])
    g.banner = { text: ENEMIES[next[1]].boss, t: 0, warn: true }
    g.sfx('roar', undefined, 0.6)
  }
  // an elite every minute
  g.eliteT -= dt
  if (g.eliteT <= 0) { g.eliteT = 55; spawn(g, pick(st.elites)) }
  // a ring closing in, twice a run
  for (const at of [130, 330]) if (t - dt < at && t >= at) for (let i = 0; i < 36; i++) spawn(g, st.waves.findLast((wv) => wv[0] <= t)[1][0], (i / 36) * TAU)
  // the rest, faster and in bigger groups as time goes on
  g.spawnT -= dt
  if (g.spawnT > 0 || g.enemies.length >= MAX_ENEMIES) return
  g.spawnT = Math.max(0.1, 0.85 - t / 320)
  const kinds = st.waves.findLast((wv) => wv[0] <= t)[1]
  const n = 1 + Math.floor(t / 80)
  const a = rnd(0, TAU)
  for (let i = 0; i < n; i++) spawn(g, pick(kinds), a + rnd(-0.4, 0.4))
}

// ------------------------------------------------------------------ one step of the world
export function step(g, dt, move) {
  if (g.over || g.choices || g.paused) return
  g.t += dt
  const p = g.p, s = g.stats
  // the hero
  p.moving = !!move
  if (move) {
    const l = Math.hypot(move[0], move[1]) || 1, sp = g.hero.speed * s.speed
    p.x += (move[0] / l) * sp * dt; p.y += (move[1] / l) * sp * dt
    p.face = [move[0] / l, move[1] / l]
    const a = Math.atan2(move[1], move[0])
    p.dir = ['right', 'down-right', 'down', 'down-left', 'left', 'up-left', 'up', 'up-right'][(Math.round(a / (Math.PI / 4)) + 8) % 8]
  }
  p.inv = Math.max(0, p.inv - dt)
  p.hurt = Math.max(0, p.hurt - dt)
  if (s.regen) p.hp = Math.min(s.maxHp, p.hp + s.regen * dt)
  spawning(g, dt)
  rebuildGrid(g)
  // monsters walk at you, get pushed back when hit, and don't pile onto one spot
  for (const e of g.enemies) {
    if (e.dead) continue
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1
    const sp = e.speed * (e.slow > 0 ? 0.45 : 1)
    e.slow = Math.max(0, e.slow - dt)
    e.x += (dx / d) * sp * dt + e.kx * dt; e.y += (dy / d) * sp * dt + e.ky * dt
    e.kx *= Math.pow(0.02, dt); e.ky *= Math.pow(0.02, dt)
    e.flash = Math.max(0, e.flash - dt)
    e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
    if (d > 420 && !e.boss) { e.x = p.x - dx * 0.95; e.y = p.y - dy * 0.95 } // fell too far behind: come round the other side
    if (d < e.r + 6 && p.inv <= 0) {
      const n = Math.max(1, Math.round(e.dmg * Math.min(1.6, 0.5 + g.t / 300)) - s.armor) // gentle at first, harder later
      p.hp -= n; p.inv = 0.6; p.hurt = 0.2
      g.numbers.push({ x: p.x, y: p.y - 26, n, hurt: true, t: 0 })
      g.shake = Math.max(g.shake, 0.12)
      g.sfx('hurt', undefined, 0.35)
      if (p.hp <= 0) { p.hp = 0; g.over = true; g.sfx('lose', undefined, 0.6) }
    }
  }
  for (const [, c] of g.grid) { // a little push apart within each cell
    if (c.length < 2) continue
    for (let i = 0; i < c.length; i++) for (let j = i + 1; j < Math.min(c.length, i + 5); j++) {
      const a = c[i], b = c[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01, min = a.r + b.r - 2
      if (d < min) { const push = (min - d) / 2; a.x -= (dx / d) * push; a.y -= (dy / d) * push; b.x += (dx / d) * push; b.y += (dy / d) * push }
    }
  }
  // weapons
  for (const w of g.weapons) {
    if (w.def.kind === 'orbit') { orbit(g, w, dt); continue }
    if (w.def.kind === 'aura') w.glow = (w.glow ?? 0) + dt
    w.t -= dt
    if (w.t <= 0) { w.t = cdOf(g, w); fire(g, w) }
  }
  moveShots(g, dt)
  zones(g, dt)
  // gems come to you
  const mag = 46 * s.magnet
  for (const gem of g.gems) {
    const dx = p.x - gem.x, dy = p.y - 6 - gem.y, d = Math.hypot(dx, dy)
    if (d < mag || gem.pull) { gem.pull = true; const sp = 140 + (gem.age = (gem.age ?? 0) + dt) * 200; gem.x += (dx / d) * sp * dt; gem.y += (dy / d) * sp * dt }
    if (d < 8) { gem.got = true; g.xp += gem.v * s.growth; g.sfx('gem', undefined, 0.12) }
  }
  g.gems = g.gems.filter((x) => !x.got)
  if (g.gems.length > 500) { const merged = g.gems.splice(0, 200); g.gems.push({ x: merged[0].x, y: merged[0].y, v: merged.reduce((s2, x) => s2 + x.v, 0) }) }
  while (g.xp >= g.next) { g.xp -= g.next; g.lv++; g.next = xpFor(g.lv); g.levels++; g.sfx('levelup', undefined, 0.5) }
  for (const d of g.drops) {
    if (Math.hypot(p.x - d.x, p.y - d.y) > 14) continue
    d.got = true
    if (d.kind === 'meat') { p.hp = Math.min(s.maxHp, p.hp + 30); g.sfx('heal', undefined, 0.4) }
    if (d.kind === 'compass') { for (const gem of g.gems) gem.pull = true; g.sfx('powerup', undefined, 0.4) }
    if (d.kind === 'coin') { g.gold += 5; g.sfx('coin', undefined, 0.3) }
    if (d.kind === 'chest') { g.levels++; g.gold += 20; g.sfx('chest', undefined, 0.5) }
  }
  g.drops = g.drops.filter((d) => !d.got)
  if (g.levels > 0 && !g.choices && !g.over) g.choices = makeChoices(g)
  g.enemies = g.enemies.filter((e) => !e.dead)
  for (const n of g.numbers) n.t += dt
  g.numbers = g.numbers.filter((n) => n.t < 0.7)
  for (const f of g.fx) f.t += dt
  g.shake = Math.max(0, g.shake - dt)
  if (g.banner) { g.banner.t += dt; if (g.banner.t > 3) g.banner = null }
  if (g.t > RUN_SECONDS + 120 && !g.boss) { g.won = true; g.over = true } // nobody left to fight: you made it
}

function orbit(g, w, dt) {
  const def = w.def, n = amountOf(w), r = def.radius * areaOf(g), dmg = dmgOf(g, w)
  w.spin += dt * def.spin
  w.points = []
  for (let i = 0; i < n; i++) {
    const a = w.spin + (i / n) * TAU, x = g.p.x + Math.cos(a) * r, y = g.p.y - 8 + Math.sin(a) * r * 0.8
    w.points.push([x, y, a])
    near(g, x, y, 8, (e) => {
      const key = w.id + i
      if ((e.hitAt?.[key] ?? -9) > g.t - 0.4) return
      ;(e.hitAt ??= {})[key] = g.t
      damage(g, e, dmg, { kx: e.x - g.p.x, ky: e.y - g.p.y, knock: 50 })
    })
  }
}

function moveShots(g, dt) {
  for (const s of g.shots) {
    if (s.delay > 0) { s.delay -= dt; continue }
    if (s.kind === 'bomb') {
      s.age += dt
      const k = Math.min(1, s.age / s.flight)
      s.x = s.sx + (s.tx - s.sx) * k; s.y = s.sy + (s.ty - s.sy) * k - Math.sin(k * Math.PI) * 30
      if (k >= 1) {
        s.done = true
        near(g, s.tx, s.ty, s.r, (e) => damage(g, e, s.dmg, { kx: e.x - s.tx, ky: e.y - s.ty, knock: 90, el: 'fire' }))
        g.fx.push({ name: 'boom', opts: { size: Math.round(s.r * 2) }, x: s.tx, y: s.ty - 6, t: 0 })
        g.shake = Math.max(g.shake, 0.1)
        g.sfx('boom', undefined, 0.3)
      }
      continue
    }
    if (s.kind === 'boomerang') {
      s.age += dt
      if (s.age > 0.55) { const dx = g.p.x - s.x, dy = g.p.y - 8 - s.y, d = Math.hypot(dx, dy) || 1; s.vx += (dx / d) * 600 * dt; s.vy += (dy / d) * 600 * dt; if (d < 10 && s.age > 0.8) s.done = true }
      const sp = Math.hypot(s.vx, s.vy); if (sp > 220) { s.vx *= 220 / sp; s.vy *= 220 / sp }
    }
    if (s.homing && !s.homing.dead) { const dx = s.homing.x - s.x, dy = s.homing.y - 6 - s.y, d = Math.hypot(dx, dy) || 1, sp = Math.hypot(s.vx, s.vy); s.vx += ((dx / d) * sp - s.vx) * Math.min(1, dt * 6); s.vy += ((dy / d) * sp - s.vy) * Math.min(1, dt * 6) }
    s.x += s.vx * dt; s.y += s.vy * dt
    s.life -= dt
    if (s.life <= 0) s.done = true
    near(g, s.x, s.y + 6, 5, (e) => {
      if (s.done) return
      if (s.kind === 'boomerang') { if ((s.hitAt.get(e) ?? -9) > g.t - 0.4) return; s.hitAt.set(e, g.t) } else { if (s.hit.has(e)) return; s.hit.add(e) }
      damage(g, e, s.dmg, { kx: s.vx, ky: s.vy, el: s.el })
      if (s.kind === 'shot' && --s.pierce < 0) s.done = true
    })
  }
  g.shots = g.shots.filter((s) => !s.done)
}

function zones(g, dt) {
  for (const z of g.zones) {
    z.life -= dt
    if (z.kind === 'strike') {
      z.delay -= dt
      if (z.delay <= 0 && !z.done) { z.done = true; near(g, z.x, z.y, z.r, (e) => damage(g, e, z.dmg, { kx: e.x - z.x, ky: e.y - z.y, knock: 60, el: z.el })) }
      continue
    }
    if (z.follow) { z.x = g.p.x; z.y = g.p.y; z.face = g.p.face }
    if (z.kind === 'tornado') { z.vx += rnd(-80, 80) * dt; z.vy += rnd(-80, 80) * dt; z.x += z.vx * dt; z.y += z.vy * dt }
    const hit = (e) => { if ((z.hitAt.get(e) ?? -9) > g.t - z.tick) return; z.hitAt.set(e, g.t); damage(g, e, z.dmg, { kx: e.x - z.x, ky: e.y - z.y, knock: z.kind === 'hole' ? 0 : 20, el: z.el }) }
    if (z.kind === 'breath') { // a cone in front of you
      const [fx, fy] = g.p.face
      near(g, z.x + fx * z.r * 0.6, z.y - 6 + fy * z.r * 0.6, z.r * 0.6, hit)
    } else near(g, z.x, z.y, z.r, (e) => {
      if (z.kind === 'hole' && !e.boss) { const dx = z.x - e.x, dy = z.y - e.y, d = Math.hypot(dx, dy) || 1; e.x += (dx / d) * 70 * dt; e.y += (dy / d) * 70 * dt }
      hit(e)
    })
  }
  g.zones = g.zones.filter((z) => z.life > 0)
}
