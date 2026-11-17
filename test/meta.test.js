// What lasts between runs: gold, upgrades, unlocked heroes, records.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HEROES, UPGRADES, STAGES } from '../src/data.js'
import { newSave, repair, priceOf, buyUpgrade, buyHero, hasHero, payout, bank } from '../src/meta.js'
import { newGame, step } from '../src/game.js'

test('a new save has the free heroes and nothing else; a broken one is repaired', () => {
  const s = newSave()
  assert.deepEqual(s.heroes, HEROES.filter((h) => !h.cost).map((h) => h.id))
  assert.ok(s.heroes.length >= 3 && s.heroes.length < HEROES.length)
  assert.deepEqual(repair(null), s)
  assert.deepEqual(repair('nonsense'), s)
  const odd = repair({ gold: -5, upgrades: { might: 99, nope: 3 }, heroes: ['seonbi', 'nobody'], best: { meadow: { time: 100, won: 1 } }, runs: 2.7 })
  assert.equal(odd.gold, 0)
  assert.deepEqual(odd.upgrades, { might: UPGRADES.might.max })
  assert.ok(hasHero(odd, 'seonbi') && !odd.heroes.includes('nobody'))
  assert.equal(odd.best.meadow.won, true)
  assert.equal(odd.runs, 2)
})

test('upgrades cost more each level, stop at their max, and need the gold', () => {
  const s = newSave()
  assert.equal(buyUpgrade(s, 'might'), false, 'no gold, no upgrade')
  s.gold = 1000
  assert.equal(priceOf(s, 'might'), UPGRADES.might.cost)
  assert.ok(buyUpgrade(s, 'might'))
  assert.equal(priceOf(s, 'might'), UPGRADES.might.cost * 2)
  assert.equal(s.gold, 1000 - UPGRADES.might.cost)
  s.gold = 1e6
  while (buyUpgrade(s, 'might'));
  assert.equal(s.upgrades.might, UPGRADES.might.max)
  assert.equal(priceOf(s, 'might'), null)
})

test('heroes are bought once, with gold', () => {
  const s = newSave(), locked = HEROES.find((h) => h.cost)
  assert.equal(buyHero(s, locked.id), false)
  s.gold = locked.cost
  assert.ok(buyHero(s, locked.id))
  assert.equal(s.gold, 0)
  assert.ok(hasHero(s, locked.id))
  s.gold = 9999
  assert.equal(buyHero(s, locked.id), false, 'not twice')
  assert.equal(buyHero(s, HEROES[0].id), false, 'free ones are already yours')
})

test('upgrades shape the next run', () => {
  const plain = newGame(STAGES[0], 'deel')
  const g = newGame(STAGES[0], 'deel', { upgrades: { might: 2, health: 3, armor: 1, reroll: 2, dash: 1, greed: 2, revive: 1 } })
  assert.equal(g.stats.might.toFixed(2), '1.10')
  assert.equal(g.stats.maxHp, plain.stats.maxHp + 30)
  assert.equal(g.p.hp, g.stats.maxHp)
  assert.equal(g.stats.armor, 1)
  assert.equal(g.rerolls, plain.rerolls + 2)
  assert.ok(g.dashCdMul < 1 && g.goldMul > 1)
  // the second wind: down, then up again once
  g.spawnAcc = -1e9; g.eliteT = g.mimicT = 1e9; g.bossIndex = 99
  g.p.hp = 1; g.hostile.push({ x: 0, y: -8, vx: 0, vy: 0, r: 4, dmg: 500, life: 1, el: 'dark' })
  step(g, 1 / 30, null)
  assert.ok(!g.over && g.p.hp > 1 && g.revives === 0, 'got up')
  g.p.inv = 0; g.p.hp = 1; g.hostile.push({ x: 0, y: -8, vx: 0, vy: 0, r: 4, dmg: 500, life: 1, el: 'dark' })
  step(g, 1 / 30, null)
  assert.ok(g.over, 'only once')
})

test('a run pays for what it found, its kills, its time, and a win; records keep the best', () => {
  const s = newSave()
  const g = newGame(STAGES[0], 'deel')
  Object.assign(g, { gold: 40, kills: 500, t: 300, over: true, won: false })
  assert.deepEqual(payout(g), { found: 40, kills: 20, time: 50, win: 0, total: 110 })
  const first = bank(s, g)
  assert.equal(s.gold, 110)
  assert.ok(first.record && s.best.meadow.time === 300 && !s.best.meadow.won)
  // a shorter loss is no record; a win is, and then only a faster win beats it
  assert.equal(bank(s, Object.assign(newGame(STAGES[0], 'deel'), { t: 200, over: true })).record, false)
  assert.ok(bank(s, Object.assign(newGame(STAGES[0], 'viking'), { t: 470, over: true, won: true })).record)
  assert.equal(s.best.meadow.hero, 'viking')
  assert.equal(bank(s, Object.assign(newGame(STAGES[0], 'deel'), { t: 480, over: true, won: true })).record, false)
  assert.ok(bank(s, Object.assign(newGame(STAGES[0], 'deel'), { t: 460, over: true, won: true })).record)
  assert.equal(bank(s, Object.assign(newGame(STAGES[0], 'deel'), { t: 600, over: true, won: false })).record, false, 'a long loss does not beat a win')
  assert.equal(s.runs, 6)
  assert.equal(s.wins, 3)
})
