// The run: a hero, waves of monsters, weapons that fire by themselves, gems, level-ups, bosses.
// Pure simulation (no drawing): render.js draws whatever is in the game object, sfx() reports sounds.
import { HEROES, WEAPONS, PASSIVES, EVOLUTIONS, ENEMIES, DASH, RUN_SECONDS, xpFor } from './data.js'

const TAU = Math.PI * 2
const rnd = (a, b) => a + Math.random() * (b - a)
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2
const MAX_ENEMIES = 320

export function newGame(stage, heroId, { sfx = () => {} } = {}) {
  const hero = HEROES.find((h) => h.id === heroId)
  const g = {
    stage, hero, sfx, t: 0, over: false, won: false, lv: 1, xp: 0, next: xpFor(1), kills: 0, gold: 0, levels: 0, choices: null, rerolls: 2,
    p: { x: 0, y: 0, face: [1, 0], dir: 'down', moving: false, hp: hero.hp, inv: 0, hurt: 0, blink: 0, dashT: 0, dashCd: 0, dashDir: [1, 0], trail: [] },
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
const amountOf = (w) => (w.def.count ?? 1) + w.def.more.filter((l) => w.lv >= l).length
const areaOf = (g) => g.stats.area

/** The evolution a weapon is ready for (level 5, not evolved yet, its passive held), or null. */
export function evolutionFor(g, w) {
  const evo = EVOLUTIONS[w.id]
  return evo && !w.evo && w.lv >= 5 && g.passives[evo.needs] ? evo : null
}
export function evolve(g, id) {
  const w = g.weapons.find((x) => x.id === id), evo = EVOLUTIONS[id]
  if (!w || !evo || w.evo) return
  Object.assign(w, { def: evo.def, evo: true, t: 0.2, spin: 0, points: null })
  g.banner = { text: evo.def.name, t: 0, sub: 'WEAPON EVOLVED' }
  g.fx.push({ name: 'sparkle-burst', opts: { size: 64, element: 'holy' }, x: g.p.x, y: g.p.y - 10, t: 0 })
  g.shake = Math.max(g.shake, 0.2)
  g.sfx('fanfare', undefined, 0.5)
}

/** Up to 3 (or 4 with luck) things to pick from at a level up. */
export function makeChoices(g) {
  const opts = []
  const ready = g.weapons.find((w) => evolutionFor(g, w)) // an evolution is always offered once it's possible
  for (const w of g.weapons) if (w.lv < 5) opts.push({ type: 'w', id: w.id, lv: w.lv + 1, weight: 3 })
  if (g.weapons.length < 6) for (const id of Object.keys(WEAPONS)) if (!g.weapons.some((w) => w.id === id)) opts.push({ type: 'w', id, lv: 1, weight: 1 })
  const owned = Object.keys(g.passives)
  for (const id of owned) if (g.passives[id] < 5) opts.push({ type: 'p', id, lv: g.passives[id] + 1, weight: 2 })
  if (owned.length < 6) for (const id of Object.keys(PASSIVES)) if (!g.passives[id]) opts.push({ type: 'p', id, lv: 1, weight: 1 })
  const out = ready ? [{ type: 'evo', id: ready.id }] : []
  const n = g.stats.crit > 0.2 ? 4 : 3
  while (out.length < n && opts.length) {
    let r = Math.random() * opts.reduce((s, o) => s + o.weight, 0), i = 0
    for (; i < opts.length - 1; i++) if ((r -= opts[i].weight) <= 0) break
    out.push(opts.splice(i, 1)[0])
  }
  if (!out.length) out.push({ type: 'heal' }, { type: 'gold' })
  return out
}
/** Deal the level-up cards again (a few times a run). */
export function reroll(g) {
  if (!g.choices || g.rerolls <= 0) return false
  g.rerolls--
  g.choices = makeChoices(g)
  g.sfx('switch', undefined, 0.4)
  return true
}
export function choose(g, c) {
  if (c.type === 'evo') evolve(g, c.id)
  else if (c.type === 'w') addWeapon(g, c.id)
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
      let angles = Array.from({ length: n }, (_, i) => aim + dirs[i % 4])
      if (def.fan) angles = Array.from({ length: def.fan }, (_, i) => aim + (i - (def.fan - 1) / 2) * 0.3) // thrusts side by side
      if (def.star) { w.spin = (w.spin + Math.PI / def.star) % TAU; angles = Array.from({ length: def.star }, (_, i) => w.spin + (i / def.star) * TAU) } // all round, turning a little each time
      for (const [i, a] of angles.entries()) {
        const dx = Math.cos(a), dy = Math.sin(a)
        if (def.long) { // a spear: everything along a line
          const len = def.long * area
          for (let s = 8; s <= len; s += 10) near(g, p.x + dx * s, p.y - 6 + dy * s, 9 * area, (e) => { if (e.hitStamp !== g.t) { e.hitStamp = g.t; damage(g, e, dmg, { kx: dx, ky: dy }) } })
          g.fx.push({ name: def.fx, opts: { size: 48 }, x: p.x + dx * len * 0.5, y: p.y - 6 + dy * len * 0.5, rot: a, t: def.star ? 0 : -i * 0.05, scaleX: len / 40 })
        } else {
          const cx = p.x + dx * def.reach * area, cy = p.y - 6 + dy * def.reach * area
          near(g, cx, cy, (def.size / 2) * area, (e) => damage(g, e, dmg, { kx: dx, ky: dy }))
          g.fx.push({ name: def.fx, opts: { size: Math.round(def.size * area) + 8 }, x: cx, y: cy, rot: a, t: -i * 0.08 })
          if (def.wave) g.shots.push({ kind: 'shot', x: cx, y: cy, vx: dx * 170, vy: dy * 170, dmg: dmg * 0.7, pierce: 99, life: 0.9, hit: new Set(), name: 'wave', opts: { size: 32 }, wide: 10, delay: i * 0.08 }) // a crescent flies on
        }
      }
      g.sfx(def.fx === 'thrust' ? 'thrust' : def.fx === 'stab' ? 'stab' : 'slash', undefined, 0.25)
      return
    }
    case 'slam': {
      const r = def.radius * area * (1 + 0.1 * (w.lv - 1))
      near(g, p.x, p.y, r, (e) => damage(g, e, dmg, { kx: e.x - p.x, ky: e.y - p.y, knock: 120 }))
      g.fx.push({ name: def.fx, opts: { size: Math.round(r * 2) }, x: p.x, y: p.y - 4, t: 0 }, { name: 'smash', opts: { size: 40 }, x: p.x + fx0 * 10, y: p.y - 6, t: 0 })
      if (def.aftershock) { // a second, wider ring a moment later
        g.zones.push({ kind: 'strike', x: p.x, y: p.y, r: r * 1.7, dmg: dmg * 0.6, delay: 0.3, life: 0.4, done: false, knock: 90 })
        g.fx.push({ name: 'shockwave', opts: { size: Math.round(r * 3.4), element: 'fire' }, x: p.x, y: p.y - 4, t: -0.22 })
      }
      if (def.geysers) { // and the ground erupts under a few of them
        const pool = g.enemies.filter((e) => !e.dead && onScreen(g, e))
        for (let i = 0; i < def.geysers && pool.length; i++) {
          const e = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]
          g.zones.push({ kind: 'strike', x: e.x, y: e.y, r: 22 * area, dmg, delay: 0.3 + i * 0.1, life: 0.6, done: false, el: 'fire' })
          g.fx.push({ name: 'geyser', opts: { size: 48, element: 'fire' }, x: e.x, y: e.y - 18, t: -i * 0.1 })
        }
      }
      g.shake = Math.max(g.shake, 0.15)
      g.sfx('quake', undefined, 0.35)
      return
    }
    case 'shot': {
      const total = def.spread ?? def.burst ?? n
      const targets = nearest(g, p.x, p.y, total)
      const aim = targets[0] ? Math.atan2(targets[0].y - 6 - (p.y - 8), targets[0].x - p.x) : angle0
      for (let i = 0; i < total; i++) {
        const t = targets[i % Math.max(1, targets.length)]
        let a = t ? Math.atan2(t.y - 6 - (p.y - 8), t.x - p.x) : angle0 + (i - (n - 1) / 2) * 0.3
        if (def.spread) a = aim + (i - (total - 1) / 2) * 0.13 // a fan at the nearest
        if (def.burst) a = (i / total) * TAU + g.t // out in a ring, then each finds someone
        g.shots.push({ kind: 'shot', x: p.x, y: p.y - 8, vx: Math.cos(a) * def.speed, vy: Math.sin(a) * def.speed, dmg, pierce: def.pierce + Math.floor((w.lv - 1) / 2), life: 2, hit: new Set(), name: def.fx, opts: { size: 20, ...(def.el ? { element: def.el } : {}) }, homing: def.homing ? t : null, homeAfter: def.burst ? 0.18 : 0, spinRot: def.fx === 'spinner', el: def.el, delay: def.spread || def.burst ? 0 : i * 0.06 })
      }
      g.sfx(def.fx === 'arrow' ? 'shoot' : 'magic', undefined, 0.2)
      return
    }
    case 'ring': {
      const count = n
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
        g.shots.push({ kind: 'boomerang', x: p.x, y: p.y - 8, vx: Math.cos(a) * def.speed, vy: Math.sin(a) * def.speed, dmg, life: 2.4, age: 0, hitAt: new Map(), sprite: def.icon, wide: def.wide, gems: def.gems, scale: def.wide ? 2 : 1 })
      }
      g.sfx('throw', undefined, 0.25)
      return
    }
    case 'strike': {
      const pool = g.enemies.filter((e) => !e.dead && onScreen(g, e))
      for (let i = 0; i < n && pool.length; i++) {
        const e = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]
        g.zones.push({ kind: 'strike', x: e.x, y: e.y, r: def.radius * area, dmg, delay: def.delay ?? 0.12, life: (def.delay ?? 0.12) + 0.05, done: false, el: def.el, chain: def.chain, seen: def.chain ? new Set([e]) : null })
        g.fx.push({ name: def.fx, opts: { size: def.size ?? (def.fx === 'holy-beam' ? 48 : 40), ...(def.el && def.fx !== 'meteor' ? { element: def.el } : def.fx === 'meteor' ? { element: 'fire' } : {}) }, x: e.x, y: e.y - (def.fx === 'meteor' ? 16 : 20), t: -i * 0.05 })
        if (def.field && i === 0) g.zones.push({ kind: 'pool', x: e.x, y: e.y, r: 24 * area, dmg: dmg * 0.3, life: 1.6, tick: 0.4, hitAt: new Map(), el: def.el, fx: { name: 'electric-field', opts: { size: Math.round(48 * area) } } })
      }
      g.sfx(def.fx === 'meteor' ? 'meteor' : def.fx === 'holy-beam' ? 'holy' : 'zap', undefined, 0.3)
      return
    }
    case 'orbit': case 'sweep': return // always on: handled every frame
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
  const hpMul = def.boss ? 1 : 1 + t / 260
  g.enemies.push({
    kind, def, x, y, hp: def.hp * hpMul, maxHp: def.hp * hpMul, speed: def.speed * (1 + t / 900) * rnd(0.9, 1.1), dmg: def.dmg, xp: def.xp,
    r: def.big ? 14 : 7, kx: 0, ky: 0, flash: 0, slow: 0, dir: 'left', big: !!def.big, boss: !!def.boss, final: !!def.final, name: def.boss,
  })
  return g.enemies.at(-1)
}
/** Monsters a second, t seconds into a run. */
export const spawnRate = (t) => 0.9 + t / 45
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
  // the rest: more of them every minute (about one a second at first, ten a second at the end), in growing groups
  g.spawnAcc = (g.spawnAcc ?? 1) + spawnRate(t) * dt
  const n = 2 + Math.floor(t / 90)
  if (g.spawnAcc < n || g.enemies.length >= MAX_ENEMIES) return
  g.spawnAcc -= n
  const kinds = st.waves.findLast((wv) => wv[0] <= t)[1]
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
  // the dash: a burst the way you're going (or facing), untouchable while it lasts
  p.dashCd = Math.max(0, p.dashCd - dt)
  if (g.wantDash) {
    g.wantDash = false
    if (p.dashCd <= 0 && p.dashT <= 0) {
      const l = move ? Math.hypot(move[0], move[1]) || 1 : 1
      p.dashDir = move ? [move[0] / l, move[1] / l] : p.face
      p.dashT = DASH.time; p.dashCd = DASH.cd * (g.dashCdMul ?? 1)
      p.inv = Math.max(p.inv, DASH.time + 0.12)
      g.fx.push({ name: 'dust', opts: { size: 24 }, x: p.x, y: p.y - 4, t: 0 })
      g.sfx('dash', undefined, 0.35)
    }
  }
  if (p.dashT > 0) {
    p.dashT = Math.max(0, p.dashT - dt)
    const sp = g.hero.speed * s.speed * DASH.speed
    p.x += p.dashDir[0] * sp * dt; p.y += p.dashDir[1] * sp * dt
    p.trail.push({ x: p.x, y: p.y, t: g.t })
    move = null // the dash carries you
  }
  p.trail = p.trail.filter((q) => g.t - q.t < 0.25)
  if (move) {
    const l = Math.hypot(move[0], move[1]) || 1, sp = g.hero.speed * s.speed
    p.x += (move[0] / l) * sp * dt; p.y += (move[1] / l) * sp * dt
    p.face = [move[0] / l, move[1] / l]
    // which way the hero is drawn: the side view whenever it moves sideways at all (diagonals included), so it
    // always looks where it goes; the front or back view only when it walks almost straight down or up
    p.dir = Math.abs(move[0]) >= Math.abs(move[1]) * 0.5 ? (move[0] > 0 ? 'right' : 'left') : move[1] > 0 ? 'down' : 'up'
  }
  p.inv = Math.max(0, p.inv - dt)
  p.hurt = Math.max(0, p.hurt - dt)
  p.blink = Math.max(0, p.blink - dt)
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
      p.hp -= n; p.inv = 0.6; p.blink = 0.6; p.hurt = 0.2
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
    if (w.def.kind === 'sweep') { sweep(g, w, dt); continue }
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
  const rings = [[n, r, 1, def.sprite], ...(def.outer ? [[def.outer, r * 1.8, -0.7, def.sprite2]] : [])] // [how many, how far, which way, what]
  rings.forEach(([count, radius, turn, look], ri) => {
    for (let i = 0; i < count; i++) {
      const a = w.spin * turn + (i / count) * TAU, x = g.p.x + Math.cos(a) * radius, y = g.p.y - 8 + Math.sin(a) * radius * 0.8
      w.points.push([x, y, look])
      near(g, x, y, 8, (e) => {
        const key = w.id + ri + i
        if ((e.hitAt?.[key] ?? -9) > g.t - 0.4) return
        ;(e.hitAt ??= {})[key] = g.t
        damage(g, e, dmg, { kx: e.x - g.p.x, ky: e.y - g.p.y, knock: 50 })
      })
    }
  })
  if (def.bolts && (w.t -= dt) <= 0) { // a few of the books shoot at whoever is nearest
    w.t = def.bolts / (1 + g.stats.haste)
    for (let i = 0; i < 3; i++) {
      const [x, y] = w.points[Math.floor(Math.random() * w.points.length)], t = nearest(g, x, y, 1, 160)[0]
      if (!t) break
      const a = Math.atan2(t.y - 6 - y, t.x - x)
      g.shots.push({ kind: 'shot', x, y, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, dmg: dmg * 0.8, pierce: 1, life: 1.2, hit: new Set(), name: 'energy-bolt', opts: { size: 20, element: 'arcane' }, el: 'arcane' })
    }
    g.sfx('magic', undefined, 0.15)
  }
}

// rays that turn around you, burning whoever they pass over
function sweep(g, w, dt) {
  const def = w.def, len = def.reach * areaOf(g), dmg = dmgOf(g, w)
  w.spin = (w.spin + dt * def.spin) % TAU
  w.beams = Array.from({ length: def.beams }, (_, i) => w.spin + (i / def.beams) * TAU)
  w.len = len
  for (const a of w.beams) {
    const dx = Math.cos(a), dy = Math.sin(a)
    for (let s = 12; s <= len; s += 12) near(g, g.p.x + dx * s, g.p.y - 8 + dy * s, 7, (e) => {
      if ((e.hitAt?.[w.id] ?? -9) > g.t - 0.25) return
      ;(e.hitAt ??= {})[w.id] = g.t
      damage(g, e, dmg, { kx: -dy, ky: dx, knock: 30, el: def.el })
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
    if (s.homeAfter > 0) s.homeAfter -= dt
    else if (s.homing?.dead) s.homing = nearest(g, s.x, s.y, 1, 120)[0] ?? null // its target fell: find another
    if (s.gems) for (const gem of g.gems) if (!gem.pull && (gem.x - s.x) ** 2 + (gem.y - s.y) ** 2 < 900) gem.pull = true
    if (s.homing && !s.homing.dead && !(s.homeAfter > 0)) { const dx = s.homing.x - s.x, dy = s.homing.y - 6 - s.y, d = Math.hypot(dx, dy) || 1, sp = Math.hypot(s.vx, s.vy); s.vx += ((dx / d) * sp - s.vx) * Math.min(1, dt * 6); s.vy += ((dy / d) * sp - s.vy) * Math.min(1, dt * 6) }
    s.x += s.vx * dt; s.y += s.vy * dt
    s.life -= dt
    if (s.life <= 0) s.done = true
    near(g, s.x, s.y + 6, s.wide ?? 5, (e) => {
      if (s.done) return
      if (s.kind === 'boomerang') { if ((s.hitAt.get(e) ?? -9) > g.t - 0.4) return; s.hitAt.set(e, g.t) } else { if (s.hit.has(e)) return; s.hit.add(e) }
      damage(g, e, s.dmg, { kx: s.vx, ky: s.vy, el: s.el })
      if (s.kind === 'shot' && --s.pierce < 0) s.done = true
    })
  }
  g.shots = g.shots.filter((s) => !s.done)
}

function zones(g, dt) {
  const chained = []
  for (const z of g.zones) {
    z.life -= dt
    if (z.kind === 'strike') {
      z.delay -= dt
      if (z.delay <= 0 && !z.done) {
        z.done = true
        near(g, z.x, z.y, z.r, (e) => damage(g, e, z.dmg, { kx: e.x - z.x, ky: e.y - z.y, knock: z.knock ?? 60, el: z.el }))
        if (z.chain > 0) { // lightning jumps to the nearest one it hasn't touched
          let next = null, bd = 80 * 80
          near(g, z.x, z.y, 80, (e) => { const d = (e.x - z.x) ** 2 + (e.y - z.y) ** 2; if (!z.seen.has(e) && d < bd) { bd = d; next = e } })
          if (next) {
            z.seen.add(next)
            const d = Math.sqrt(bd) || 1
            g.fx.push({ name: 'chain-lightning', opts: { size: 40, element: z.el }, x: (z.x + next.x) / 2, y: (z.y + next.y) / 2 - 8, rot: Math.atan2(next.y - z.y, next.x - z.x), scaleX: d / 40, t: 0 })
            chained.push({ kind: 'strike', x: next.x, y: next.y, r: z.r, dmg: z.dmg * 0.85, delay: 0.07, life: 0.15, done: false, el: z.el, chain: z.chain - 1, seen: z.seen })
          }
        }
      }
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
  g.zones = g.zones.filter((z) => z.life > 0).concat(chained)
}
