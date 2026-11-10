// The world's maps, generated from a seed so the server (walls, spawns) and the client (drawing) build the same map.
// A map: { id, name, w, h, music, base, layers: [{ tile, cells }], props, houses, solid, portals, npcs, spawns, start }

const rng = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const grid = (w, h, f) => Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => f(x, y)))

function blank(id, name, w, h, music, base) {
  return { id, name, w, h, music, base, layers: [], props: [], houses: [], portals: [], npcs: [], spawns: [], solid: grid(w, h, () => false), start: [1, 1] }
}
const inside = (m, x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h
const free = (m, x, y) => inside(m, x, y) && !m.solid[y][x] && !m.props.some((p) => p.x === x && p.y === y) && !m.portals.some((p) => p.x === x && p.y === y)
function prop(m, id, x, y, solid = true) {
  if (!inside(m, x, y)) return
  m.props.push({ id, x, y })
  if (solid) m.solid[y][x] = true
}
function house(m, x, y, w, roof = 'roof-slate', wall = 'planks') {
  m.houses.push({ x, y, w, h: 4, roof, wall, door: x + (w >> 1) })
  for (let yy = y; yy < y + 4; yy++) for (let xx = x; xx < x + w; xx++) m.solid[yy][xx] = true
}
/** Trees all around the edge, except where exits are. */
function border(m, open, trees = ['pine-tree']) {
  const r = rng(m.w * 7 + m.h)
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (x > 0 && y > 0 && x < m.w - 1 && y < m.h - 1) continue
    if (open(x, y)) continue
    prop(m, trees[Math.floor(r() * trees.length)], x, y)
  }
}
function portal(m, x, y, to, tx, ty) { m.portals.push({ x, y, to, tx, ty }) }

// ------------------------------------------------------------------ 솔빛마을: the village
function town() {
  const m = blank('town', '솔빛마을', 36, 26, 'town', 'grass')
  const road = grid(m.w, m.h, (x, y) => y === 12 || y === 13 || ((x === 17 || x === 18) && y > 2) || (x >= 13 && x <= 22 && y >= 9 && y <= 16))
  m.layers.push({ tile: 'cobblestone', cells: road })
  for (const [x, y, w] of [[3, 3, 6], [10, 3, 6], [21, 3, 6], [28, 3, 6]]) house(m, x, y, w, x < 18 ? 'roof-slate' : 'roof-clay')
  house(m, 3, 18, 7, 'roof-clay', 'planks-dark'); house(m, 25, 18, 7, 'roof-slate', 'planks-dark')
  border(m, (x, y) => x === m.w - 1 && (y === 12 || y === 13), ['pine-tree', 'tree-cherry'])
  prop(m, 'well', 15, 10)
  for (const [x, y] of [[13, 9], [22, 9], [13, 16], [22, 16]]) prop(m, 'tree-cherry', x, y)
  for (const [x, y] of [[12, 12], [23, 12]]) prop(m, 'lamp-post', x, y - 1)
  for (let x = 11; x <= 15; x++) prop(m, 'fence', x, 22)
  for (const [x, y] of [[20, 21], [21, 21]]) prop(m, 'barrel', x, y)
  prop(m, 'hay-bale', 12, 21)
  const r = rng(11)
  for (let i = 0; i < 40; i++) { const x = 1 + Math.floor(r() * (m.w - 2)), y = 1 + Math.floor(r() * (m.h - 2)); if (!road[y][x] && free(m, x, y)) prop(m, r() < 0.5 ? 'flower' : 'flower-white', x, y, false) }
  portal(m, m.w - 1, 12, 'meadow', 1, 16); portal(m, m.w - 1, 13, 'meadow', 1, 17)
  m.npcs.push(
    { id: 'npc-healer', name: '의녀 연화', spec: { body: 'hanbok-pink', hat: 'flowers-white' }, x: 19, y: 8, dir: 'down', role: 'heal', lines: ['다친 데는 없으신가요? 제가 치료해 드릴게요.'] },
    { id: 'npc-chief', name: '촌장 백운', spec: { body: 'seonbi-sky', hat: 'gat-white' }, x: 15, y: 15, dir: 'down', role: 'talk', lines: ['솔빛마을에 온 걸 환영하네.', '동쪽 들판에서 산토끼와 들쥐부터 잡아 보게.', '깊은숲의 멧돼지왕은 아직 아무도 이기지 못했다네.'] },
    { id: 'npc-guard', name: '문지기 돌쇠', spec: { body: 'hero-red', hat: 'band-black', hand: 'spear' }, x: 33, y: 11, dir: 'left', role: 'talk', lines: ['동쪽 문 너머가 들꽃벌판이오.', '레벨 5는 넘어야 깊은숲에 들어갈 만하오.'] },
  )
  for (const n of m.npcs) m.solid[n.y][n.x] = true
  m.start = [17, 14]
  return m
}

// ------------------------------------------------------------------ 들꽃벌판: the meadow
function meadow() {
  const m = blank('meadow', '들꽃벌판', 48, 34, 'field', 'grass')
  const pathY = (x) => Math.round(16.5 + Math.sin(x / 6) * 3)
  const path = grid(m.w, m.h, (x, y) => Math.abs(y - pathY(x)) <= 1 && !(x === 0 && y !== 16 && y !== 17))
  for (let y = 15; y <= 18; y++) { path[y][0] = y === 16 || y === 17; path[y][m.w - 1] = y === 16 || y === 17 }
  m.layers.push({ tile: 'dirt', cells: path })
  const pond = grid(m.w, m.h, (x, y) => Math.hypot((x - 33) / 5.5, (y - 26) / 3.4) < 1)
  m.layers.push({ tile: 'water', cells: pond })
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (pond[y][x]) m.solid[y][x] = true
  border(m, (x, y) => (x === 0 || x === m.w - 1) && (y === 16 || y === 17), ['pine-tree', 'tree'])
  const r = rng(23)
  for (let y = 1; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) {
    if (path[y][x] || pond[y][x] || Math.abs(y - pathY(x)) < 3) continue
    const v = r()
    if (v < 0.05) prop(m, r() < 0.6 ? 'tree' : 'tree-cherry', x, y)
    else if (v < 0.07) prop(m, r() < 0.5 ? 'rock' : 'bush', x, y)
    else if (v < 0.15) prop(m, ['flower', 'flower-red', 'flower-blue', 'flower-sun'][Math.floor(r() * 4)], x, y, false)
  }
  for (const [x, y] of [[30, 25], [35, 27], [33, 24]]) if (pond[y]?.[x]) m.props.push({ id: 'lily-pad', x, y })
  portal(m, 0, 16, 'town', 34, 12); portal(m, 0, 17, 'town', 34, 13)
  portal(m, m.w - 1, 16, 'forest', 1, 16); portal(m, m.w - 1, 17, 'forest', 1, 17)
  m.spawns.push(
    { kind: 'bunny', count: 9, area: [3, 2, 22, 31] },
    { kind: 'rat', count: 7, area: [12, 2, 34, 31] },
    { kind: 'frog', count: 6, area: [24, 19, 42, 32] },
    { kind: 'slime', count: 6, area: [30, 2, 45, 20] },
  )
  m.start = [2, 16]
  return m
}

// ------------------------------------------------------------------ 깊은숲: the deep forest, and its king
function forest() {
  const m = blank('forest', '깊은숲', 44, 34, 'forest', 'grass')
  const pathY = (x) => Math.round(16.5 + Math.sin(x / 5 + 1) * 2.5)
  const clearing = grid(m.w, m.h, (x, y) => Math.hypot((x - 35) / 6, (y - 17) / 5) < 1)
  const path = grid(m.w, m.h, (x, y) => !clearing[y][x] && Math.abs(y - pathY(x)) <= 1 && x < 32)
  for (let y = 15; y <= 18; y++) path[y][0] = y === 16 || y === 17
  const fallen = grid(m.w, m.h, (x, y) => Math.sin(x * 0.45) * Math.cos(y * 0.5) + Math.sin(x * 0.17 + y * 0.29) > 0.55) // patches of fallen leaves
  m.layers.push({ tile: 'grass-autumn', cells: fallen }, { tile: 'dirt', cells: path }, { tile: 'dirt-mud', cells: clearing })
  border(m, (x, y) => x === 0 && (y === 16 || y === 17), ['pine-tree', 'pine-tree-dead'])
  const r = rng(37)
  for (let y = 1; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) {
    if (path[y][x] || clearing[y][x] || Math.abs(y - pathY(x)) < 2 && x < 32) continue
    const v = r()
    if (v < 0.16) prop(m, r() < 0.7 ? 'pine-tree' : 'pine-tree-dead', x, y)
    else if (v < 0.19) prop(m, r() < 0.5 ? 'stump-mossy' : 'rock-mossy', x, y)
    else if (v < 0.24) prop(m, ['mushroom', 'mushroom-brown', 'flower-white'][Math.floor(r() * 3)], x, y, false)
  }
  for (const [x, y] of [[31, 13], [39, 13], [31, 21], [39, 21]]) prop(m, 'tombstone', x, y)
  portal(m, 0, 16, 'meadow', 46, 16); portal(m, 0, 17, 'meadow', 46, 17)
  m.spawns.push(
    { kind: 'wolf', count: 6, area: [4, 2, 30, 31] },
    { kind: 'snake', count: 5, area: [4, 2, 30, 31] },
    { kind: 'spider', count: 5, area: [10, 2, 40, 31] },
    { kind: 'boar', count: 4, area: [14, 4, 40, 30] },
    { kind: 'boar-king', count: 1, area: [34, 15, 37, 19] },
  )
  m.start = [2, 16]
  return m
}

export const MAPS = Object.fromEntries([town(), meadow(), forest()].map((m) => [m.id, m]))
export const START_MAP = 'town'
export const walkable = (m, x, y) => inside(m, x, y) && !m.solid[y][x]
