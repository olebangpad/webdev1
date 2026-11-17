// What lasts between runs: gold in the bank, what it bought, who is unlocked, and the best runs.
// Pure functions on a plain save object (save.js keeps it in the browser), so the rules are tested in Node.
import { HEROES, UPGRADES } from './data.js'

export const newSave = () => ({ v: 1, gold: 0, upgrades: {}, heroes: HEROES.filter((h) => !h.cost).map((h) => h.id), best: {}, runs: 0, wins: 0, kills: 0 })

/** A save from storage, made whole: missing fields filled in, nothing unknown trusted. */
export function repair(raw) {
  const s = newSave()
  if (!raw || typeof raw !== 'object') return s
  s.gold = Math.max(0, Math.floor(Number(raw.gold) || 0))
  for (const [id, up] of Object.entries(UPGRADES)) { const lv = Math.floor(Number(raw.upgrades?.[id]) || 0); if (lv > 0) s.upgrades[id] = Math.min(up.max, lv) }
  for (const h of HEROES) if (h.cost && Array.isArray(raw.heroes) && raw.heroes.includes(h.id)) s.heroes.push(h.id)
  if (raw.best && typeof raw.best === 'object') for (const [k, b] of Object.entries(raw.best)) if (b && Number.isFinite(b.time)) s.best[k] = { time: b.time, won: !!b.won, hero: String(b.hero ?? ''), lv: Number(b.lv) || 1, kills: Number(b.kills) || 0 }
  for (const k of ['runs', 'wins', 'kills']) s[k] = Math.max(0, Math.floor(Number(raw[k]) || 0))
  return s
}

export const levelOf = (save, id) => save.upgrades[id] ?? 0
/** The price of the next level of an upgrade, or null when it is maxed. */
export const priceOf = (save, id) => (levelOf(save, id) >= UPGRADES[id].max ? null : UPGRADES[id].cost * (levelOf(save, id) + 1))
export function buyUpgrade(save, id) {
  const price = priceOf(save, id)
  if (price == null || save.gold < price) return false
  save.gold -= price
  save.upgrades[id] = levelOf(save, id) + 1
  return true
}
export const hasHero = (save, id) => save.heroes.includes(id)
export function buyHero(save, id) {
  const hero = HEROES.find((h) => h.id === id)
  if (!hero || hasHero(save, id) || save.gold < hero.cost) return false
  save.gold -= hero.cost
  save.heroes.push(id)
  return true
}

/** The gold a finished run pays: what was picked up, a little for every kill and every second, more for a win. */
export function payout(g) {
  const parts = { found: Math.round(g.gold), kills: Math.floor(g.kills / 25), time: Math.floor(g.t / 6), win: g.won ? 150 : 0 }
  return { ...parts, total: parts.found + parts.kills + parts.time + parts.win }
}
/** Put a finished run in the books. Returns what it paid and whether it was the best on its stage. */
export function bank(save, g) {
  const pay = payout(g)
  save.gold += pay.total
  save.runs++; save.kills += g.kills
  if (g.won) save.wins++
  const old = save.best[g.stage.id]
  // a win beats any loss; between wins the faster one, between losses the longer one
  const better = !old || (g.won && !old.won) || (g.won === old.won && (g.won ? g.t < old.time : g.t > old.time))
  if (better) save.best[g.stage.id] = { time: g.t, won: g.won, hero: g.hero.id, lv: g.lv, kills: g.kills }
  return { ...pay, record: better }
}
