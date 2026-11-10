// The game server: serves the web page and runs the world over WebSockets.
//   npm start                         http://localhost:8080
//   PIXSPELL_DIR=../pixspell npm start  draw with a local PixSpell checkout instead of the CDN (offline development)

import { createServer } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { join, normalize, extname, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import { World } from './world.js'
import { TICK_MS } from '../shared/data.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = Number(process.env.PORT ?? 8080)
const PIXSPELL_DIR = process.env.PIXSPELL_DIR ? resolve(ROOT, process.env.PIXSPELL_DIR) : null
// pinned so a change in PixSpell never breaks a running game; bump it on purpose
const PIXSPELL_CDN = process.env.PIXSPELL_URL ?? 'https://cdn.jsdelivr.net/gh/olebangpad/pixspell@822f986/src/index.js'
const DATA = process.env.DATA_FILE ?? join(ROOT, 'data', 'players.json')

// ------------------------------------------------------------------ saved characters: one JSON file
const players = existsSync(DATA) ? JSON.parse(readFileSync(DATA, 'utf8')) : {}
let dirty = false
const store = { load: (name) => players[name] ?? null, save: (name, data) => { players[name] = data; dirty = true } }
async function flush() {
  if (!dirty) return
  dirty = false
  await mkdir(dirname(DATA), { recursive: true })
  await writeFile(DATA, JSON.stringify(players))
}
setInterval(flush, 15_000).unref()

// ------------------------------------------------------------------ the page
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' }
async function serve(req, res) {
  const url = new URL(req.url, 'http://x')
  let path = decodeURIComponent(url.pathname)
  if (path === '/config.js') {
    const pix = PIXSPELL_DIR ? '/pixspell/src/index.js' : PIXSPELL_CDN
    res.writeHead(200, { 'content-type': TYPES['.js'], 'cache-control': 'no-store' })
    return res.end(`export const PIXSPELL = ${JSON.stringify(pix)}\n`)
  }
  if (path === '/health') { res.writeHead(200); return res.end(`ok ${world.players.size}`) }
  let base = join(ROOT, 'client')
  if (path.startsWith('/shared/')) { base = join(ROOT, 'shared'); path = path.slice(7) }
  else if (path.startsWith('/pixspell/') && PIXSPELL_DIR) { base = PIXSPELL_DIR; path = path.slice(9) }
  if (path.endsWith('/')) path += 'index.html'
  const file = normalize(join(base, path))
  if (!file.startsWith(base)) { res.writeHead(403); return res.end() }
  try {
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' })
    res.end(body)
  } catch {
    res.writeHead(404); res.end('not found')
  }
}

// ------------------------------------------------------------------ the world, over WebSockets
const sockets = new Map() // player id -> ws
const world = new World({
  send: (id, msg) => { const ws = sockets.get(id); if (ws?.readyState === 1) ws.send(JSON.stringify(msg)) },
  store,
})
setInterval(() => world.tick(), TICK_MS)

const http = createServer(serve)
const wss = new WebSocketServer({ server: http, path: '/ws', maxPayload: 1024 })
let nextId = 0
wss.on('connection', (ws) => {
  const id = `p${++nextId}`
  let joined = false, budget = 30, alive = true
  const refill = setInterval(() => { budget = 30 }, 1000) // at most 30 messages a second
  ws.on('pong', () => { alive = true })
  const ping = setInterval(() => { if (!alive) return ws.terminate(); alive = false; ws.ping() }, 30_000)
  ws.on('message', (raw) => {
    if (--budget < 0) return
    let msg
    try { msg = JSON.parse(raw) } catch { return }
    if (!joined) {
      if (msg?.t !== 'join') return
      sockets.set(id, ws)
      const r = world.join(id, msg)
      if (r.error) { sockets.delete(id); return ws.send(JSON.stringify({ t: 'error', text: r.error })) }
      joined = true
      return
    }
    world.input(id, msg)
  })
  ws.on('close', () => {
    clearInterval(refill); clearInterval(ping)
    if (joined) world.leave(id)
    sockets.delete(id)
  })
})

http.listen(PORT, () => console.log(`달무리 server on http://localhost:${PORT} (PixSpell: ${PIXSPELL_DIR ? 'local ' + PIXSPELL_DIR : PIXSPELL_CDN})`))
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { for (const id of sockets.keys()) world.leave(id); await flush(); process.exit(0) })
