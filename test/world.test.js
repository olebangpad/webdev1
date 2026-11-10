import { test } from 'node:test'
import assert from 'node:assert/strict'
import { World } from '../server/world.js'
import { MAPS, START_MAP, walkable } from '../shared/maps.js'
import { MONSTERS, expFor } from '../shared/data.js'

function setup() {
  let t = 10_000
  const inbox = new Map(), saved = new Map()
  const world = new World({
    send: (id, msg) => { if (!inbox.has(id)) inbox.set(id, []); inbox.get(id).push(msg) },
    store: { load: (n) => saved.get(n) ?? null, save: (n, d) => saved.set(n, d) },
    now: () => t,
  })
  const advance = (ms) => { for (let i = 0; i < ms; i += 100) { t += 100; world.tick() } }
  const msgs = (id, type) => (inbox.get(id) ?? []).filter((m) => m.t === type)
  return { world, advance, msgs, saved, clock: { get: () => t, add: (ms) => { t += ms } } }
}

test('maps: every map has a walkable start, portals that lead somewhere walkable, and spawn areas with room', () => {
  for (const m of Object.values(MAPS)) {
    assert.ok(walkable(m, ...m.start), `${m.id} start`)
    for (const p of m.portals) assert.ok(walkable(MAPS[p.to], p.tx, p.ty), `${m.id} -> ${p.to} lands on a walkable tile`)
    for (const s of m.spawns) assert.ok(MONSTERS[s.kind], s.kind)
    for (const n of m.npcs) assert.ok(m.solid[n.y][n.x], `${n.id} blocks its tile`)
  }
})

test('join: names are checked, a saved name needs its token, two people cannot share a name', () => {
  const { world, msgs, saved } = setup()
  assert.match(world.join('a', { name: 'x', job: 'sword' }).error, /2~10/)
  assert.match(world.join('a', { name: '홍길동', job: 'nope' }).error, /직업/)
  const { player } = world.join('a', { name: '홍길동', job: 'sword', color: 2 })
  assert.equal(player.map, START_MAP)
  const token = msgs('a', 'welcome')[0].token
  assert.match(world.join('b', { name: '홍길동', job: 'bow' }).error, /접속 중/)
  world.leave('a')
  assert.equal(saved.get('홍길동').job, 'sword')
  assert.match(world.join('b', { name: '홍길동', job: 'bow', token: 'wrong' }).error, /다른 사람/)
  const back = world.join('c', { name: '홍길동', token })
  assert.equal(back.player.job, 'sword', 'a saved character comes back as it was')
})

test('moving: one tile per step, walls stop you, portals take you to the next map', () => {
  const { world, clock, msgs } = setup()
  const { player: p } = world.join('a', { name: '나그네', job: 'bow' })
  const [sx, sy] = [p.x, p.y]
  world.input('a', { t: 'move', dir: 'right' })
  assert.deepEqual([p.x, p.y], [sx + 1, sy])
  world.input('a', { t: 'move', dir: 'right' })
  assert.deepEqual([p.x, p.y], [sx + 1, sy], 'too soon for another step')
  // walk to the east gate of the village and through it
  const gate = MAPS.town.portals[0]
  p.x = gate.x - 1; p.y = gate.y
  clock.add(500)
  world.input('a', { t: 'move', dir: 'right' })
  assert.equal(p.map, gate.to)
  assert.deepEqual([p.x, p.y], [gate.tx, gate.ty])
  assert.equal(msgs('a', 'map').at(-1).map, gate.to)
})

test('fighting: a kill gives EXP shared by damage and gold to the top hitter; enough EXP is a level', () => {
  const { world, clock, msgs, advance } = setup()
  const { player: p } = world.join('a', { name: '검객하나', job: 'sword' })
  const bunny = [...world.monsters.values()].find((m) => m.type === 'bunny')
  p.map = bunny.map; p.x = bunny.x - 1; p.y = bunny.y; p.dir = 'right'
  if (!walkable(MAPS[p.map], p.x, p.y)) { p.x = bunny.x; p.y = bunny.y - 1; p.dir = 'down' }
  bunny.next = Infinity // hold still
  let swings = 0
  while (world.monsters.has(bunny.id) && swings < 20) { clock.add(600); world.input('a', { t: 'attack' }); swings++ }
  assert.ok(!world.monsters.has(bunny.id), 'the bunny went down')
  assert.equal(p.exp, MONSTERS.bunny.exp)
  assert.ok(p.gold >= MONSTERS.bunny.gold[0])
  assert.ok(msgs('a', 'fx').some((f) => f.k === 'die' && f.id === bunny.id))
  world.gainExp(p, expFor(1))
  assert.equal(p.lv, 2)
  assert.equal(p.hp, p.maxHp)
  // it comes back later
  const before = [...world.monsters.values()].filter((m) => m.type === 'bunny').length
  advance(13_000)
  assert.equal([...world.monsters.values()].filter((m) => m.type === 'bunny').length, before + 1)
})

test('dying and coming back; chat is rate limited and stays on the map', () => {
  const { world, msgs, advance, clock } = setup()
  world.join('a', { name: '하나', job: 'heal' })
  const { player: b } = world.join('b', { name: '두리', job: 'mage' })
  world.input('a', { t: 'chat', text: '  안녕하세요   여러분 ' })
  world.input('a', { t: 'chat', text: '도배' })
  assert.deepEqual(msgs('b', 'chat').map((c) => c.text), ['안녕하세요 여러분'])
  clock.add(800)
  world.input('a', { t: 'chat', text: 'x'.repeat(200) })
  assert.equal(msgs('b', 'chat').at(-1).text.length, 60)
  world.hurtPlayer(b, 9999, null)
  assert.ok(b.dead)
  world.input('b', { t: 'move', dir: 'up' })
  advance(3200)
  assert.ok(!b.dead && b.hp > 0 && b.map === START_MAP)
})

test('the healer heals everyone nearby; talking to the village healer fills you up', () => {
  const { world, msgs } = setup()
  const { player: h } = world.join('a', { name: '의원님', job: 'heal' })
  const { player: f } = world.join('b', { name: '친구', job: 'sword' })
  f.hp = 5; h.hp = 5
  world.input('a', { t: 'skill' })
  assert.ok(f.hp > 5 && h.hp > 5)
  const npc = MAPS.town.npcs.find((n) => n.role === 'heal')
  f.hp = 1; f.x = npc.x; f.y = npc.y + 1; f.dir = 'up'
  world.input('b', { t: 'talk' })
  assert.equal(f.hp, f.maxHp)
  assert.equal(msgs('b', 'say')[0].name, npc.name)
})

test('snapshots: you see who is on your map, new ones once with their looks, and who left', () => {
  const { world, msgs, advance } = setup()
  world.join('a', { name: '하나', job: 'sword' })
  advance(100)
  world.join('b', { name: '두리', job: 'bow', color: 3 })
  advance(100)
  const s = msgs('a', 's').at(-1)
  assert.ok(s.add.some((e) => e.id === 'b' && e.name === '두리' && e.job === 'bow' && e.color === 3))
  assert.ok(s.e.some((e) => e[0] === 'b'))
  world.leave('b')
  advance(100)
  assert.deepEqual(msgs('a', 's').at(-1).del, ['b'])
})
