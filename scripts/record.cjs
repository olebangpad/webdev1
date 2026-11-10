#!/usr/bin/env node
// Records docs/worldfall.gif from the demo, frame by frame (the page clock is stepped, so it never stutters).
// Dev only: needs Playwright, ffmpeg, and a static server at the folder that holds this repo and a PixSpell checkout:
//   git clone https://github.com/olebangpad/pixspell dog
//   python3 -m http.server 8770 --bind 127.0.0.1      (in the folder above both)
//   node scripts/record.cjs
const { chromium } = require('playwright')
const { execFileSync } = require('node:child_process')
const { mkdtempSync, rmSync } = require('node:fs')
const { join } = require('node:path')
const os = require('node:os')

const URL = process.env.URL ?? 'http://127.0.0.1:8770/webdev1/index.html?local&demo&warm=236&stage=meadow&hero=viking'
const SECONDS = Number(process.env.SECONDS ?? 7), FPS = 10
;(async () => {
  const dir = mkdtempSync(join(os.tmpdir(), 'worldfall-'))
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 880, height: 560 } })
  await p.clock.install({ time: 0 })
  await p.goto(URL, { waitUntil: 'networkidle' })
  await p.clock.pauseAt((await p.evaluate(() => Date.now())) + 50)
  await p.clock.runFor(3000) // the demo picks its hero, then fast-forwards the run
  for (let i = 0; i < SECONDS * FPS; i++) {
    await p.clock.runFor(1000 / FPS)
    await p.locator('#game').screenshot({ path: join(dir, `f${String(i).padStart(4, '0')}.png`) })
  }
  await b.close()
  execFileSync('ffmpeg', ['-y', '-framerate', String(FPS), '-i', join(dir, 'f%04d.png'), '-vf',
    'split[a][b];[a]palettegen=max_colors=64:stats_mode=full[p];[b][p]paletteuse=dither=none', '-loop', '0', join(__dirname, '..', 'docs', 'worldfall.gif')], { stdio: 'ignore' })
  rmSync(dir, { recursive: true, force: true })
  console.log('wrote docs/worldfall.gif')
})()
