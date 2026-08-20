import type { GameState, CountryId, Relation, ChatMsg, EndingId, Screen } from './types'
import { LEADERS, LEADER_BY_ID, SEED_GLOBAL, SEED_DMS, msg } from './mock'

type Listener = (s: GameState) => void

const listeners = new Set<Listener>()

function blankRelations(): Record<CountryId, Relation> {
  const r: Record<CountryId, Relation> = {}
  for (const l of LEADERS) r[l.id] = 'neutral'
  return r
}

export const state: GameState = {
  screen: 'splash',
  day: 1,
  defcon: 5,
  playerId: null,
  relations: blankRelations(),
  messages: [],
  openChannel: 'GLOBAL',
  unread: {},
  stats: { military: 0, economy: 0, morale: 0, standing: 0 },
  nukesLaunched: 0,
  typing: null,
  ending: null,
}

export function subscribe(fn: Listener) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function emit() {
  for (const fn of listeners) fn(state)
}

/* ---------- transitions ---------- */

export function goto(screen: Screen) {
  state.screen = screen
  emit()
}

export function startGame(playerId: CountryId) {
  const me = LEADER_BY_ID.get(playerId)
  if (!me) return

  state.playerId = playerId
  state.relations = blankRelations()
  state.relations[playerId] = 'self'
  state.stats = { ...me.stats }
  state.day = 1
  state.defcon = 5
  state.nukesLaunched = 0
  state.ending = null
  state.openChannel = 'GLOBAL'
  state.unread = {}

  state.messages = SEED_GLOBAL
    .filter(([from]) => from !== playerId)
    .map(([from, text]) =>
      msg(from as ChatMsg['from'], 'GLOBAL', text, 1, from === 'SYSTEM' ? 'system' : 'said'))

  for (const [id, lines] of Object.entries(SEED_DMS)) {
    if (id === playerId) continue
    for (const line of lines) state.messages.push(msg(id, id, line, 1))
    state.unread[id] = lines.length
  }

  state.screen = 'game'
  emit()
}

export function setTyping(t: GameState['typing']) {
  state.typing = t
  emit()
}

export function openChannel(channel: CountryId | 'GLOBAL') {
  state.openChannel = channel
  state.unread[channel] = 0
  emit()
}

export function push(m: ChatMsg) {
  state.messages.push(m)
  if (m.channel !== state.openChannel && m.from !== state.playerId) {
    state.unread[m.channel] = (state.unread[m.channel] ?? 0) + 1
  }
  emit()
}

export function say(from: ChatMsg['from'], channel: ChatMsg['channel'], text: string, kind: ChatMsg['kind'] = 'said') {
  push(msg(from, channel, text, state.day, kind))
}

export function messagesFor(channel: CountryId | 'GLOBAL') {
  return state.messages.filter(m => m.channel === channel)
}

export function setRelation(id: CountryId, rel: Relation) {
  state.relations[id] = rel
  emit()
}

export function advanceDay(n = 1) {
  state.day += n
  emit()
}

export function setDefcon(n: number) {
  state.defcon = Math.max(1, Math.min(5, n))
  emit()
}

export function bumpStats(delta: Partial<GameState['stats']>) {
  for (const [k, v] of Object.entries(delta)) {
    const key = k as keyof GameState['stats']
    state.stats[key] = Math.max(0, Math.min(100, state.stats[key] + (v ?? 0)))
  }
  emit()
}

export function endGame(id: EndingId) {
  state.ending = id
  state.screen = 'ending'
  emit()
}

export function reset() {
  state.screen = 'splash'
  state.playerId = null
  state.messages = []
  state.ending = null
  emit()
}

export const me = () => (state.playerId ? LEADER_BY_ID.get(state.playerId) ?? null : null)
