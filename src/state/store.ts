import type {
  GameState, CountryId, Relation, ChatMsg, EndingId, Screen, Channel, LeaderMemory,
} from './types'
import { LEADERS, LEADER_BY_ID, SEED_GLOBAL, SEED_DMS, msg } from './mock'
import { POPULATION, strikeToll } from './population'

type Listener = (s: GameState) => void

const listeners = new Set<Listener>()

/** Trust thresholds the relation colours on the map are derived from. */
const ALLY_AT = 45
const WAR_AT = -45

function blankRelations(): Record<CountryId, Relation> {
  const r: Record<CountryId, Relation> = {}
  for (const l of LEADERS) r[l.id] = 'neutral'
  return r
}

function blankPopulation(): Record<CountryId, number> {
  return { ...POPULATION }
}

function blankMemory(): Record<CountryId, LeaderMemory> {
  const m: Record<CountryId, LeaderMemory> = {}
  for (const l of LEADERS) m[l.id] = { trust: 0, grudges: [], bloc: [], nukes: 0, lastContact: 0 }
  return m
}

export const state: GameState = {
  screen: 'splash',
  day: 1,
  defcon: 5,
  playerId: null,
  relations: blankRelations(),
  memory: blankMemory(),
  messages: [],
  openChannel: 'GLOBAL',
  unread: {},
  stats: { military: 0, economy: 0, morale: 0, standing: 0 },
  nukesLaunched: 0,
  worldNukes: 0,
  population: blankPopulation(),
  deaths: 0,
  playerDestroyed: false,
  playerMessages: 0,
  resolving: false,
  typing: [],
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
  state.memory = blankMemory()
  state.stats = { ...me.stats }
  state.day = 1
  state.defcon = 5
  state.nukesLaunched = 0
  state.worldNukes = 0
  state.population = blankPopulation()
  state.deaths = 0
  state.playerDestroyed = false
  state.playerMessages = 0
  state.resolving = false
  state.typing = []
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

export function addTyping(channel: string, leaderId: string) {
  if (!state.typing.some(t => t.leaderId === leaderId && t.channel === channel)) {
    state.typing.push({ channel, leaderId })
  }
  emit()
}

export function clearTyping(leaderId?: string) {
  state.typing = leaderId ? state.typing.filter(t => t.leaderId !== leaderId) : []
  emit()
}

export function openChannel(channel: Channel) {
  state.openChannel = channel
  state.unread[channel] = 0
  emit()
}

export function push(m: ChatMsg) {
  state.messages.push(m)
  if (m.from === state.playerId) state.playerMessages++
  if (m.channel !== state.openChannel && m.from !== state.playerId) {
    state.unread[m.channel] = (state.unread[m.channel] ?? 0) + 1
  }
  emit()
}

export function say(
  from: ChatMsg['from'], channel: Channel, text: string,
  kind: ChatMsg['kind'] = 'said', to?: CountryId,
) {
  push(msg(from, channel, text, state.day, kind, to))
}

export function messagesFor(channel: Channel) {
  return state.messages.filter(m => m.channel === channel)
}

/* ---------- memory ---------- */

export const mem = (id: CountryId): LeaderMemory =>
  (state.memory[id] ??= { trust: 0, grudges: [], bloc: [], nukes: 0, lastContact: 0 })

/**
 * Move one leader's opinion of the player, scaled by how hard they overreact,
 * and optionally log why. The grudge note is fed to the model verbatim, so it
 * reads as a complete phrase: "you sanctioned them".
 */
export function nudgeTrust(id: CountryId, delta: number, note?: string) {
  if (id === state.playerId || state.relations[id] === 'destroyed') return
  const l = LEADER_BY_ID.get(id)
  const m = mem(id)
  // only grievances land harder for the volatile; forgiveness is flat
  const scaled = delta < 0 ? delta * (l?.volatility ?? 1) : delta
  m.trust = Math.max(-100, Math.min(100, m.trust + scaled))
  if (note) {
    m.grudges.push({ day: state.day, note })
    if (m.grudges.length > 6) m.grudges.shift()
  }
  syncRelation(id)
}

/** Everyone except the excluded ids reacts to the same event. */
export function nudgeAll(delta: number, note?: string, exclude: CountryId[] = []) {
  for (const l of LEADERS) {
    if (l.id === state.playerId || exclude.includes(l.id)) continue
    if (state.relations[l.id] === 'destroyed') continue
    nudgeTrust(l.id, delta, note)
  }
}

/** Relations are a view of trust, so the map always matches what leaders think. */
export function syncRelation(id: CountryId) {
  if (state.relations[id] === 'destroyed' || id === state.playerId) return
  const t = mem(id).trust
  state.relations[id] = t >= ALLY_AT ? 'ally' : t <= WAR_AT ? 'war' : 'neutral'
  emit()
}

export function markContact(id: CountryId) {
  mem(id).lastContact = state.day
}

/* ---------- board ---------- */

export function setRelation(id: CountryId, rel: Relation) {
  state.relations[id] = rel
  emit()
}

/**
 * A warhead lands. Takes its share of whoever is still alive there and adds
 * them to the world toll; knocking the state out of the game is `destroy`,
 * deliberately separate — the survivors outlive the government.
 */
export function strikeCountry(id: CountryId): number {
  const living = state.population[id] ?? 0
  const toll = strikeToll(living)
  state.population[id] = living - toll
  state.deaths += toll
  state.worldNukes++
  emit()
  return toll
}

/** People still alive in a country, 0 once nothing is left. */
export const livingIn = (id: CountryId) => state.population[id] ?? 0

export function destroy(id: CountryId) {
  state.relations[id] = 'destroyed'
  if (id === state.playerId) state.playerDestroyed = true
  emit()
}

export const isAlive = (id: CountryId) => state.relations[id] !== 'destroyed'

export const aliveRivals = () =>
  LEADERS.filter(l => l.id !== state.playerId && isAlive(l.id))

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

export function setResolving(v: boolean) {
  state.resolving = v
  emit()
}

export function endGame(id: EndingId) {
  state.ending = id
  state.resolving = false
  state.typing = []
  state.screen = 'ending'
  emit()
}

export function reset() {
  state.screen = 'splash'
  state.playerId = null
  state.messages = []
  state.ending = null
  state.resolving = false
  state.typing = []
  emit()
}

export const me = () => (state.playerId ? LEADER_BY_ID.get(state.playerId) ?? null : null)
