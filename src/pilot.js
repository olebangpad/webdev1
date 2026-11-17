// The demo's pilot: plays a run by itself (?demo), and the balance tests use it too.
import { WEAPONS, EVOLUTIONS, CLOSE } from './data.js'
import { choose } from './game.js'

/** Where to walk: away from the crowd, toward gems and chests, at fighting distance from the nearest foe. */
export function autopilot(g) {
  if (!g) return null
  const p = g.p
  let vx = 0, vy = 0, close = null, cd = 1e9, crowd = 0
  for (const e of g.enemies) {
    const dx = p.x - e.x, dy = p.y - e.y, d2 = dx * dx + dy * dy
    if (d2 < cd) { cd = d2; close = e }
    if (d2 < 70 * 70) { const w = (e.big ? 3 : 1) / Math.max(60, d2); vx += dx * w; vy += dy * w }
    if (d2 < 26 * 26) crowd++
  }
  for (const s of g.hostile ?? []) { // step out of the way of what's flying at you
    const dx = p.x - s.x, dy = p.y - 8 - s.y, d2 = dx * dx + dy * dy
    if (d2 < 50 * 50) { vx += (dx / Math.max(80, d2)) * 2; vy += (dy / Math.max(80, d2)) * 2 }
  }
  for (const z of g.dangers ?? []) { // and out of marked ground
    const dx = p.x - z.x, dy = p.y - z.y, d = Math.hypot(dx, dy) || 1
    if (d < z.r + 14) { vx += (dx / d) * 0.05; vy += (dy / d) * 0.05 }
  }
  // keep the nearest one at fighting distance: back off when it's on you, step in when it's far, else circle it
  const kind = g.weapons[0]?.def.kind ?? WEAPONS[g.hero.weapon].kind
  if (close) {
    const near = close.r + (CLOSE.has(kind) ? 16 : 28), far = near + (CLOSE.has(kind) ? 14 : 30) // just out of its reach
    const d = Math.sqrt(cd) || 1, ux = (close.x - p.x) / d, uy = (close.y - p.y) / d
    if (d > far) { vx += ux * 0.02; vy += uy * 0.02 } else if (d > near) { vx += -uy * 0.015; vy += ux * 0.015 }
  }
  let best = null, bd = 1e9
  for (const gem of g.gems) { const d = (gem.x - p.x) ** 2 + (gem.y - p.y) ** 2; if (d < bd) { bd = d; best = gem } }
  for (const d of g.drops) { const dd = (d.x - p.x) ** 2 + (d.y - p.y) ** 2; if (dd < bd * 2) { bd = dd / 2; best = d } }
  if (best && bd < 150 * 150) { const d = Math.sqrt(bd) || 1; vx += ((best.x - p.x) / d) * 0.01; vy += ((best.y - p.y) / d) * 0.01 }
  const a = g.t * 0.35 // and keep drifting round in a slow circle, so the camera travels
  vx += Math.cos(a) * 0.004; vy += Math.sin(a) * 0.004
  if (crowd >= 3 && p.dashCd <= 0) g.wantDash = true // boxed in: dash out
  return Math.hypot(vx, vy) > 0.0005 ? [vx, vy] : null
}

/** What to take at a level-up: an evolution, what leads to one, a new weapon, a stronger one. */
export function autoChoose(g) {
  const c = g.choices
  const need = EVOLUTIONS[g.hero.weapon]?.needs
  const it = c.find((x) => x.type === 'evo')
    ?? c.find((x) => x.type === 'w' && x.id === g.hero.weapon)
    ?? c.find((x) => x.type === 'p' && x.id === need && x.lv === 1)
    ?? c.find((x) => x.type === 'w' && x.lv === 1)
    ?? c.find((x) => x.type === 'w')
    ?? c[0]
  choose(g, it)
}
