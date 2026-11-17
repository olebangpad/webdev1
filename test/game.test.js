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
