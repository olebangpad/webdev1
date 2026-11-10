// PixSpell, loaded once, and everything drawn from it kept (made once, drawn many times).
// On GitHub Pages it comes from a pinned version on the CDN; on localhost from a checkout next to this repo (/dog).
const CDN = 'https://cdn.jsdelivr.net/gh/olebangpad/pixspell@822f986be33bba615f7a671244560edb25143e8d/src/index.js'
const params = new URLSearchParams(location.search)
const url = params.get('pixspell') ?? (/^(localhost|127\.)/.test(location.hostname) && params.has('local') ? '/dog/src/index.js' : CDN)
export const { spell, text, Pixmap } = await import(url)

let memo = new Map()
const once = (key, make) => (memo.has(key) ? memo.get(key) : (memo.set(key, make()), memo.get(key)))
const k = (x) => JSON.stringify(x)

export const walk = (spec, dir) => once('w' + k(spec) + dir, () => spell.walk(spec, dir))
export const idle = (spec) => once('i' + k(spec), () => spell.char.frames(spec))
export const fx = (name, opts = {}) => once('x' + name + k(opts), () => spell.fx(name, opts))
export const sprite = (id, opts = {}) => once('s' + id + k(opts), () => spell(id, opts))
export const frames = (id) => once('f' + id, () => spell.frames(id))
/** The same frames, every pixel white: the flash when something gets hit. */
export const white = (fr, key) => once('white' + key, () => Object.assign(fr.map((f) => f.map((c) => (c[3] ? [255, 255, 255, c[3]] : c))), { fps: fr.fps, origin: fr.origin }))
/** Twice the size (bosses and elites). */
export const big = (fr, key) => once('big' + key, () => Object.assign(fr.map((f) => f.scale(2)), { fps: fr.fps, origin: [fr.origin[0] * 2, fr.origin[1] * 2] }))
/** Pixel text, outlined so it reads on any ground. */
export const label = (s, color = '#ffffff', z = 1) => once(`t${s}|${color}|${z}`, () => pal(text(String(s), { color }).outline('#0b0f14').scale(z)))

// retro palettes: everything made after this is in the new colors
export const PALETTES = [null, 'gameboy', 'pico-8', 'sweetie-16', 'c64', '1-bit']
export let palName = null
const pal = (img) => (palName ? spell.toPalette(img, palName) : img)
export const color = (hex) => once('c' + hex, () => { const [r, g, b] = pal(Pixmap.create(1, 1, hex)).get(0, 0); return `rgb(${r},${g},${b})` })
export function setPalette(name) {
  palName = name
  spell.palette(name)
  memo = new Map()
}

// sound: effects (never more than one of a kind every 60 ms) and music
let unlocked = false, muted = false
const last = new Map()
export const audio = {
  unlock() { if (!unlocked) { unlocked = true; if (this.track && !muted) spell.music.play(this.track) } },
  get muted() { return muted },
  toggle() { muted = !muted; spell.mute(muted); if (!muted && this.track) spell.music.play(this.track) },
  sfx(name, opts, volume = 0.4) {
    if (!unlocked || muted) return
    const now = performance.now()
    if (now - (last.get(name) ?? 0) < 60) return
    last.set(name, now)
    try { spell.sfx(name, opts).play({ volume }) } catch {}
  },
  music(name) { this.track = name; if (unlocked && !muted) spell.music.play(name, { fade: 0.6 }) },
  track: null,
}
spell.volume('music', 0.4)
