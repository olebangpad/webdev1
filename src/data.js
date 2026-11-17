// Everything the game is made of, as data. Every look is a PixSpell call: a character spec, a sprite id or an effect.

/** How close a hero likes to fight (the demo pilot uses it): blades and orbits up close, the rest from range. */
export const CLOSE = new Set(['arc', 'slam', 'orbit', 'aura', 'sweep'])
/** Heroes: PixSpell's people from around the world, each with the weapon that fits how they fight. */
export const HEROES = [
  { id: 'samurai', cost: 0, from: 'JAPAN', weapon: 'katana', hp: 130, speed: 56, note: 'SLASHES WHAT IS IN FRONT' },
  { id: 'viking', cost: 0, from: 'SCANDINAVIA', weapon: 'quake', hp: 140, speed: 48, note: 'SHAKES THE GROUND AROUND' },
  { id: 'hanbok', cost: 0, from: 'KOREA', weapon: 'fan', hp: 90, speed: 58, note: 'FANS OUT SEEKING PETALS' },
  { id: 'deel', cost: 0, from: 'MONGOLIA', weapon: 'arrows', hp: 95, speed: 60, note: 'SHOOTS THE NEAREST FOE' },
  { id: 'kente', cost: 120, from: 'GHANA', weapon: 'lightning', hp: 95, speed: 54, note: 'CALLS DOWN CHAIN LIGHTNING' },
  { id: 'legionary', cost: 160, from: 'ROME', weapon: 'pilum', hp: 135, speed: 52, note: 'A SPEAR THAT PIERCES ROWS' },
  { id: 'musketeer', cost: 200, from: 'FRANCE', weapon: 'rapier', hp: 120, speed: 60, note: 'QUICK STABS, MANY OF THEM' },
  { id: 'outback', cost: 260, from: 'AUSTRALIA', weapon: 'boomerang', hp: 105, speed: 56, note: 'IT ALWAYS COMES BACK' },
  { id: 'pharaoh', cost: 320, from: 'EGYPT', weapon: 'sunbeam', hp: 100, speed: 52, note: 'BEAMS OF THE SUN STRIKE' },
  { id: 'seonbi', cost: 400, from: 'KOREA', weapon: 'scrolls', hp: 95, speed: 54, note: 'SPELL BOOKS CIRCLE AROUND' },
]

/**
 * Weapons. kind picks the behavior (game.js); dmg/cd at level 1; every level adds 25% damage and 6% speed, and
 * the levels listed in more add one more of whatever the weapon makes. icon: a sprite, fx: the effect it draws.
 */
export const WEAPONS = {
  katana: { name: 'KATANA', kind: 'arc', icon: 'held-katana', fx: 'cross-slash', dmg: 18, cd: 0.75, reach: 26, size: 52, more: [3, 5], desc: 'SLASH IN FRONT' },
  rapier: { name: 'RAPIER', kind: 'arc', icon: 'held-sword', fx: 'stab', dmg: 10, cd: 0.3, reach: 24, size: 36, more: [2, 4], desc: 'FAST STABS' },
  pilum: { name: 'PILUM', kind: 'arc', icon: 'held-spear', fx: 'thrust', dmg: 18, cd: 0.85, reach: 40, size: 18, long: 76, more: [3, 5], desc: 'PIERCES A WHOLE ROW' },
  quake: { name: 'QUAKE AXE', kind: 'slam', icon: 'held-axe', fx: 'quake', dmg: 20, cd: 1.6, radius: 46, more: [], desc: 'SLAM AROUND YOU' },
  fan: { name: 'PETAL FAN', kind: 'shot', icon: 'held-fan', fx: 'orb', el: 'arcane', dmg: 10, cd: 0.75, speed: 130, homing: true, pierce: 1, more: [2, 3, 5], desc: 'SEEKING PETALS' },
  arrows: { name: 'HORSE BOW', kind: 'shot', icon: 'held-bow', fx: 'arrow', dmg: 11, cd: 0.55, speed: 230, pierce: 1, more: [2, 4, 5], desc: 'ARROWS AT THE NEAREST' },
  lightning: { name: 'STORM STAFF', kind: 'strike', icon: 'held-staff', fx: 'lightning', el: 'arcane', dmg: 17, cd: 1.2, radius: 18, more: [2, 3, 4, 5], desc: 'LIGHTNING ON FOES' },
  boomerang: { name: 'BOOMERANG', kind: 'boomerang', icon: 'held-boomerang', dmg: 13, cd: 1.15, speed: 160, more: [3, 5], desc: 'OUT AND BACK AGAIN' },
  sunbeam: { name: 'SUN BEAM', kind: 'strike', icon: 'held-khopesh', fx: 'holy-beam', el: 'holy', dmg: 24, cd: 1.5, radius: 22, more: [2, 4, 5], desc: 'BEAMS FROM THE SKY' },
  scrolls: { name: 'SPELL BOOKS', kind: 'orbit', icon: 'book-spell', sprite: 'book-spell', dmg: 11, cd: 0, radius: 30, spin: 3.6, more: [1, 2, 3, 4, 5], desc: 'BOOKS CIRCLE YOU' },
  // found on the way
  aura: { name: 'HOLY AURA', kind: 'aura', icon: 'amulet', fx: 'aura', el: 'holy', dmg: 4, cd: 0.5, radius: 34, more: [], desc: 'HURTS ALL NEAR YOU' },
  frost: { name: 'FROST NOVA', kind: 'nova', icon: 'wand-ice', fx: 'ice-shards', el: 'ice', dmg: 12, cd: 2.6, radius: 56, slow: true, more: [], desc: 'FREEZE A RING AROUND' },
  meteor: { name: 'METEOR', kind: 'strike', icon: 'rune', fx: 'meteor', el: 'fire', dmg: 40, cd: 3.2, radius: 30, delay: 0.5, size: 48, more: [3, 5], desc: 'A ROCK FROM THE SKY' },
  tornado: { name: 'TORNADO', kind: 'tornado', icon: 'feather', fx: 'tornado', dmg: 8, cd: 3.0, life: 3, speed: 50, more: [3, 5], desc: 'A WANDERING STORM' },
  poison: { name: 'POISON FLASK', kind: 'pool', icon: 'bottle', fx: 'poison-cloud', el: 'poison', dmg: 5, cd: 2.4, radius: 26, life: 3, more: [2, 4], desc: 'A CLOUD THAT LINGERS' },
  bombs: { name: 'BOMBS', kind: 'bomb', icon: 'bomb', fx: 'boom', dmg: 30, cd: 2.4, radius: 34, more: [3, 5], desc: 'THROWN, THEN BOOM' },
  shuriken: { name: 'SHURIKEN', kind: 'ring', icon: 'star', fx: 'shuriken', dmg: 8, cd: 1.4, speed: 160, count: 4, pierce: 2, more: [2, 3, 4, 5], desc: 'STARS IN ALL WAYS' },
  dragon: { name: 'DRAGON BREATH', kind: 'breath', icon: 'flame', fx: 'dragon-breath', el: 'fire', dmg: 6, cd: 3.0, life: 1.2, reach: 54, more: [], desc: 'FIRE IN FRONT' },
  void: { name: 'VOID ORB', kind: 'hole', icon: 'gem-onyx', fx: 'black-hole', el: 'dark', dmg: 6, cd: 6, radius: 50, life: 3, more: [], desc: 'PULLS THEM IN' },
}

/**
 * Evolutions: a hero's weapon at level 5, held together with the passive it needs, can turn into something that
 * plays differently (the next level-up offers it). def replaces the weapon's definition.
 */
export const EVOLUTIONS = {
  katana: { needs: 'might', def: { name: 'MOON BLADE', kind: 'arc', icon: 'held-katana-white', fx: 'cross-slash', dmg: 22, cd: 0.7, reach: 28, size: 60, count: 2, wave: true, more: [], desc: 'CUTS BOTH WAYS AND THROWS CRESCENTS' } },
  rapier: { needs: 'boots', def: { name: 'THOUSAND NEEDLES', kind: 'arc', icon: 'held-sword-crystal', fx: 'triple-slash', dmg: 11, cd: 0.28, reach: 30, size: 30, long: 62, fan: 3, more: [], desc: 'THREE LONG THRUSTS AT ONCE' } },
  pilum: { needs: 'armor', def: { name: 'PHALANX', kind: 'arc', icon: 'held-spear-gold', fx: 'thrust', dmg: 20, cd: 0.95, reach: 40, size: 18, long: 84, star: 8, more: [], desc: 'SPEARS IN EIGHT DIRECTIONS' } },
  quake: { needs: 'vigor', def: { name: 'RAGNAROK', kind: 'slam', icon: 'held-axe-gold', fx: 'quake', dmg: 26, cd: 1.5, radius: 58, aftershock: true, geysers: 3, more: [], desc: 'AFTERSHOCKS AND ERUPTIONS' } },
  fan: { needs: 'haste', def: { name: 'BLOSSOM STORM', kind: 'shot', icon: 'held-fan-gold', fx: 'spinner', el: 'arcane', dmg: 12, cd: 0.8, speed: 150, homing: true, pierce: 3, burst: 8, more: [], desc: 'EIGHT SEEKING BLOSSOMS AT ONCE' } },
  arrows: { needs: 'luck', def: { name: 'ARROW STORM', kind: 'shot', icon: 'held-bow-elven', fx: 'arrow', dmg: 13, cd: 0.5, speed: 260, pierce: 99, spread: 5, more: [], desc: 'FIVE ARROWS THROUGH EVERYTHING' } },
  lightning: { needs: 'reach', def: { name: 'THUNDERSTORM', kind: 'strike', icon: 'held-staff-void', fx: 'lightning', el: 'arcane', dmg: 20, cd: 1.0, radius: 20, count: 3, chain: 4, field: true, more: [], desc: 'LIGHTNING JUMPS FROM FOE TO FOE' } },
  boomerang: { needs: 'magnet', def: { name: 'STAR CHAKRAM', kind: 'boomerang', icon: 'held-boomerang-painted', dmg: 16, cd: 1.0, speed: 190, count: 3, wide: 12, gems: true, more: [], desc: 'THREE WIDE BLADES BRING GEMS BACK' } },
  sunbeam: { needs: 'growth', def: { name: 'EYE OF RA', kind: 'sweep', icon: 'ring', fx: 'laser', el: 'holy', dmg: 9, cd: 0, reach: 110, spin: 2.4, beams: 2, more: [], desc: 'TWO SUN RAYS SWEEP AROUND YOU' } },
  scrolls: { needs: 'regen', def: { name: 'LIVING LIBRARY', kind: 'orbit', icon: 'book-red', sprite: 'book-spell', sprite2: 'book-red', dmg: 13, cd: 0, radius: 30, spin: 3.6, count: 5, outer: 5, bolts: 1.0, more: [], desc: 'TWO RINGS OF BOOKS SHOOT BOLTS' } },
}

/**
 * What gold buys between runs, for good. Each level adds step to a stat of the next run (see applyMeta in game.js);
 * the price of the next level is cost * (level + 1).
 */
export const UPGRADES = {
  might: { name: 'MIGHT', icon: 'sword-gold', desc: '+5% DAMAGE', stat: 'might', step: 0.05, max: 5, cost: 40 },
  health: { name: 'HEALTH', icon: 'heart', desc: '+10 MAX HP', stat: 'maxHp', step: 10, max: 5, cost: 30 },
  armor: { name: 'ARMOR', icon: 'armor', desc: '-1 DAMAGE TAKEN', stat: 'armor', step: 1, max: 3, cost: 90 },
  speed: { name: 'SPEED', icon: 'boots', desc: '+3% MOVE SPEED', stat: 'speed', step: 0.03, max: 5, cost: 30 },
  magnet: { name: 'MAGNET', icon: 'compass', desc: '+15% PICKUP RANGE', stat: 'magnet', step: 0.15, max: 3, cost: 40 },
  growth: { name: 'WISDOM', icon: 'crown', desc: '+4% EXPERIENCE', stat: 'growth', step: 0.04, max: 5, cost: 50 },
  greed: { name: 'GREED', icon: 'coin', desc: '+15% GOLD', stat: 'gold', step: 0.15, max: 5, cost: 40 },
  reroll: { name: 'REROLL', icon: 'dice', desc: '+1 REROLL A RUN', stat: 'rerolls', step: 1, max: 3, cost: 70 },
  dash: { name: 'QUICK DASH', icon: 'feather', desc: '8% SHORTER DASH WAIT', stat: 'dash', step: 0.08, max: 3, cost: 60 },
  revive: { name: 'SECOND WIND', icon: 'potion', desc: 'GET UP ONCE A RUN', stat: 'revives', step: 1, max: 1, cost: 400 },
}

/** The dash (Space / Shift): a short burst of speed that nothing can hurt, then a wait. */
export const DASH = { time: 0.16, speed: 4.2, cd: 2.4 }

/** Passives: every level adds the step. */
export const PASSIVES = {
  might: { name: 'MIGHT', icon: 'sword-gold', desc: '+12% DAMAGE', stat: 'might', step: 0.12 },
  armor: { name: 'ARMOR', icon: 'armor', desc: '-1 DAMAGE TAKEN', stat: 'armor', step: 1 },
  vigor: { name: 'VIGOR', icon: 'heart', desc: '+20 MAX HP', stat: 'maxHp', step: 20 },
  haste: { name: 'HOURGLASS', icon: 'hourglass', desc: '8% FASTER WEAPONS', stat: 'haste', step: 0.08 },
  reach: { name: 'GRIMOIRE', icon: 'scroll-magic', desc: '+12% AREA', stat: 'area', step: 0.12 },
  boots: { name: 'BOOTS', icon: 'boots', desc: '+8% MOVE SPEED', stat: 'speed', step: 0.08 },
  magnet: { name: 'COMPASS', icon: 'compass', desc: '+35% PICKUP RANGE', stat: 'magnet', step: 0.35 },
  luck: { name: 'DICE', icon: 'dice', desc: '+6% CRITICAL HITS', stat: 'crit', step: 0.06 },
  growth: { name: 'CROWN', icon: 'crown', desc: '+10% EXPERIENCE', stat: 'growth', step: 0.1 },
  regen: { name: 'APPLE', icon: 'apple', desc: '+0.4 HP EACH SECOND', stat: 'regen', step: 0.4 },
}

/**
 * Monsters: PixSpell bodies. hp/speed/dmg at the start of a run; they get tougher with time.
 * ai: how it comes at you (default: it walks straight in):
 *   'zigzag' weaves, 'charger' stops, then rushes in a line, 'shooter' keeps its distance and spits (shot: the
 *   element of what it spits), 'exploder' lights a fuse next to you, split: it leaves small ones behind.
 */
export const ENEMIES = {
  slime: { spec: { body: 'slime' }, hp: 8, speed: 30, dmg: 6, xp: 1, split: 2 },
  rat: { spec: { body: 'rat' }, hp: 6, speed: 40, dmg: 5, xp: 1 },
  bee: { spec: { body: 'bee' }, hp: 5, speed: 44, dmg: 4, xp: 1, ai: 'zigzag' },
  beetle: { spec: { body: 'beetle' }, hp: 22, speed: 26, dmg: 8, xp: 2 },
  wolf: { spec: { body: 'wolf' }, hp: 20, speed: 44, dmg: 9, xp: 2, ai: 'charger' },
  goblin: { spec: { body: 'goblin', hand: 'dagger' }, hp: 26, speed: 40, dmg: 10, xp: 3 },
  shroom: { spec: { body: 'shroom' }, hp: 30, speed: 24, dmg: 9, xp: 3, ai: 'shooter', shot: 'poison' },
  spider: { spec: { body: 'spider' }, hp: 16, speed: 46, dmg: 8, xp: 2, ai: 'exploder' },
  worm: { spec: { body: 'worm' }, hp: 14, speed: 30, dmg: 7, xp: 1, split: 2 },
  snake: { spec: { body: 'snake' }, hp: 12, speed: 42, dmg: 7, xp: 1, ai: 'zigzag' },
  scorpion: { spec: { body: 'scorpion' }, hp: 20, speed: 38, dmg: 9, xp: 2, ai: 'charger' },
  mummy: { spec: { body: 'mummy' }, hp: 48, speed: 26, dmg: 12, xp: 4 },
  skeleton: { spec: { body: 'skeleton', hat: 'viking', hand: 'axe' }, hp: 34, speed: 38, dmg: 11, xp: 3 },
  imp: { spec: { body: 'imp' }, hp: 20, speed: 46, dmg: 8, xp: 2, ai: 'shooter', shot: 'fire' },
  beetleBomb: { spec: { body: 'beetle-red' }, hp: 18, speed: 44, dmg: 8, xp: 2, ai: 'exploder' },
  bunny: { spec: { body: 'bunny' }, hp: 8, speed: 42, dmg: 5, xp: 1, ai: 'zigzag' },
  penguin: { spec: { body: 'penguin' }, hp: 16, speed: 38, dmg: 7, xp: 1, ai: 'charger' },
  wisp: { spec: { body: 'wisp' }, hp: 10, speed: 46, dmg: 8, xp: 2, ai: 'exploder' },
  ghost: { spec: { body: 'ghost' }, hp: 24, speed: 40, dmg: 9, xp: 2, steady: true },
  skull: { spec: { body: 'skull' }, hp: 20, speed: 40, dmg: 9, xp: 2, ai: 'shooter', shot: 'dark' },
  yeti: { spec: { body: 'yeti' }, hp: 70, speed: 30, dmg: 15, xp: 6 },
  // a chest with legs: it runs from you, and pays well if you catch it
  mimic: { spec: { body: 'mimic' }, hp: 90, speed: 50, dmg: 0, xp: 12, ai: 'runner', steady: true },
  // big ones: drawn twice the size, each with a twist (see ELITES)
  boar: { spec: { body: 'boar' }, hp: 260, speed: 38, dmg: 11, xp: 25, big: true, ai: 'charger' },
  golem: { spec: { body: 'golem' }, hp: 420, speed: 26, dmg: 13, xp: 40, big: true },
  // bosses: moves they cycle through, each one shown on the ground before it lands
  'golem-king': { spec: { body: 'golem', hat: 'crown' }, hp: 3200, speed: 30, dmg: 15, xp: 200, big: true, boss: 'THE STONE KING', moves: ['slam', 'boulders', 'charge'] },
  'mummy-king': { spec: { body: 'mummy', hat: 'nemes' }, hp: 3400, speed: 32, dmg: 15, xp: 200, big: true, boss: 'THE SAND PHARAOH', moves: ['summon', 'ring', 'fan'], minion: 'skeleton', shot: 'dark' },
  'yeti-king': { spec: { body: 'yeti', hat: 'crown' }, hp: 3600, speed: 32, dmg: 16, xp: 200, big: true, boss: 'THE FROST KING', moves: ['spikes', 'ring', 'charge'], shot: 'ice' },
  'dragon-king': { spec: { body: 'baby-dragon', hat: 'crown' }, hp: 9000, speed: 34, dmg: 18, xp: 500, big: true, boss: 'THE DRAGON KING', final: true, moves: ['breath', 'rain', 'summon', 'ring', 'charge'], minion: 'imp', shot: 'fire' },
}

/** What makes an elite different: one of these, picked when it arrives. */
export const ELITES = {
  swift: { name: 'SWIFT', color: '#7fe3ff' },
  armored: { name: 'ARMORED', color: '#cfd8e0' },
  summoner: { name: 'SUMMONER', color: '#c58bff' },
  volatile: { name: 'VOLATILE', color: '#ff8a4a' },
}

/** Stages: the ground (a base tile and autotiled patches), decorations, music, who comes when, and the bosses. */
export const STAGES = [
  {
    id: 'meadow', name: 'GREEN MEADOW', music: 'field', base: 'grass', patches: [['dirt', 0.62], ['grass-dry', 0.72]],
    decor: ['flower', 'flower-blue', 'flower-sun', 'rock', 'bush', 'stump', 'mushroom'],
    waves: [[0, ['slime', 'rat']], [45, ['slime', 'rat', 'bee']], [100, ['bee', 'beetle', 'wolf']], [170, ['wolf', 'goblin', 'spider']], [260, ['goblin', 'shroom', 'wolf', 'beetle']], [360, ['shroom', 'goblin', 'skeleton', 'spider']]],
    elites: ['boar', 'golem'], bosses: [[240, 'golem-king'], [450, 'dragon-king']],
  },
  {
    id: 'desert', name: 'SUNKEN SANDS', music: 'desert', base: 'dirt-sand', patches: [['cobblestone-sand', 0.68], ['grass-dry', 0.72]],
    decor: ['cactus', 'bones', 'rock', 'stone-sandstone', 'tombstone'],
    waves: [[0, ['worm', 'snake']], [45, ['worm', 'snake', 'scorpion']], [100, ['scorpion', 'skeleton', 'snake']], [170, ['mummy', 'skeleton', 'imp']], [260, ['mummy', 'scorpion', 'imp', 'beetleBomb']], [360, ['mummy', 'skeleton', 'imp', 'beetleBomb']]],
    elites: ['boar', 'golem'], bosses: [[240, 'mummy-king'], [450, 'dragon-king']],
  },
  {
    id: 'frost', name: 'FROST HOLLOW', music: 'snow', base: 'stone', patches: [['grass-snow', 0.42], ['lava-frozen', 0.8]], // grey stone under drifts, so white monsters stand out
    decor: ['pine-tree-snowy', 'tree-snowy', 'rock', 'crystals', 'stump'],
    waves: [[0, ['bunny', 'penguin']], [45, ['bunny', 'penguin', 'ghost']], [100, ['ghost', 'penguin', 'wisp']], [170, ['skull', 'yeti', 'ghost']], [260, ['yeti', 'skull', 'wisp', 'ghost']], [360, ['yeti', 'ghost', 'skull', 'wisp']]],
    elites: ['golem', 'boar'], bosses: [[240, 'yeti-king'], [450, 'dragon-king']],
  },
]

export const RUN_SECONDS = 480 // the dragon comes at 7:30; beat it to win
export const xpFor = (lv) => 3 + lv * 4 + Math.floor(lv * lv * 0.55)
