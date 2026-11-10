// The world, run on the server: the only place that decides where anyone is, who hits whom and for how much.
// Transport-free: hand it messages with input(), call tick() every TICK_MS, and it calls send(id, msg) for each player.

import { MAPS, START_MAP, walkable } from '../shared/maps.js'
import { JOBS, MONSTERS, COLORS, DIRS, STEP_MS, expFor, statsFor } from '../shared/data.js'

const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1))
const NAME_RE = /^[가-힣a-zA-Z0-9]{2,10}$/
const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)

export class World {
  constructor({ send, store, now = () => Date.now() }) {
    this.send = send // (playerId, message) => void
    this.store = store // { load(name), save(name, data) }
    this.now = now
    this.players = new Map()
    this.monsters = new Map()
    this.seq = 0
    this.respawns = [] // { at, map, sp }: monsters come back after a while
    this.maps = Object.fromEntries(Object.values(MAPS).map((m) => [m.id, { def: m }]))
    for (const map of Object.values(MAPS)) for (const sp of map.spawns) for (let i = 0; i < sp.count; i++) this.spawn(map.id, sp)
  }

  // ---------------------------------------------------------------- who is where
  entitiesOn(mapId) {
    const out = []
    for (const p of this.players.values()) if (p.map === mapId) out.push(p)
    for (const m of this.monsters.values()) if (m.map === mapId && !m.dead) out.push(m)
    return out
  }
  monsterAt(mapId, x, y) {
    for (const m of this.monsters.values()) if (m.map === mapId && !m.dead && m.x === x && m.y === y) return m
    return null
  }
  occupied(mapId, x, y) {
    if (this.monsterAt(mapId, x, y)) return true
    for (const p of this.players.values()) if (p.map === mapId && p.x === x && p.y === y && !p.dead) return true
    return false
  }
  freeTile(mapId, [x0, y0, x1, y1]) {
    const def = MAPS[mapId]
    for (let i = 0; i < 60; i++) {
      const x = rand(x0, x1), y = rand(y0, y1)
      if (walkable(def, x, y) && !this.occupied(mapId, x, y) && !def.portals.some((p) => p.x === x && p.y === y)) return [x, y]
    }
    return null
  }
  toMap(mapId, msg) { for (const p of this.players.values()) if (p.map === mapId) this.send(p.id, msg) }

  // ---------------------------------------------------------------- monsters
  spawn(mapId, sp) {
    const at = this.freeTile(mapId, sp.area)
    if (!at) return
    const def = MONSTERS[sp.kind]
    const m = { id: `m${++this.seq}`, kind: 'm', type: sp.kind, def, sp, map: mapId, x: at[0], y: at[1], dir: 'down', hp: def.hp, maxHp: def.hp, next: this.now() + rand(0, def.speed), atkAt: 0, target: null, dmg: new Map() }
    this.monsters.set(m.id, m)
  }

  monsterAct(m, now) {
    if (now < m.next) return
    let target = m.target && this.players.get(m.target)
    if (target && (target.dead || target.map !== m.map || dist(m, target) > 12)) { target = null; m.target = null }
    if (!target && m.def.aggro) {
      for (const p of this.players.values()) if (p.map === m.map && !p.dead && dist(m, p) <= m.def.aggro) { target = p; m.target = p.id; break }
    }
    if (target) {
      if (dist(m, target) === 1) {
        m.dir = dirTo(m, target)
        if (now - m.atkAt >= 1200) { m.atkAt = now; this.hurtPlayer(target, rand(...m.def.atk), m) }
        m.next = now + 300
        return
      }
      this.stepToward(m, target)
      m.next = now + m.def.speed * 0.8
      return
    }
    // wander inside its area, now and then
    if (Math.random() < 0.55) {
      const d = Object.keys(DIRS)[rand(0, 3)], [dx, dy] = DIRS[d], x = m.x + dx, y = m.y + dy
      const [x0, y0, x1, y1] = m.sp.area
      m.dir = d
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1 && this.canStep(m.map, x, y)) { m.x = x; m.y = y }
    }
    m.next = now + m.def.speed * (1 + Math.random() * 2)
  }
  canStep(mapId, x, y) {
    const def = MAPS[mapId]
    return walkable(def, x, y) && !this.occupied(mapId, x, y) && !def.portals.some((p) => p.x === x && p.y === y)
  }
  stepToward(m, t) {
    const dx = Math.sign(t.x - m.x), dy = Math.sign(t.y - m.y)
    const tries = Math.abs(t.x - m.x) >= Math.abs(t.y - m.y) ? [[dx, 0], [0, dy]] : [[0, dy], [dx, 0]]
    for (const [sx, sy] of tries) {
      if (!sx && !sy) continue
      if (this.canStep(m.map, m.x + sx, m.y + sy)) { m.x += sx; m.y += sy; m.dir = dirOf(sx, sy); return }
    }
    m.dir = dirTo(m, t)
  }

  hurtMonster(m, amount, by, crit = false) {
    if (m.dead) return
    m.hp -= amount
    m.dmg.set(by.id, (m.dmg.get(by.id) ?? 0) + amount)
    if (!m.target) m.target = by.id
    this.toMap(m.map, { t: 'fx', k: 'hit', id: m.id, n: amount, crit })
    if (m.hp > 0) return
    m.dead = true
    this.toMap(m.map, { t: 'fx', k: 'die', id: m.id })
    // EXP shared by damage dealt; gold to whoever did the most
    const total = [...m.dmg.values()].reduce((a, b) => a + b, 0) || 1
    let top = null
    for (const [pid, d] of m.dmg) {
      const p = this.players.get(pid)
      if (!p || p.map !== m.map) continue
      this.gainExp(p, Math.max(1, Math.round((m.def.exp * d) / total)))
      if (!top || d > m.dmg.get(top.id)) top = p
    }
    if (top) { const g = rand(...m.def.gold); top.gold += g; top.dirty = true; this.send(top.id, { t: 'sys', text: `${m.def.name}을(를) 물리쳤다. 경험치와 ${g}냥을 얻었다.` }) }
    if (m.def.boss) this.toAll({ t: 'sys', text: `${top?.name ?? '누군가'}님이 ${m.def.name}을(를) 쓰러뜨렸습니다!`, big: true })
    this.monsters.delete(m.id)
    this.respawns.push({ at: this.now() + (m.def.respawn ?? rand(7000, 12000)), map: m.map, sp: m.sp })
  }
  toAll(msg) { for (const p of this.players.values()) this.send(p.id, msg) }

  // ---------------------------------------------------------------- players
  join(id, { name, job, color = 0, token } = {}) {
    name = String(name ?? '').trim()
    if (!NAME_RE.test(name)) return { error: '이름은 한글·영문·숫자 2~10자로 지어 주세요.' }
    if ([...this.players.values()].some((p) => p.name === name)) return { error: '이미 접속 중인 이름입니다.' }
    const saved = this.store.load(name)
    if (saved && saved.token !== token) return { error: '이미 다른 사람이 쓰는 이름입니다.' }
    if (!saved && !JOBS[job]) return { error: '직업을 골라 주세요.' }
    const data = saved ?? { name, token: makeToken(), job, color: COLORS[color] !== undefined ? color : 0, lv: 1, exp: 0, gold: 0, map: START_MAP, x: MAPS[START_MAP].start[0], y: MAPS[START_MAP].start[1] }
    const p = { id, kind: 'p', ...data, dir: 'down', stepAt: 0, atkAt: 0, skillAt: 0, chatAt: 0, hurtAt: 0, regenAt: 0, seen: new Set(), dirty: true, talk: 0 }
    Object.assign(p, statsFor(p.job, p.lv))
    p.hp = p.maxHp; p.mp = p.maxMp
    if (!walkable(MAPS[p.map], p.x, p.y)) [p.x, p.y] = MAPS[p.map].start
    this.players.set(id, p)
    this.send(id, { t: 'welcome', id, token: p.token, name: p.name, job: p.job, color: p.color, map: p.map, x: p.x, y: p.y })
    this.toMap(p.map, { t: 'sys', text: `${p.name}님이 들어왔습니다.` })
    this.save(p)
    return { player: p }
  }
  leave(id) {
    const p = this.players.get(id)
    if (!p) return
    this.save(p)
    this.players.delete(id)
    this.toMap(p.map, { t: 'sys', text: `${p.name}님이 나갔습니다.` })
  }
  save(p) {
    const town = MAPS[START_MAP].start
    this.store.save(p.name, { name: p.name, token: p.token, job: p.job, color: p.color, lv: p.lv, exp: p.exp, gold: p.gold, map: p.dead ? START_MAP : p.map, x: p.dead ? town[0] : p.x, y: p.dead ? town[1] : p.y })
  }

  gainExp(p, n) {
    p.exp += n
    p.dirty = true
    while (p.exp >= expFor(p.lv)) {
      p.exp -= expFor(p.lv)
      p.lv++
      Object.assign(p, statsFor(p.job, p.lv))
      p.hp = p.maxHp; p.mp = p.maxMp
      this.toMap(p.map, { t: 'fx', k: 'lvl', id: p.id })
      this.send(p.id, { t: 'sys', text: `레벨 ${p.lv}이 되었습니다!`, big: true })
    }
  }
  hurtPlayer(p, amount, by) {
    if (p.dead) return
    p.hp = Math.max(0, p.hp - amount)
    p.hurtAt = this.now()
    p.dirty = true
    this.toMap(p.map, { t: 'fx', k: 'hit', id: p.id, n: amount, by: by?.id, el: by?.def?.element })
    if (p.hp > 0) return
    p.dead = true
    p.deadAt = this.now()
    p.exp = Math.max(0, p.exp - Math.round(expFor(p.lv) * 0.05))
    this.toMap(p.map, { t: 'fx', k: 'die', id: p.id })
    this.send(p.id, { t: 'sys', text: '쓰러졌습니다... 잠시 후 마을에서 깨어납니다.' })
    for (const m of this.monsters.values()) if (m.target === p.id) m.target = null
  }
  revive(p) {
    p.dead = false
    p.hp = Math.ceil(p.maxHp / 2); p.mp = Math.ceil(p.maxMp / 2)
    p.dirty = true
    this.moveTo(p, START_MAP, ...MAPS[START_MAP].start)
  }
  moveTo(p, mapId, x, y) {
    const from = p.map
    p.map = mapId; p.x = x; p.y = y
    if (from !== mapId) { p.seen.clear(); this.send(p.id, { t: 'map', map: mapId, x, y }) } else this.send(p.id, { t: 'warp', x, y })
  }

  // ---------------------------------------------------------------- what a player asks for
  input(id, msg) {
    const p = this.players.get(id)
    if (!p || !msg || typeof msg !== 'object') return
    const now = this.now()
    if (p.dead && msg.t !== 'chat') return
    switch (msg.t) {
      case 'move': {
        if (!DIRS[msg.dir] || now - p.stepAt < STEP_MS * 0.7) return
        const [dx, dy] = DIRS[msg.dir], x = p.x + dx, y = p.y + dy, def = MAPS[p.map]
        p.dir = msg.dir
        if (!walkable(def, x, y) || this.monsterAt(p.map, x, y)) return this.send(id, { t: 'warp', x: p.x, y: p.y, dir: p.dir })
        p.x = x; p.y = y; p.stepAt = now
        const portal = def.portals.find((q) => q.x === x && q.y === y)
        if (portal) this.moveTo(p, portal.to, portal.tx, portal.ty)
        return
      }
      case 'face': if (DIRS[msg.dir]) p.dir = msg.dir; return
      case 'attack': return this.attack(p, now)
      case 'skill': return this.skill(p, now)
      case 'talk': return this.talk(p)
      case 'chat': {
        const text = String(msg.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 60)
        if (!text || now - p.chatAt < 700) return
        p.chatAt = now
        this.toMap(p.map, { t: 'chat', id: p.id, name: p.name, text })
      }
    }
  }

  /** The first monster in a straight line from p, up to range tiles, stopping at walls. */
  lineTarget(p, range) {
    const [dx, dy] = DIRS[p.dir], def = MAPS[p.map]
    for (let i = 1; i <= range; i++) {
      const x = p.x + dx * i, y = p.y + dy * i
      const m = this.monsterAt(p.map, x, y)
      if (m) return m
      if (!walkable(def, x, y)) return null
    }
    return null
  }
  attack(p, now) {
    const job = JOBS[p.job]
    if (now - p.atkAt < job.cooldown) return
    p.atkAt = now
    const target = this.lineTarget(p, job.range)
    this.toMap(p.map, { t: 'fx', k: 'atk', id: p.id, dir: p.dir, to: target?.id, ranged: job.range > 1 })
    if (!target) return
    const crit = Math.random() < 0.1
    this.hurtMonster(target, Math.round(rand(...p.atk) * (crit ? 1.6 : 1)), p, crit)
  }
  skill(p, now) {
    const s = JOBS[p.job].skill
    if (now - p.skillAt < s.cooldown) return
    if (p.mp < s.mp) return this.send(p.id, { t: 'sys', text: '마력이 모자랍니다.' })
    p.skillAt = now
    p.mp -= s.mp
    p.dirty = true
    this.toMap(p.map, { t: 'fx', k: 'skill', id: p.id, skill: s.kind, dir: p.dir })
    const power = () => Math.round(rand(...p.atk) * s.power)
    if (s.kind === 'spin') {
      for (const m of [...this.monsters.values()]) if (m.map === p.map && !m.dead && Math.max(Math.abs(m.x - p.x), Math.abs(m.y - p.y)) === 1) this.hurtMonster(m, power(), p)
    } else if (s.kind === 'volley') {
      for (let i = 0; i < s.shots; i++) {
        const t = this.lineTarget(p, JOBS[p.job].range + 1)
        if (t) { this.toMap(p.map, { t: 'fx', k: 'shot', id: p.id, to: t.id, i }); this.hurtMonster(t, power(), p) }
      }
    } else if (s.kind === 'bolt') {
      const t = this.lineTarget(p, s.range)
      this.toMap(p.map, { t: 'fx', k: 'bolt', id: p.id, to: t?.id, dir: p.dir, el: s.element })
      if (t) this.hurtMonster(t, power() + p.lv * 2, p)
    } else if (s.kind === 'heal') {
      const amount = s.power + p.lv * 4
      for (const q of this.players.values()) {
        if (q.map !== p.map || q.dead || dist(q, p) > s.radius) continue
        const n = Math.min(amount, q.maxHp - q.hp)
        q.hp += n; q.dirty = true
        this.toMap(p.map, { t: 'fx', k: 'heal', id: q.id, n })
      }
    }
  }
  talk(p) {
    const [dx, dy] = DIRS[p.dir], x = p.x + dx, y = p.y + dy
    const npc = MAPS[p.map].npcs.find((n) => n.x === x && n.y === y)
    if (!npc) return
    const text = npc.lines[p.talk++ % npc.lines.length]
    this.send(p.id, { t: 'say', npc: npc.id, name: npc.name, text })
    if (npc.role === 'heal') {
      p.hp = p.maxHp; p.mp = p.maxMp; p.dirty = true
      this.toMap(p.map, { t: 'fx', k: 'heal', id: p.id, n: 0 })
    }
  }

  // ---------------------------------------------------------------- every TICK_MS
  tick() {
    const now = this.now()
    this.respawns = this.respawns.filter((r) => (r.at <= now ? (this.spawn(r.map, r.sp), false) : true))
    const busy = new Set([...this.players.values()].map((p) => p.map))
    for (const m of this.monsters.values()) if (busy.has(m.map) && !m.dead) this.monsterAct(m, now)
    for (const p of this.players.values()) {
      if (p.dead && now - p.deadAt > 3000) this.revive(p)
      if (!p.dead && now - p.regenAt > 2000) { // slow regeneration, faster when out of combat
        p.regenAt = now
        const calm = now - p.hurtAt > 6000
        const hp = Math.min(p.maxHp - p.hp, Math.ceil(p.maxHp * (calm ? 0.05 : 0.01))), mp = Math.min(p.maxMp - p.mp, Math.ceil(p.maxMp * (calm ? 0.06 : 0.02)))
        if (hp || mp) { p.hp += hp; p.mp += mp; p.dirty = true }
      }
    }
    // what each player sees: everyone on their map
    const byMap = new Map()
    for (const id of busy) byMap.set(id, this.entitiesOn(id))
    for (const p of this.players.values()) {
      const list = byMap.get(p.map) ?? []
      const add = [], ids = new Set()
      for (const e of list) {
        ids.add(e.id)
        if (!p.seen.has(e.id)) { p.seen.add(e.id); add.push(e.kind === 'p' ? { id: e.id, kind: 'p', name: e.name, job: e.job, color: e.color, lv: e.lv } : { id: e.id, kind: 'm', type: e.type }) }
      }
      const del = [...p.seen].filter((id) => !ids.has(id))
      for (const id of del) p.seen.delete(id)
      const e = list.map((x) => [x.id, x.x, x.y, x.dir, Math.round((100 * x.hp) / x.maxHp), x.dead ? 1 : 0])
      this.send(p.id, { t: 's', e, ...(add.length ? { add } : {}), ...(del.length ? { del } : {}) })
      if (p.dirty) { p.dirty = false; this.send(p.id, { t: 'me', hp: p.hp, maxHp: p.maxHp, mp: p.mp, maxMp: p.maxMp, lv: p.lv, exp: p.exp, next: expFor(p.lv), gold: p.gold }) }
    }
  }
}

const dirOf = (dx, dy) => (dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up')
const dirTo = (a, b) => (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? dirOf(Math.sign(b.x - a.x), 0) : dirOf(0, Math.sign(b.y - a.y)))
const makeToken = () => Array.from({ length: 24 }, () => Math.floor(Math.random() * 36).toString(36)).join('')
