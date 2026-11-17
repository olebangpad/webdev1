// The rules of a run, tested without a browser: the simulation never touches the page.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HEROES, WEAPONS, PASSIVES, EVOLUTIONS, ENEMIES, STAGES, DASH } from '../src/data.js'
import { newGame, step, addWeapon, addPassive, makeChoices, choose, reroll, evolutionFor } from '../src/game.js'
import { autopilot, autoChoose } from '../src/pilot.js'

const run = (g, seconds, move = null) => { for (let t = 0; t < seconds; t += 1 / 30) step(g, 1 / 30, typeof move === 'function' ? move(g) : move) }

test('data: every hero, evolution, wave and boss points at something that exists', () => {
  for (const h of HEROES) assert.ok(WEAPONS[h.weapon], `${h.id} starts with ${h.weapon}`)
  for (const [id, evo] of Object.entries(EVOLUTIONS)) {
    assert.ok(WEAPONS[id], id)
    assert.ok(PASSIVES[evo.needs], `${id} needs ${evo.needs}`)
    assert.ok(HEROES.some((h) => h.weapon === id), `${id} is a hero's weapon`)
  }
  for (const s of STAGES) {
    for (const [, kinds] of s.waves) for (const k of kinds) assert.ok(ENEMIES[k], `${s.id}: ${k}`)
    for (const k of s.elites) assert.ok(ENEMIES[k].big, k)
    for (const [, k] of s.bosses) assert.ok(ENEMIES[k].boss, k)
    assert.ok(ENEMIES[s.bosses.at(-1)[1]].final, `${s.id} ends with a final boss`)
  }
})

test('evolution: a level 5 weapon with its passive is offered first, changes the weapon, and is offered once', () => {
  const g = newGame(STAGES[0], 'samurai')
  const katana = g.weapons[0]
  katana.lv = 5
  assert.equal(evolutionFor(g, katana), null, 'not without the passive')
  assert.ok(!makeChoices(g).some((c) => c.type === 'evo'))
  addPassive(g, EVOLUTIONS.katana.needs)
  assert.equal(evolutionFor(g, katana), EVOLUTIONS.katana)
  g.levels = 1
  g.choices = makeChoices(g)
  assert.deepEqual(g.choices[0], { type: 'evo', id: 'katana' })
  // a reroll deals new cards but keeps the evolution on the table
  assert.equal(reroll(g), true)
  assert.equal(g.rerolls, 1)
  assert.deepEqual(g.choices[0], { type: 'evo', id: 'katana' })
  choose(g, g.choices[0])
  assert.equal(katana.evo, true)
  assert.equal(katana.def.name, 'MOON BLADE')
  assert.equal(evolutionFor(g, katana), null)
  assert.ok(!makeChoices(g).some((c) => c.type === 'evo' || (c.type === 'w' && c.id === 'katana')), 'an evolved weapon is finished')
  g.choices = makeChoices(g); reroll(g); assert.equal(reroll(g), false, 'two rerolls a run')
})

test('every evolved weapon runs against a crowd without breaking, and kills', () => {
  for (const hero of HEROES) {
    const g = newGame(STAGES[0], hero.id)
    g.weapons[0].lv = 5
    addPassive(g, EVOLUTIONS[hero.weapon].needs)
    choose(g, { type: 'evo', id: hero.weapon })
    Object.assign(g, { t: 120, next: 1e9, spawnAcc: 80 })
    g.p.hp = g.stats.maxHp = 1e6
    run(g, 12, [1, 0.2])
    assert.ok(g.kills > 5, `${g.weapons[0].def.name} killed ${g.kills}`)
  }
})

test('every weapon found on the way works too', () => {
  const g = newGame(STAGES[1], 'deel')
  for (const id of Object.keys(WEAPONS)) addWeapon(g, id)
  Object.assign(g, { t: 200, next: 1e9, spawnAcc: 100 })
  g.p.hp = g.stats.maxHp = 1e6
  run(g, 10, [0, 1])
  assert.ok(g.kills > 30, `killed ${g.kills}`)
})

test('dash: a burst of speed nothing can hurt, then a wait', () => {
  const g = newGame(STAGES[0], 'deel')
  step(g, 1 / 30, [1, 0])
  const walked = g.p.x
  g.wantDash = true
  run(g, DASH.time + 0.05, [1, 0])
  assert.ok(g.p.x > walked + g.hero.speed * DASH.time * 3, `dashed to ${g.p.x.toFixed(1)}`)
  assert.ok(g.p.inv > 0 && g.p.dashCd > 0)
  const before = g.p.x
  g.wantDash = true
  step(g, 1 / 30, null)
  assert.ok(g.p.x - before < 1, 'not again until the wait is over')
  run(g, DASH.cd, null)
  assert.equal(g.p.dashCd, 0)
})

test('the pilot gets through the first minutes of every stage', () => {
  for (const stage of STAGES) {
    const g = newGame(stage, 'deel')
    for (let t = 0; t < 75 && !g.over; t += 1 / 30) { step(g, 1 / 30, autopilot(g)); if (g.choices) autoChoose(g) }
    assert.ok(!g.over, `${stage.id}: fell at ${g.t.toFixed(0)} s`)
    assert.ok(g.lv >= 3 && g.kills > 30, `${stage.id}: level ${g.lv}, ${g.kills} kills`)
  }
})

// ------------------------------------------------------------------ monsters with minds of their own
import { spawn } from '../src/game.js'
const quiet = (stage = STAGES[0], hero = 'deel') => { // a run where nothing arrives by itself and the hero has no weapons
  const g = newGame(stage, hero)
  Object.assign(g, { weapons: [], eliteT: 1e9, mimicT: 1e9, bossIndex: 99, spawnAcc: -1e9, next: 1e9 })
  return g
}

test('a charger stops, shows it, then rushes in a straight line', () => {
  const g = quiet()
  const wolf = spawn(g, 'wolf', null, { x: 80, y: 0 })
  wolf.aiT = 0
  step(g, 1 / 30, null)
  assert.equal(wolf.state, 'wind')
  const x0 = wolf.x
  run(g, 0.4)
  assert.ok(wolf.tell && Math.abs(wolf.x - x0) < 1, 'it stands still while it winds up')
  run(g, 0.3)
  assert.equal(wolf.state, 'charge')
  const x1 = wolf.x
  run(g, 0.2)
  assert.ok(x1 - wolf.x > 20, `rushed ${(x1 - wolf.x).toFixed(0)} px in 0.2 s`)
})

test('a shooter keeps its distance and spits; what it spits hurts, and a dash goes through it', () => {
  const g = quiet()
  const shroom = spawn(g, 'shroom', null, { x: 60, y: 0 })
  shroom.aiT = 0.1
  run(g, 0.3)
  assert.equal(g.hostile.length, 1)
  assert.ok(shroom.x > 60, 'it backs away from someone this close')
  const hp = g.p.hp
  run(g, 2)
  assert.ok(g.p.hp < hp, 'the spit landed')
  // again, dashing through it
  const g2 = quiet()
  spawn(g2, 'shroom', null, { x: 60, y: 0 }).aiT = 0.1
  run(g2, 0.5)
  g2.wantDash = true
  run(g2, 0.3, [1, 0])
  assert.equal(g2.p.hp, g2.stats.maxHp)
})

test('an exploder lights a fuse next to you: step away, or stop it in time', () => {
  const g = quiet()
  const spider = spawn(g, 'spider', null, { x: 15, y: 0 })
  step(g, 1 / 30, null)
  assert.equal(spider.state, 'fuse')
  assert.equal(g.dangers.length, 1)
  run(g, 0.8)
  assert.ok(g.p.hp < g.stats.maxHp, 'standing in it hurts')
  // killed during the fuse: nothing blows
  const g2 = quiet()
  const s2 = spawn(g2, 'spider', null, { x: 15, y: 0 })
  step(g2, 1 / 30, null)
  addWeapon(g2, 'aura'); g2.weapons[0].def = { ...g2.weapons[0].def, dmg: 999 }; g2.weapons[0].t = 0
  g2.p.inv = 0.3 // (so touching it doesn't count)
  run(g2, 1)
  assert.ok(s2.dead)
  assert.equal(g2.p.hp, g2.stats.maxHp)
})

test('a slime comes apart into two small ones; an armored elite takes half', () => {
  const g = quiet()
  const slime = spawn(g, 'slime', null, { x: 100, y: 0 })
  addWeapon(g, 'arrows'); g.weapons[0].def = { ...g.weapons[0].def, dmg: 999 }; g.weapons[0].t = 0
  for (let i = 0; i < 60 && !slime.dead; i++) step(g, 1 / 30, null) // until the arrow lands
  const minis = g.enemies.filter((e) => e.mini)
  assert.equal(minis.length, 2)
  assert.ok(minis.every((e) => e.r < 7 && e.xp === 1))
  const g2 = quiet()
  const plain = spawn(g2, 'golem', null, { x: 100, y: 0 }), hard = spawn(g2, 'golem', null, { x: -100, y: 0, affix: 'armored' })
  addWeapon(g2, 'aura'); Object.assign(g2.weapons[0], { def: { ...g2.weapons[0].def, dmg: 100, radius: 200 }, t: 0 }); g2.stats.crit = 0
  step(g2, 1 / 30, null)
  assert.equal(plain.maxHp - plain.hp, 2 * (hard.maxHp - hard.hp))
})

test('every boss works through its moves, and each one shows before it lands', () => {
  for (const [id, def] of Object.entries(ENEMIES).filter(([, d]) => d.boss)) {
    const g = quiet()
    g.p.hp = g.stats.maxHp = 1e6
    const boss = spawn(g, id, null, { x: 120, y: 0 })
    let dangers = 0, shots = 0, states = new Set(), early = 0
    for (let t = 0; t < 30; t += 1 / 30) {
      const before = g.p.hp
      step(g, 1 / 30, null)
      dangers = Math.max(dangers, g.dangers.length); shots = Math.max(shots, g.hostile.length); states.add(boss.state)
      for (const z of g.dangers) if (z.t < 0.3 && before !== g.p.hp && (z.x - g.p.x) ** 2 + (z.y - g.p.y) ** 2 < z.r ** 2) early++
    }
    assert.ok(boss.move >= def.moves.length, `${id} used ${boss.move} moves`)
    assert.ok(dangers + shots > 0, `${id} attacked`)
    if (def.moves.includes('charge')) assert.ok(states.has('charge'), `${id} charged`)
    if (def.moves.includes('summon')) assert.ok(g.enemies.length > 1, `${id} summoned`)
  }
})
