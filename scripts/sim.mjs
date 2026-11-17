#!/usr/bin/env node
// Plays whole runs with the demo pilot, fast, to check balance: node scripts/sim.mjs [runs per hero] [stage]
// For every hero: how long it lasted, its level, when its weapon evolved, and what it carried at the end.
import { HEROES, STAGES } from '../src/data.js'
import { newGame, step } from '../src/game.js'
import { autopilot, autoChoose } from '../src/pilot.js'

const runs = Number(process.argv[2] ?? 2), only = process.argv[3]
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`

export function play(hero, stage, { maxSeconds = 600, dt = 1 / 30 } = {}) {
  const g = newGame(stage, hero.id)
  let evoAt = null, peak = 0
  while (!g.over && g.t < maxSeconds) {
    step(g, dt, autopilot(g))
    if (g.choices) autoChoose(g)
    if (evoAt == null && g.weapons[0].evo) evoAt = g.t
    peak = Math.max(peak, g.enemies.length)
  }
  return { g, evoAt, peak }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const stage of STAGES.filter((s) => !only || s.id === only)) {
    console.log(`\n== ${stage.name}`)
    for (const hero of HEROES) {
      const out = []
      for (let i = 0; i < runs; i++) {
        const { g, evoAt, peak } = play(hero, stage)
        out.push(`${g.won ? 'WON ' : 'fell'} ${mmss(g.t)} lv${g.lv} kills ${g.kills} evo ${evoAt == null ? '-' : mmss(evoAt)} peak ${peak} [${g.weapons.map((w) => (w.evo ? '*' : '') + w.id + w.lv).join(' ')}]`)
      }
      console.log(hero.id.padEnd(10), out.join('\n           '))
    }
  }
}
