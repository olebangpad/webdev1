// Game data shared by the server (rules) and the client (looks). Everything a character or monster looks like
// is a PixSpell spec: https://github.com/olebangpad/pixspell

export const TILE = 16
export const STEP_MS = 220 // one tile step
export const TICK_MS = 100 // server simulation and snapshot rate
export const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }

/** Jobs: stats, growth per level, basic attack and one skill. */
export const JOBS = {
  sword: {
    name: '검객', about: '튼튼한 근접 전사. 스킬: 주변을 한 번에 베는 회오리베기.',
    spec: { body: 'hero', hat: 'band', hand: 'jian' },
    hp: 60, mp: 12, grow: { hp: 12, mp: 2, atk: 2 }, atk: [6, 9], range: 1, cooldown: 550,
    skill: { name: '회오리베기', mp: 6, cooldown: 2500, kind: 'spin', power: 1.6 },
  },
  bow: {
    name: '궁수', about: '멀리서 쏘는 사냥꾼. 스킬: 화살 세 발을 연달아 쏘는 연사.',
    spec: { body: 'hero-green', hat: 'conical', hand: 'bow' },
    hp: 46, mp: 16, grow: { hp: 8, mp: 3, atk: 2 }, atk: [4, 7], range: 5, cooldown: 650,
    skill: { name: '연사', mp: 7, cooldown: 2200, kind: 'volley', power: 1, shots: 3 },
  },
  mage: {
    name: '술사', about: '부채로 불꽃 부적을 날리는 선비. 스킬: 멀리 있는 적을 태우는 화염부.',
    spec: { body: 'seonbi', hat: 'gat', hand: 'fan' },
    hp: 38, mp: 40, grow: { hp: 6, mp: 7, atk: 1 }, atk: [3, 5], range: 3, cooldown: 700,
    skill: { name: '화염부', mp: 8, cooldown: 1500, kind: 'bolt', power: 2.6, range: 6, element: 'fire' },
  },
  heal: {
    name: '의원', about: '동료를 살리는 치유사. 스킬: 자신과 주변 사람을 치료하는 회복술.',
    spec: { body: 'hanbok-jade', hat: 'flowers', hand: 'staff-nature' },
    hp: 44, mp: 34, grow: { hp: 8, mp: 6, atk: 1 }, atk: [3, 5], range: 1, cooldown: 650,
    skill: { name: '회복술', mp: 9, cooldown: 2000, kind: 'heal', power: 22, radius: 3 },
  },
}

/** Outfit colors a player can pick (PixSpell ramp A). */
export const COLORS = [null, 'red', 'blue', 'gold', 'purple', 'leather']

/** Monsters: looks, stats, rewards, behavior. */
export const MONSTERS = {
  bunny: { name: '산토끼', spec: { body: 'bunny' }, hp: 14, atk: [1, 3], exp: 5, gold: [1, 3], speed: 900, aggro: 0 },
  rat: { name: '들쥐', spec: { body: 'rat' }, hp: 18, atk: [2, 3], exp: 7, gold: [1, 4], speed: 700, aggro: 0 },
  frog: { name: '청개구리', spec: { body: 'frog' }, hp: 22, atk: [2, 4], exp: 9, gold: [2, 5], speed: 1100, aggro: 0 },
  slime: { name: '이끼방울', spec: { body: 'slime' }, hp: 26, atk: [3, 4], exp: 11, gold: [2, 6], speed: 1000, aggro: 3 },
  wolf: { name: '잿빛늑대', spec: { body: 'wolf' }, hp: 48, atk: [5, 8], exp: 26, gold: [5, 10], speed: 520, aggro: 5 },
  snake: { name: '독사', spec: { body: 'snake' }, hp: 40, atk: [6, 9], exp: 24, gold: [4, 9], speed: 650, aggro: 4, element: 'poison' },
  spider: { name: '숲거미', spec: { body: 'spider' }, hp: 44, atk: [5, 9], exp: 25, gold: [4, 10], speed: 600, aggro: 4 },
  boar: { name: '멧돼지', spec: { body: 'boar' }, hp: 70, atk: [7, 11], exp: 38, gold: [8, 15], speed: 750, aggro: 3 },
  'boar-king': { name: '멧돼지왕', spec: { body: 'boar', hat: 'crown' }, hp: 420, atk: [12, 18], exp: 400, gold: [80, 120], speed: 800, aggro: 6, boss: true, respawn: 90000 },
}

/** EXP needed to go from level lv to lv + 1. */
export const expFor = (lv) => Math.round(18 * Math.pow(lv, 1.55))

/** A player's stats at a level. */
export function statsFor(job, lv) {
  const j = JOBS[job]
  return {
    maxHp: j.hp + j.grow.hp * (lv - 1),
    maxMp: j.mp + j.grow.mp * (lv - 1),
    atk: [j.atk[0] + j.grow.atk * (lv - 1), j.atk[1] + j.grow.atk * (lv - 1)],
  }
}
