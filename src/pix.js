// PixSpell, loaded once, and everything drawn from it kept (made once, drawn many times).
// On GitHub Pages it comes from a pinned version on the CDN; on localhost from a checkout next to this repo (/dog).
const CDN = 'https://cdn.jsdelivr.net/gh/olebangpad/pixspell@822f986be33bba615f7a671244560edb25143e8d/src/index.js'
const params = new URLSearchParams(location.search)
const url = params.get('pixspell') ?? (/^(localhost|127\.)/.test(location.hostname) && params.has('local') ? '/dog/src/index.js' : CDN)
export const { spell, text, Pixmap } = await import(url)
import { tr } from './ko.js'

let memo = new Map()
const once = (key, make) => (memo.has(key) ? memo.get(key) : (memo.set(key, make()), memo.get(key)))
const k = (x) => JSON.stringify(x)

export const walk = (spec, dir) => once('w' + k(spec) + dir, () => spell.walk(spec, dir))
/** The same walk at half size (an 8 px grid): what a slime splits into. */
export const walkMini = (spec, dir) => once('m' + k(spec) + dir, () => spell.walk(spec, dir, { grid: 8 }))
export const idle = (spec) => once('i' + k(spec), () => spell.char.frames(spec))
export const fx = (name, opts = {}) => once('x' + name + k(opts), () => spell.fx(name, opts))
export const sprite = (id, opts = {}) => once('s' + id + k(opts), () => spell(id, opts))
export const frames = (id) => once('f' + id, () => spell.frames(id))
/** The same frames, every pixel white: the flash when something gets hit. */
export const white = (fr, key) => once('white' + key, () => Object.assign(fr.map((f) => f.map((c) => (c[3] ? [255, 255, 255, c[3]] : c))), { fps: fr.fps, origin: fr.origin }))
/** Twice the size (bosses and elites). */
export const big = (fr, key) => once('big' + key, () => Object.assign(fr.map((f) => f.scale(2)), { fps: fr.fps, origin: [fr.origin[0] * 2, fr.origin[1] * 2] }))
// ------------------------------------------------------------------ text, in two languages
// English: PixSpell's pixel font. Korean (L): the pixel font has no Hangul, so it is drawn with a web font at the
// screen's real resolution (K device pixels to one game pixel), which keeps it sharp at any window size.
export let lang = 'en'
let K = 1
export function setLang(l) { lang = l; memo = new Map() }
export function setScale(k) { if (k !== K) { K = k; for (const key of [...memo.keys()]) if (key.startsWith('T')) memo.delete(key) } }
const KO_FONT = "'DungGeunMo', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif"
const koSize = (z) => Math.round((z === 1 ? 8 : 6.5 * z) * K) // device px
const measurer = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null
/** How wide a Korean string will be, in game pixels. */
export function koWidth(s, z = 1) { measurer.font = `${koSize(z)}px ${KO_FONT}`; return measurer.measureText(s).width / K }
function koLabel(s, hex, z) {
  const size = koSize(z), pad = Math.ceil(K * 1.5)
  measurer.font = `${size}px ${KO_FONT}`
  const c = document.createElement('canvas')
  c.width = Math.ceil(measurer.measureText(s).width) + pad * 2; c.height = Math.ceil(size * 1.25) + pad * 2
  const g = c.getContext('2d')
  g.font = `${size}px ${KO_FONT}`; g.textBaseline = 'top'; g.lineJoin = 'round'
  g.lineWidth = Math.max(2, K * (z > 1 ? 1.6 : 1.2) * 2); g.strokeStyle = color('#0b0f14'); g.strokeText(s, pad, pad + size * 0.08)
  g.fillStyle = color(hex); g.fillText(s, pad, pad + size * 0.08)
  return { canvas: c, w: c.width / K, h: c.height / K }
}
/** Text, outlined so it reads on any ground. In Korean, what has a translation is drawn in Korean. */
export const label = (s, hex = '#ffffff', z = 1) => {
  const ko = lang === 'ko' ? tr(String(s)) : null
  return ko ? rawKo(ko, hex, z) : once(`t${s}|${hex}|${z}`, () => pal(text(String(s), { color: hex }).outline('#0b0f14').scale(z)))
}
/** Korean text as it is (already translated: wrapped lines). */
export const rawKo = (s, hex = '#ffffff', z = 1) => once(`T${s}|${hex}|${z}`, () => koLabel(s, hex, z))

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
