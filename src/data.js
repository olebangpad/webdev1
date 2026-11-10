// Everything the game is made of, as data. Every look is a PixSpell call: a character spec, a sprite id or an effect.

/** Heroes: PixSpell's people from around the world, each with the weapon that fits how they fight. */
/** How close a hero likes to fight (the demo pilot uses it): blades and orbits up close, the rest from range. */
export const CLOSE = new Set(['arc', 'slam', 'orbit', 'aura'])
export const HEROES = [
  { id: 'samurai', from: 'JAPAN', weapon: 'katana', hp: 110, speed: 54, note: 'SLASHES WHAT IS IN FRONT' },
  { id: 'viking', from: 'SCANDINAVIA', weapon: 'quake', hp: 140, speed: 48, note: 'SHAKES THE GROUND AROUND' },
  { id: 'hanbok', from: 'KOREA', weapon: 'fan', hp: 90, speed: 58, note: 'FANS OUT SEEKING PETALS' },
  { id: 'deel', from: 'MONGOLIA', weapon: 'arrows', hp: 95, speed: 60, note: 'SHOOTS THE NEAREST FOE' },
  { id: 'kente', from: 'GHANA', weapon: 'lightning', hp: 95, speed: 54, note: 'CALLS DOWN CHAIN LIGHTNING' },
  { id: 'legionary', from: 'ROME', weapon: 'pilum', hp: 125, speed: 50, note: 'A SPEAR THAT PIERCES ROWS' },
  { id: 'musketeer', from: 'FRANCE', weapon: 'rapier', hp: 100, speed: 58, note: 'QUICK STABS, MANY OF THEM' },
  { id: 'outback', from: 'AUSTRALIA', weapon: 'boomerang', hp: 105, speed: 56, note: 'IT ALWAYS COMES BACK' },
  { id: 'pharaoh', from: 'EGYPT', weapon: 'sunbeam', hp: 100, speed: 52, note: 'BEAMS OF THE SUN STRIKE' },
  { id: 'seonbi', from: 'KOREA', weapon: 'scrolls', hp: 95, speed: 54, note: 'SPELL BOOKS CIRCLE AROUND' },
]

/**
 * Weapons. kind picks the behavior (weapons.js); dmg/cd at level 1; every level adds 25% damage and 6% speed, and
 * the levels listed in more add one more of whatever the weapon makes. icon: a sprite, fx: the effect it draws.
 */
export const WEAPONS = {
  katana: { name: 'KATANA', kind: 'arc', icon: 'held-katana', fx: 'cross-slash', dmg: 15, cd: 0.85, reach: 24, size: 42, more: [3, 5], desc: 'SLASH IN FRONT' },
  rapier: { name: 'RAPIER', kind: 'arc', icon: 'held-sword', fx: 'stab', dmg: 8, cd: 0.33, reach: 22, size: 26, more: [2, 4], desc: 'FAST STABS' },
  pilum: { name: 'PILUM', kind: 'arc', icon: 'held-spear', fx: 'thrust', dmg: 16, cd: 0.95, reach: 40, size: 18, long: 72, more: [3, 5], desc: 'PIERCES A WHOLE ROW' },
  quake: { name: 'QUAKE AXE', kind: 'slam', icon: 'held-axe', fx: 'quake', dmg: 20, cd: 1.6, radius: 46, more: [], desc: 'SLAM AROUND YOU' },
  fan: { name: 'PETAL FAN', kind: 'shot', icon: 'held-fan', fx: 'orb', el: 'nature', dmg: 10, cd: 0.75, speed: 130, homing: true, pierce: 1, more: [2, 3, 5], desc: 'SEEKING PETALS' },
  arrows: { name: 'HORSE BOW', kind: 'shot', icon: 'held-bow', fx: 'arrow', dmg: 11, cd: 0.55, speed: 230, pierce: 1, more: [2, 4, 5], desc: 'ARROWS AT THE NEAREST' },
  lightning: { name: 'STORM STAFF', kind: 'strike', icon: 'held-staff', fx: 'chain-lightning', el: 'arcane', dmg: 17, cd: 1.2, radius: 18, more: [2, 3, 4, 5], desc: 'LIGHTNING ON FOES' },
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

/** Monsters: PixSpell bodies. hp/speed/dmg at the start of a run; they get tougher with time. */
export const ENEMIES = {
  slime: { spec: { body: 'slime' }, hp: 8, speed: 30, dmg: 6, xp: 1 },
  rat: { spec: { body: 'rat' }, hp: 6, speed: 40, dmg: 5, xp: 1 },
  bee: { spec: { body: 'bee' }, hp: 5, speed: 44, dmg: 4, xp: 1 },
  beetle: { spec: { body: 'beetle' }, hp: 18, speed: 26, dmg: 8, xp: 2 },
  wolf: { spec: { body: 'wolf' }, hp: 20, speed: 48, dmg: 9, xp: 2 },
  goblin: { spec: { body: 'goblin', hand: 'dagger' }, hp: 26, speed: 40, dmg: 10, xp: 3 },
  shroom: { spec: { body: 'shroom' }, hp: 32, speed: 24, dmg: 10, xp: 3 },
  scorpion: { spec: { body: 'scorpion' }, hp: 20, speed: 40, dmg: 9, xp: 2 },
  snake: { spec: { body: 'snake' }, hp: 14, speed: 44, dmg: 8, xp: 2 },
  worm: { spec: { body: 'worm' }, hp: 16, speed: 30, dmg: 7, xp: 1 },
  mummy: { spec: { body: 'mummy' }, hp: 48, speed: 26, dmg: 12, xp: 4 },
  skeleton: { spec: { body: 'skeleton', hat: 'viking', hand: 'axe' }, hp: 34, speed: 38, dmg: 11, xp: 3 },
  imp: { spec: { body: 'imp' }, hp: 22, speed: 48, dmg: 9, xp: 2 },
  wisp: { spec: { body: 'wisp' }, hp: 10, speed: 44, dmg: 7, xp: 1 },
  ghost: { spec: { body: 'ghost' }, hp: 24, speed: 44, dmg: 9, xp: 2 },
  skull: { spec: { body: 'skull' }, hp: 20, speed: 42, dmg: 9, xp: 2 },
  penguin: { spec: { body: 'penguin' }, hp: 16, speed: 42, dmg: 7, xp: 1 },
  yeti: { spec: { body: 'yeti' }, hp: 70, speed: 30, dmg: 15, xp: 6 },
  // big ones: drawn twice the size
  boar: { spec: { body: 'boar' }, hp: 260, speed: 40, dmg: 11, xp: 25, big: true },
  golem: { spec: { body: 'golem' }, hp: 420, speed: 26, dmg: 13, xp: 40, big: true },
  // bosses
  'golem-king': { spec: { body: 'golem', hat: 'crown' }, hp: 2600, speed: 30, dmg: 15, xp: 200, big: true, boss: 'THE STONE KING' },
  'mummy-king': { spec: { body: 'mummy', hat: 'nemes' }, hp: 3200, speed: 34, dmg: 15, xp: 200, big: true, boss: 'THE SAND PHARAOH' },
  'yeti-king': { spec: { body: 'yeti', hat: 'crown' }, hp: 3400, speed: 34, dmg: 16, xp: 200, big: true, boss: 'THE FROST KING' },
  'dragon-king': { spec: { body: 'baby-dragon', hat: 'crown' }, hp: 7000, speed: 36, dmg: 18, xp: 500, big: true, boss: 'THE DRAGON KING', final: true },
}

/** Stages: the ground (a base tile and autotiled patches), decorations, music, who comes when, and the bosses. */
export const STAGES = [
  {
    id: 'meadow', name: 'GREEN MEADOW', music: 'field', base: 'grass', patches: [['dirt', 0.62], ['grass-dry', 0.72]],
    decor: ['flower', 'flower-blue', 'flower-sun', 'rock', 'bush', 'stump', 'mushroom'],
    waves: [[0, ['slime', 'rat']], [45, ['slime', 'rat', 'bee']], [100, ['bee', 'beetle', 'wolf']], [170, ['wolf', 'goblin', 'beetle']], [260, ['goblin', 'shroom', 'wolf']], [360, ['shroom', 'goblin', 'skeleton']]],
    elites: ['boar', 'golem'], bosses: [[240, 'golem-king'], [450, 'dragon-king']],
  },
  {
    id: 'desert', name: 'SUNKEN SANDS', music: 'desert', base: 'dirt-sand', patches: [['cobblestone-sand', 0.68], ['grass-dry', 0.72]],
    decor: ['cactus', 'bones', 'rock', 'stone-sandstone', 'tombstone'],
    waves: [[0, ['worm', 'snake']], [45, ['snake', 'scorpion']], [100, ['scorpion', 'skeleton', 'imp']], [170, ['mummy', 'skeleton', 'imp']], [260, ['mummy', 'scorpion', 'imp']], [360, ['mummy', 'skeleton', 'imp']]],
    elites: ['boar', 'golem'], bosses: [[240, 'mummy-king'], [450, 'dragon-king']],
  },
  {
    id: 'frost', name: 'FROST HOLLOW', music: 'snow', base: 'stone', patches: [['grass-snow', 0.42], ['lava-frozen', 0.8]], // grey stone under drifts, so white monsters stand out
    decor: ['pine-tree-snowy', 'tree-snowy', 'rock', 'crystals', 'stump'],
    waves: [[0, ['penguin', 'wisp']], [45, ['wisp', 'ghost', 'penguin']], [100, ['ghost', 'skull', 'imp']], [170, ['skull', 'yeti', 'ghost']], [260, ['yeti', 'skull', 'wisp']], [360, ['yeti', 'ghost', 'skull']]],
    elites: ['golem', 'boar'], bosses: [[240, 'yeti-king'], [450, 'dragon-king']],
  },
]

export const RUN_SECONDS = 480 // the dragon comes at 7:30; beat it to win
export const xpFor = (lv) => 3 + lv * 3 + Math.floor(lv * lv * 0.25)
