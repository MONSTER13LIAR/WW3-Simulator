import type {
  GameState, CountryId, Relation, ChatMsg, EndingId, Screen, Channel, LeaderMemory, Region, Phase, Crisis,
} from './types'
import { LEADERS, LEADER_BY_ID, msg } from './mock'
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

/** Warheads each state starts with. Military is the only honest proxy we have. */
export function startingBombs(id: CountryId): number {
  const mil = LEADER_BY_ID.get(id)?.stats.military ?? 0
  return mil >= 85 ? 6 : mil >= 70 ? 4 : 2
}

function blankBombs(): Record<CountryId, number> {
  const b: Record<CountryId, number> = {}
  for (const l of LEADERS) b[l.id] = startingBombs(l.id)
  return b
}

function blankAlliances(): Record<CountryId, CountryId[]> {
  const a: Record<CountryId, CountryId[]> = {}
  for (const l of LEADERS) a[l.id] = []
  return a
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
  bombs: blankBombs(),
  owner: {},
  alliances: blankAlliances(),
  strikes: [],
  worldWar: false,
  worldWarDay: 0,
  targetRegion: 'north',
  phase: 'guide',
  crisis: null,
  bloc: [],
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
  state.bombs = blankBombs()
  state.owner = {}
  state.alliances = blankAlliances()
  state.strikes = []
  state.worldWar = false
  state.worldWarDay = 0
  state.targetRegion = 'north'
  state.phase = 'guide'
  state.crisis = null
  state.bloc = []
  state.playerDestroyed = false
  state.playerMessages = 0
  state.resolving = false
  state.typing = []
  state.ending = null
  state.openChannel = 'GLOBAL'
  state.unread = {}

  // The room opens silent. The opening argument is seeded once the guide is
  // dismissed, so the first thing the player reads is the world, not a backlog.
  state.messages = []

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
  // a signed pact holds through a bad mood; only open hostility tears it up
  if (state.playerId && areAllied(state.playerId, id)) {
    if (t <= WAR_AT) breakAlliance(state.playerId, id)
    else { state.relations[id] = 'ally'; emit(); return }
  }
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
 * A warhead lands on one quarter of a country. Takes its share of whoever is
 * still alive there and adds them to the world toll; knocking the state out
 * of the game is `destroy`, deliberately separate — the survivors outlive the
 * government. Also the only place the war's event log is written, which is
 * what the WW3 trigger reads.
 */
export function strikeCountry(id: CountryId, by: CountryId, region: Region = state.targetRegion): number {
  const living = state.population[id] ?? 0
  const toll = strikeToll(living, id, region)
  state.population[id] = living - toll
  state.deaths += toll
  state.worldNukes++
  if (by !== state.playerId) mem(by).nukes++
  state.strikes.push({ day: state.day, from: by, to: id, region, dead: toll })
  checkWorldWar(by, id)
  emit()
  return toll
}

/* ---------- arsenal ---------- */

export const bombsOf = (id: CountryId) => state.bombs[id] ?? 0

/** Take one warhead out of the silo; false if it was already empty. */
export function spendBomb(id: CountryId): boolean {
  if (bombsOf(id) <= 0) return false
  state.bombs[id]--
  emit()
  return true
}

/* ---------- alliances (any two states, not just the player) ---------- */

export const alliesOf = (id: CountryId): CountryId[] => state.alliances[id] ?? []
export const areAllied = (a: CountryId, b: CountryId) => alliesOf(a).includes(b)

export function formAlliance(a: CountryId, b: CountryId) {
  if (a === b || areAllied(a, b)) return
  ;(state.alliances[a] ??= []).push(b)
  ;(state.alliances[b] ??= []).push(a)
  if (a === state.playerId || b === state.playerId) {
    const other = a === state.playerId ? b : a
    mem(other).trust = Math.max(mem(other).trust, ALLY_AT)
    state.relations[other] = 'ally'
  }
  emit()
}

export function breakAlliance(a: CountryId, b: CountryId) {
  state.alliances[a] = alliesOf(a).filter(x => x !== b)
  state.alliances[b] = alliesOf(b).filter(x => x !== a)
  emit()
}

/* ---------- territory ---------- */

/** Who governs a territory right now — the conqueror, or itself. */
export const holderOf = (id: CountryId): CountryId => state.owner[id] ?? id

/** Every territory a state holds, itself included while it still stands. */
export const holdingsOf = (id: CountryId): CountryId[] =>
  [id, ...Object.entries(state.owner).filter(([, h]) => h === id).map(([t]) => t)]
    .filter((t, i, arr) => arr.indexOf(t) === i && (t !== id || !state.owner[id]))

export function conquer(attacker: CountryId, target: CountryId) {
  if (attacker === target) return
  state.owner[target] = attacker
  // everything the target held passes to the conqueror too
  for (const [t, h] of Object.entries(state.owner)) if (h === target) state.owner[t] = attacker
  if (target === state.playerId) state.playerDestroyed = true
  else if (state.relations[target] !== 'destroyed') state.relations[target] = 'destroyed'
  emit()
}

/* ---------- world war ---------- */

/**
 * WW3 starts the moment an alliance-backed attack is answered in kind: A, who
 * has allies, struck B earlier; now B strikes A or one of A's allies. Any two
 * states can light it — the player is not special here.
 */
function checkWorldWar(by: CountryId, target: CountryId) {
  if (state.worldWar) return
  const side = [target, ...alliesOf(target)]
  const provoked = state.strikes.some(s =>
    s.from !== by && side.includes(s.from) && alliesOf(s.from).length > 0 &&
    (s.to === by || alliesOf(by).includes(s.to)))
  if (!provoked) return
  state.worldWar = true
  state.worldWarDay = state.day
  state.defcon = 1
}

export function setPhase(p: Phase) {
  state.phase = p
  emit()
}

export function setCrisis(c: Crisis) {
  state.crisis = c
  emit()
}

export function setBloc(members: CountryId[]) {
  state.bloc = members
  emit()
}

/** Put a two-button decision into a channel. */
export function ask(channel: Channel, text: string, options: Array<{ label: string; members: CountryId[] }>) {
  const m = msg('SYSTEM', channel, text, state.day, 'choice')
  m.choice = { options }
  push(m)
  return m
}

export function setTargetRegion(r: Region) {
  state.targetRegion = r
  emit()
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
