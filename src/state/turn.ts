import { LEADERS } from './mock'
import { REGIONS, type CountryId, type Region } from './types'
import {
  state, say, mem, nudgeTrust, syncRelation, advanceDay, setDefcon, bumpStats, setResolving,
  endGame, strikeCountry, bombsOf, spendBomb, alliesOf, areAllied, formAlliance, conquer,
  isAlive, aliveRivals, livingIn, holderOf,
} from './store'
import { POPULATION, dailyGrowth, formatExact } from './population'
import { leaderRespond, someoneReacts } from '../net/respond'
import { strike as strikeFx } from '../components/fx'
import { theyWantPeace, receiveOffer } from './treaty'
import { ensureDailyEvent, noteEvent } from './world'

export const MAX_DAYS = 14

/** A state falls when this share of its people are gone; the player gets a little more rope. */
const FALLS_AT = 0.55
const PLAYER_FALLS_AT = 0.65

const pick = <T,>(arr: T[]): T | undefined => arr[Math.floor(Math.random() * arr.length)]
const chance = (p: number) => Math.random() < p
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const region = (): Region => pick(REGIONS) ?? 'north'

/** Live AI states that still govern themselves. */
const aiStates = () => aliveRivals().filter(l => holderOf(l.id) === l.id)

/**
 * One day of the war. Everything that happens to the world without the player
 * lifting a finger happens here, in order, and the orders stay locked until it
 * is done.
 */
export async function endDay(): Promise<void> {
  if (state.resolving || state.ending || !state.playerId || state.phase !== 'play') return
  setResolving(true)

  // the day must not close without the world having done something visible
  await ensureDailyEvent()
  advanceDay()
  driftStats()
  driftPopulation()
  formAiAlliances()
  pettyGrievances()

  const talk = voiceTheRoom()
  await aiAggression()
  await aiFeud()
  await talk

  resolveEnding()
  setResolving(false)
  dayEndsAt = Date.now() + DAY_MS
  if (!state.ending && theyWantPeace() && chance(0.5)) receiveOffer()
}

/* ---------- the slow pressures ---------- */

function driftStats() {
  const wars = LEADERS.filter(l => state.relations[l.id] === 'war').length
  const allies = alliesOf(state.playerId!).length
  bumpStats({
    economy: -2 * wars + (wars ? 0 : 1) + (state.worldWar ? -3 : 0),
    morale: -1 * wars + allies - (state.worldWar ? 2 : 0),
    military: wars ? 1 : 0,
    standing: allies ? 1 : 0,
  })
  if (!wars && !state.worldWar && state.defcon < 5) setDefcon(state.defcon + 1)
}

/** Economies breathe people in and out; conquered land grows under its holder. */
function driftPopulation() {
  for (const l of LEADERS) {
    if (!isAlive(l.id) && !state.owner[l.id]) continue
    const holder = holderOf(l.id)
    const economy = holder === state.playerId ? state.stats.economy
      : (LEADERS.find(x => x.id === holder)?.stats.economy ?? 40)
    const d = dailyGrowth(livingIn(l.id), economy)
    state.population[l.id] = Math.max(0, livingIn(l.id) + d)
  }
}

/** Two states sign a pact. They prefer each other when they both dislike you. */
function formAiAlliances() {
  if (state.day < 2 || !chance(0.45)) return
  const pool = aiStates()
  const sour = pool.filter(l => mem(l.id).trust <= -20)
  const a = pick(sour.length >= 2 ? sour : pool)
  if (!a) return
  const b = pick((sour.length >= 2 ? sour : pool).filter(l => l.id !== a.id && !areAllied(a.id, l.id)))
  if (!b) return
  formAlliance(a.id, b.id)
  mem(a.id).bloc.push(b.id); mem(b.id).bloc.push(a.id)
  say('SYSTEM', 'GLOBAL', `${a.short} and ${b.short} have signed a mutual defence pact`, 'system')
}

/** Neglect stings, and the petty invent reasons to be upset on their own. */
function pettyGrievances() {
  for (const l of aiStates()) {
    const m = mem(l.id)
    if (m.lastContact && state.day - m.lastContact >= 3 && chance(0.5)) {
      nudgeTrust(l.id, -6, 'you stopped replying to them')
    }
    if (chance(l.pettiness * 0.5)) {
      const g = pick(l.grievances)
      if (g) nudgeTrust(l.id, -8, g)
    }
  }
}

/** One leader airs their newest grievance in the room; one DMs another behind your back. */
async function voiceTheRoom() {
  const fresh = aiStates().filter(l => mem(l.id).grudges.at(-1)?.day === state.day)
  const loud = pick(fresh)
  const jobs: Promise<void>[] = []
  if (loud) {
    const g = mem(loud.id).grudges.at(-1)!
    say('SYSTEM', 'GLOBAL', `${loud.short} has decided to be furious that ${g.note}`, 'system')
    jobs.push(leaderRespond(loud.id, 'GLOBAL'))
  }
  const from = pick(aiStates().filter(l => l.id !== loud?.id && mem(l.id).trust < 0))
  const to = from && pick(aiStates().filter(l => l.id !== from.id))
  if (from && to) jobs.push(intercept(from.id, to.id))
  await Promise.all(jobs)
}

const INTERCEPTS = [
  'are we still doing the thing about {p}',
  'do not trust {p}. i have reasons. i will not share them.',
  '{p} has been quiet. i hate it.',
  'if {p} launches, you go first. agreed?',
  'what did {p} mean by "ok"',
]

async function intercept(from: CountryId, to: CountryId) {
  await wait(400 + Math.random() * 900)
  const p = LEADERS.find(l => l.id === state.playerId)?.short ?? 'them'
  say(from, 'INTERCEPT', (pick(INTERCEPTS) ?? '').replace(/\{p\}/g, p), 'said', to)
}

/* ---------- the fast ones ---------- */

/** A state's people have had enough; it stops standing as a government. */
function maybeFalls(id: CountryId, by: CountryId) {
  const at = id === state.playerId ? PLAYER_FALLS_AT : FALLS_AT
  if (livingIn(id) > POPULATION[id] * (1 - at)) return
  if (state.owner[id]) return
  conquer(by, id)
  const byShort = LEADERS.find(l => l.id === by)?.short ?? by
  const short = LEADERS.find(l => l.id === id)?.short ?? id
  say('SYSTEM', 'GLOBAL', `${short} has fallen. ${byShort} now holds it.`, 'system')
}

/** A warhead fired by an AI state: fx, toll, log, and the fall check, in sequence. */
export async function aiLaunch(from: CountryId, to: CountryId): Promise<void> {
  if (!spendBomb(from)) return
  noteEvent()
  const r = region()
  const fromShort = LEADERS.find(l => l.id === from)?.short ?? from
  const toShort = LEADERS.find(l => l.id === to)?.short ?? to
  say(from, 'GLOBAL', `Launch confirmed on ${toShort}. ${r} sector.`, 'action')
  strikeFx(from, to, `${toShort.toUpperCase()} · ${r.toUpperCase()}`, r)
  await wait(1400)
  const toll = strikeCountry(to, from, r)
  say('SYSTEM', 'GLOBAL', `${fromShort} struck ${toShort} — ${formatExact(toll)} dead`, 'system')
  if (to === state.playerId) {
    bumpStats({ morale: -12, economy: -8, military: -6 })
    nudgeTrust(from, -20, 'they nuked you')
    if (state.relations[from] !== 'destroyed') { mem(from).trust = Math.min(mem(from).trust, -60); syncRelation(from) }
  }
  setDefcon(1)
  maybeFalls(to, from)
}

/**
 * The answer to a strike by the player on `target`: the target fires back if
 * it can, and one of its allies hits one of yours. Not a dice roll — a state
 * that has just been nuked and still has a silo does not sit on it.
 */
export async function retaliate(target: CountryId): Promise<void> {
  const me = state.playerId!
  const side = [target, ...alliesOf(target)].filter(id => isAlive(id) && holderOf(id) === id && id !== me)
  const shooter = side.find(id => bombsOf(id) > 0)
  if (!shooter) return
  await wait(2200)
  if (state.ending) return
  say(shooter, 'GLOBAL', `${LEADERS.find(l => l.id === me)?.short ?? me} struck ${LEADERS.find(l => l.id === target)?.short ?? target}. We are answering.`, 'action')
  await aiLaunch(shooter, me)

  // their ally against one of yours
  const second = side.find(id => id !== shooter && bombsOf(id) > 0)
  const myAlly = pick(alliesOf(me).filter(id => isAlive(id) && holderOf(id) === id))
  if (second && myAlly && chance(0.7)) {
    await wait(1400)
    if (state.ending) return
    await aiLaunch(second, myAlly)
  }
  resolveEnding()
}

/* ---------- the clock: one real minute is one day ---------- */

export const DAY_MS = 60_000
let timer: ReturnType<typeof setInterval> | null = null
let dayEndsAt = 0

/** Seconds until the day rolls over, for the HUD. */
export const secondsLeft = () => Math.max(0, Math.ceil((dayEndsAt - Date.now()) / 1000))

export function startClock() {
  stopClock()
  dayEndsAt = Date.now() + DAY_MS
  timer = setInterval(() => {
    if (state.screen !== 'game' || state.ending) { stopClock(); return }
    if (state.phase !== 'play' || state.resolving) { dayEndsAt = Date.now() + DAY_MS; return }
    if (Date.now() >= dayEndsAt) void endDay()
    document.getElementById('clock')?.replaceChildren(String(secondsLeft()).padStart(2, '0'))
  }, 250)
}

export function stopClock() {
  if (timer) clearInterval(timer)
  timer = null
}

/** Someone who truly hates you, with something in the silo, when the world is tense enough. */
async function aiAggression() {
  const angry = aiStates().filter(l => mem(l.id).trust <= -60 && bombsOf(l.id) > 0)
  const shooter = pick(angry)
  if (!shooter || state.defcon > 3) return
  const odds = 0.25 + 0.12 * mem(shooter.id).bloc.length + (state.worldWar ? 0.3 : 0)
  if (!chance(odds)) return
  const target = state.playerId!
  await aiLaunch(shooter.id, target)
  // allies answer for you
  const avenger = pick(alliesOf(target).filter(a => isAlive(a) && a !== shooter.id && bombsOf(a) > 0))
  if (avenger && chance(0.6)) { await wait(900); await aiLaunch(avenger, shooter.id) }
}

/** Two AI states go at each other; the victim shoots back if it can. That is how the world lights itself. */
async function aiFeud() {
  if (state.day < 4 || !chance(state.worldWar ? 0.6 : 0.3)) return
  const pool = aiStates().filter(l => bombsOf(l.id) > 0)
  const a = pick(pool)
  const b = a && pick(aiStates().filter(l => l.id !== a.id && !areAllied(a.id, l.id)))
  if (!a || !b) return
  await aiLaunch(a.id, b.id)
  if (isAlive(b.id) && holderOf(b.id) === b.id && bombsOf(b.id) > 0 && chance(0.7)) {
    await wait(1200)
    const back = pick([a.id, ...alliesOf(a.id).filter(x => isAlive(x) && x !== state.playerId)]) ?? a.id
    await aiLaunch(b.id, back)
  }
  someoneReacts([a.id, b.id])
}

/* ---------- endings ---------- */

export function resolveEnding() {
  const s = state.stats
  const atWar = LEADERS.some(l => state.relations[l.id] === 'war')
  if (state.worldNukes >= 8) return endGame('annihilation')
  if (state.owner[state.playerId!]) return endGame('colonized')
  if (state.playerDestroyed) return endGame('exile')
  if (aliveRivals().filter(l => holderOf(l.id) !== state.playerId).length === 0) return endGame('victory')
  if (s.morale <= 0) return endGame('coup')
  if (s.economy <= 0) return endGame('debt')
  if (s.military <= 0 && atWar) return endGame('colonized')
  if (state.day > MAX_DAYS) return endGame(finalVerdict())
}

function finalVerdict() {
  const s = state.stats
  const allies = alliesOf(state.playerId!).length
  const wars = LEADERS.filter(l => state.relations[l.id] === 'war')
  if (state.playerMessages < 3 && !wars.length && !allies) return 'forgotten'
  if (!state.nukesLaunched && !wars.length && allies >= 4) return 'peace'
  if (aliveRivals().length <= 3 || s.standing >= 80) return 'victory'
  if (wars.some(l => l.stats.military >= s.military * 1.6)) return 'colonized'
  if (s.economy <= Math.min(s.military, s.morale, s.standing)) return 'debt'
  return 'coup'
}
