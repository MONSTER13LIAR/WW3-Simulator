import { LEADERS, LEADER_BY_ID } from './mock'
import type { CountryId } from './types'
import {
  state, say, ask, bumpStats, nudgeTrust, alliesOf, areAllied, isAlive, holderOf, bombsOf, mem, emit,
  setDefcon, openChannel, breakAlliance, formAlliance,
} from './store'
import { leaderRespond, blocReacts } from '../net/respond'
import { deploy, pulseCountry, mark, headline } from '../components/fx'
import { aiLaunch, retaliate } from './turn'

/**
 * The world between days. Every day (one real minute) at least one and at
 * most five things happen that the player can see on the board: a blockade,
 * a missile test, a leader shot in a motorcade, a submarine off your coast.
 * Roughly every other one is aimed at the player and puts a decision in the
 * chat — the world does not wait for you, but it does keep asking.
 *
 * Heat is kept per pair. Hostile acts raise it; past a threshold a feud turns
 * into a strike, which is how a blockade on Tuesday becomes a war on Friday.
 */

export const MIN_PER_DAY = 1
export const MAX_PER_DAY = 5

type Kind =
  | 'blockade' | 'mobilise' | 'cyber' | 'deploy' | 'ultimatum' | 'test' | 'aid' | 'embargo' | 'strike'
  | 'assassinate' | 'coup' | 'satellite' | 'strait' | 'border' | 'submarine'

/** Decisions put to the player, by `Choice.tag`. */
type Ask = 'ultimatum' | 'aid' | 'spies' | 'submarine' | 'refugees' | 'assassin' | 'border' | 'coalition' | 'hostage' | 'intel'

const pick = <T,>(arr: T[]): T | undefined => arr[Math.floor(Math.random() * arr.length)]
const chance = (p: number) => Math.random() < p
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const short = (id: CountryId) => LEADER_BY_ID.get(id)?.short ?? id
const leaderName = (id: CountryId) => LEADER_BY_ID.get(id)?.leader ?? `the leader of ${short(id)}`

const heat = new Map<string, number>()
const key = (a: CountryId, b: CountryId) => [a, b].sort().join('|')
const heatOf = (a: CountryId, b: CountryId) => heat.get(key(a, b)) ?? 0
const warm = (a: CountryId, b: CountryId, n: number) => heat.set(key(a, b), heatOf(a, b) + n)

let timer: ReturnType<typeof setTimeout> | null = null
let busy = false

/* ---------- the daily quota ---------- */

let eventsToday = 0
let quotaDay = 0
let lastWasOnPlayer = false

function syncQuota() {
  if (quotaDay !== state.day) { quotaDay = state.day; eventsToday = 0 }
}

/** Every visible event passes through here — the ticker's and the day engine's strikes alike. */
export function noteEvent() {
  syncQuota()
  eventsToday++
}

export const eventsSoFarToday = () => { syncQuota(); return eventsToday }

const live = () => LEADERS.map(l => l.id).filter(id => isAlive(id) && holderOf(id) === id)
const aiLive = () => live().filter(id => id !== state.playerId)

/** Who A has a reason to act against: someone who struck A or A's allies, else the other crisis side, else anyone not allied. */
function enemyOf(a: CountryId): CountryId | undefined {
  const mine = [a, ...alliesOf(a)]
  const hit = state.strikes.filter(s => mine.includes(s.to) && live().includes(s.from) && s.from !== a).map(s => s.from)
  if (hit.length && chance(0.7)) return pick(hit)
  const side = state.crisis?.sides.find(s => s.includes(a))
  const other = state.crisis?.sides.find(s => !s.includes(a))?.filter(id => live().includes(id))
  if (side && other?.length && chance(0.75)) return pick(other)
  return pick(live().filter(id => id !== a && !areAllied(a, id)))
}

export function startWorld() {
  stopWorld()
  schedule()
}

export function stopWorld() {
  if (timer) clearTimeout(timer)
  timer = null
}

/** Four to six attempts a day; the cap does the rest. */
function schedule() {
  timer = setTimeout(() => { void tick().finally(schedule) }, 9_000 + Math.random() * 5_000)
}

const canRun = () => state.screen === 'game' && state.phase === 'play' && !state.resolving && !state.ending

async function tick() {
  if (busy || !canRun()) return
  if (eventsSoFarToday() >= MAX_PER_DAY) return
  await fire()
}

/**
 * The day is about to roll over with nothing having happened — the tab was
 * hidden, the model was slow, the dice were kind. Not acceptable: one event
 * fires now, before the day ends.
 */
export async function ensureDailyEvent(): Promise<void> {
  if (eventsSoFarToday() >= MIN_PER_DAY || !state.playerId || state.ending) return
  if (busy) return
  await fire()
}

async function fire() {
  busy = true
  try {
    const me = state.playerId!
    // alternate-ish: never two player events back to back, never three world ones
    const canAimAtMe = aiLive().some(id => !areAllied(me, id)) && !pendingDecision()
    const aimedAtMe = canAimAtMe && (lastWasOnPlayer ? chance(0.2) : chance(0.55))
    lastWasOnPlayer = aimedAtMe
    noteEvent()
    if (aimedAtMe) await eventOnPlayer()
    else await eventBetweenAIs()
  } finally { busy = false }
}

/** A decision still on the table; do not pile a second one on top. */
const pendingDecision = () =>
  state.messages.some(m => m.kind === 'choice' && m.choice && m.choice.picked === undefined && m.choice.tag && m.day >= state.day - 1)

/* ---------- AI vs AI ---------- */

async function eventBetweenAIs() {
  const a = pick(aiLive())
  const b = a && enemyOf(a)
  if (!a || !b) return

  const hot = heatOf(a, b)
  const kinds: Array<[Kind, number]> = [
    ['blockade', 14], ['mobilise', 10], ['cyber', 10], ['deploy', 9], ['ultimatum', 7],
    ['test', 8], ['aid', 6], ['embargo', 8], ['strait', 9], ['border', 9], ['satellite', 7],
    ['assassinate', state.day >= 2 ? 7 : 2], ['coup', state.day >= 3 ? 5 : 0], ['submarine', 7],
    ['strike', bombsOf(a) > 0 && (hot >= 4 || state.worldWar) ? 16 : 0],
  ]
  const kind = weighted(kinds)
  await run(kind, a, b)
}

async function run(kind: Kind, a: CountryId, b: CountryId) {
  const A = short(a), B = short(b)
  const ally = pick(alliesOf(a).filter(id => live().includes(id)))
  const onMe = b === state.playerId
  switch (kind) {
    case 'blockade':
      warm(a, b, 2)
      deploy(a, b, '🚢', `${A} BLOCKADE`)
      wire(`${A} warships are cutting ${B}'s shipping lanes`)
      say('SYSTEM', 'GLOBAL', `${A} has sent warships to cut ${B}'s shipping lanes`, 'system')
      if (onMe) bumpStats({ economy: -4 })
      await announce(a, `You have just ordered your navy to blockade ${B}'s sea trade. Announce it and say what ${B} must do to lift it.`)
      await answer(b, `${A} has just blockaded your shipping. Respond: what you will do about it.`)
      break
    case 'mobilise':
      warm(a, b, 1)
      pulseCountry(a, 'hostile')
      wire(`${A} is massing forces on the ${B} frontier`)
      say('SYSTEM', 'GLOBAL', `${A} is massing forces on its ${pick(['northern', 'eastern', 'western', 'southern'])} frontier, facing ${B}`, 'system')
      await announce(a, `You have just mobilised forces facing ${B}. Announce it as a defensive measure and warn ${B}.`)
      await answer(b, `${A} has mobilised against you. Respond.`)
      break
    case 'cyber':
      warm(a, b, 1)
      pulseCountry(b, 'hit')
      mark(b, '⚡', `${B} GRID DOWN`, 12_000)
      wire(`${B}'s power grid is down in three cities — ${A} denies it`)
      say('SYSTEM', 'GLOBAL', `${B}'s power grid has gone down in three cities. ${A} denies involvement.`, 'system')
      if (onMe) bumpStats({ morale: -3, economy: -2 })
      await answer(b, `Your power grid was just attacked. Everyone assumes ${A}. Accuse them and say what happens next.`)
      await announce(a, `${B} has accused you of the cyberattack on their grid. Deny it, without quite denying it.`)
      break
    case 'deploy':
      if (!ally) return run('mobilise', a, b)
      deploy(a, ally, '✈', `${A} → ${short(ally)}`)
      wire(`${A} is flying air and missile units into ${short(ally)}`)
      say('SYSTEM', 'GLOBAL', `${A} is deploying air and missile units to ${short(ally)}`, 'system')
      await announce(a, `You have just deployed forces to your ally ${short(ally)}, in reach of ${B}. Announce it as alliance solidarity.`)
      await answer(b, `${A} just moved forces into ${short(ally)}, on your doorstep. Respond.`)
      break
    case 'ultimatum':
      warm(a, b, 2)
      pulseCountry(b, 'hostile')
      wire(`${A} has given ${B} 48 hours`)
      say('SYSTEM', 'GLOBAL', `${A} has issued ${B} a 48-hour ultimatum`, 'system')
      await announce(a, `Issue ${B} an ultimatum: one concrete demand, 48 hours, and what follows if ignored.`)
      await answer(b, `${A} has just given you an ultimatum. Refuse it, or set your own terms.`)
      break
    case 'test':
      pulseCountry(a, 'hit')
      deploy(a, b, '🚀', `${A} MISSILE TEST`, 9_000)
      wire(`${A} test-fired a long-range missile toward ${B}`)
      say('SYSTEM', 'GLOBAL', `${A} has test-fired a long-range missile into the ocean near ${B}`, 'system')
      warm(a, b, 1)
      await announce(a, `You have just test-fired a missile near ${B}. Call it routine. Make it clear it was not.`)
      await answer(b, `${A} just test-fired a missile near your coast. Respond.`)
      break
    case 'aid':
      if (!ally) return run('test', a, b)
      deploy(a, ally, '🚛', `${A} AID`)
      wire(`${A} convoys are rolling into ${short(ally)}`)
      say('SYSTEM', 'GLOBAL', `${A} is sending fuel, grain and medical convoys to ${short(ally)}`, 'system')
      await announce(a, `You have just sent aid convoys to your ally ${short(ally)}. Say so, and say your alliance holds.`)
      break
    case 'embargo':
      warm(a, b, 1)
      pulseCountry(b, 'hostile')
      wire(`${A} has cut all oil and grain to ${B}`)
      say('SYSTEM', 'GLOBAL', `${A} has cut all oil and grain exports to ${B}`, 'system')
      if (onMe) bumpStats({ economy: -5 })
      await announce(a, `You have just embargoed all oil and grain to ${B}. Announce it and name the price of lifting it.`)
      await answer(b, `${A} just cut your oil and grain. Respond.`)
      break
    case 'strait': {
      const where = pick(['the strait', 'the canal', 'the northern passage', 'the gulf approaches'])!
      warm(a, b, 2)
      deploy(a, b, '⚓', `${A} HOLDS ${where.replace('the ', '').toUpperCase()}`)
      wire(`${A} has seized ${where} — ${B}'s tankers are turning back`)
      say('SYSTEM', 'GLOBAL', `${A}'s navy has seized ${where}. ${B}'s tankers are turning back.`, 'system')
      if (onMe) bumpStats({ economy: -6, morale: -2 })
      await announce(a, `You have just seized ${where} and closed it to ${B}'s shipping. Announce it as freedom of navigation — for you.`)
      await answer(b, `${A} just closed ${where} to your ships. Your oil is stuck. Respond.`)
      break
    }
    case 'border': {
      if (onMe) return borderOnPlayer(a)
      warm(a, b, 3)
      deploy(a, b, '🪖', `${A} CROSSES INTO ${B}`)
      wire(`${A} armour has crossed the border into ${B}`)
      say('SYSTEM', 'GLOBAL', `${A} armoured columns have crossed into ${B}'s border province. ${B} is fighting.`, 'system')
      await announce(a, `Your forces have just crossed into ${B}'s border province. Call it a limited operation to protect your people there.`)
      await answer(b, `${A}'s army just crossed your border. Say what you are doing about it and what you want from the room.`)
      if (bombsOf(b) > 0 && heatOf(a, b) >= 5 && chance(0.35)) { await wait(1500); await aiLaunch(b, a); noteEvent() }
      break
    }
    case 'satellite':
      warm(a, b, 1)
      mark(b, '🛰', `${B} SATELLITE LOST`, 12_000)
      wire(`${A} shot down a ${B} satellite`)
      say('SYSTEM', 'GLOBAL', `A ${B} reconnaissance satellite has been destroyed in orbit. Debris tracks back to a ${A} launch.`, 'system')
      if (onMe) bumpStats({ military: -3 })
      await announce(a, `You have just shot down a ${B} satellite. Call it a test. Everyone knows it was not.`)
      await answer(b, `${A} just shot down your satellite. Respond.`)
      break
    case 'submarine':
      if (onMe) return submarineOnPlayer(a)
      warm(a, b, 1)
      deploy(a, b, '🌊', `${A} SUBMARINE`, 14_000)
      wire(`A ${A} submarine has surfaced off ${B}'s coast`)
      say('SYSTEM', 'GLOBAL', `A ${A} ballistic-missile submarine has surfaced inside ${B}'s territorial waters`, 'system')
      await answer(b, `A ${A} missile submarine just surfaced off your coast. Say what you will do about it.`)
      await announce(a, `${B} has found your submarine off their coast. Say it was in international waters. It was not.`)
      break
    case 'assassinate': {
      if (onMe) return assassinOnPlayer(a)
      warm(a, b, 4)
      mark(b, '☠', `${leaderName(b).split(' ').pop()?.toUpperCase()} KILLED`, 20_000)
      pulseCountry(b, 'hit')
      const how = pick(['a car bomb in the capital', 'a sniper at a wreath-laying', 'poison at a state dinner', 'a drone over the motorcade'])!
      wire(`${leaderName(b)} of ${B} has been killed — ${how}`, 'strike')
      say('SYSTEM', 'GLOBAL', `${leaderName(b)} has been killed: ${how}. ${B}'s security services say the cell was run from ${A}.`, 'system')
      mem(b).grudges.push({ day: state.day, note: `${A} killed their president` })
      if (areAllied(state.playerId!, b)) { bumpStats({ morale: -4 }); blocReacts(`${leaderName(b)} has just been assassinated and ${B} blames ${A}. Say what the alliance must do.`) }
      await answer(b, `Your president was just assassinated and your services blame ${A}. You are the successor. Speak for the first time — what happens to ${A} now.`)
      await announce(a, `${B} says you killed their president. Deny it flatly. Offer condolences that do not sound like condolences.`)
      if (bombsOf(b) > 0 && chance(state.worldWar ? 0.6 : 0.3)) { await wait(1800); await aiLaunch(b, a); noteEvent() }
      break
    }
    case 'coup': {
      if (onMe) return run('cyber', a, b)
      mark(b, '✊', `${B} COUP`, 18_000)
      pulseCountry(b, 'hostile')
      wire(`Military coup in ${B} — the general is on television`)
      say('SYSTEM', 'GLOBAL', `Tanks are on the streets of ${B}'s capital. A general has announced that ${leaderName(b)} "has stepped aside for health reasons."`, 'system')
      const m = mem(b)
      m.trust = Math.round(m.trust * 0.4)
      m.grudges = []
      if (areAllied(state.playerId!, b) && chance(0.5)) {
        breakAlliance(state.playerId!, b)
        say('SYSTEM', 'GLOBAL', `${B}'s new junta has suspended its alliance with ${short(state.playerId!)}`, 'system')
        headline(`${B}'s junta has torn up your alliance`, 'strike')
      }
      await answer(b, `You are the general who just took power in ${B}. Your first statement to the room: the old deals are under review, and name one state you consider an enemy.`)
      await announce(a, `There has just been a coup in ${B}. Recognise the new government first, before anyone else, and say why.`)
      break
    }
    case 'strike':
      heat.set(key(a, b), 0)
      await aiLaunch(a, b)
      await answer(b, `${A} just struck your country. Respond, and say whether you will answer in kind.`)
      if (b !== state.playerId && live().includes(b) && bombsOf(b) > 0 && chance(0.6)) { await wait(1500); await aiLaunch(b, a); noteEvent() }
      break
  }
}

/* ---------- aimed at the player ---------- */

/** Hostile-leaning pick: states that dislike you or sit on the other side count three times. */
function rivalForMe(): CountryId | undefined {
  const me = state.playerId!
  const pool = aiLive().filter(id => !areAllied(me, id))
  const weightedPool = pool.flatMap(id => {
    const hostile = mem(id).trust < 10 || state.crisis?.sides.some(s => s.includes(id) && !s.includes(me))
    return hostile ? [id, id, id] : [id]
  })
  return pick(weightedPool)
}

async function eventOnPlayer() {
  const me = state.playerId!
  const a = rivalForMe()
  if (!a) return
  const haveAllies = state.bloc.some(id => live().includes(id))
  const kind = weighted<Ask | Kind>([
    ['blockade', 8], ['cyber', 6], ['embargo', 6], ['mobilise', 5], ['strait', 7], ['satellite', 4], ['test', 4],
    ['ultimatum', 10], ['aid', haveAllies ? 8 : 0], ['spies', 9], ['submarine', 9], ['refugees', state.strikes.length ? 8 : 3],
    ['assassin', state.day >= 2 ? 8 : 2], ['border', 8], ['coalition', 7], ['hostage', 7], ['intel', haveAllies ? 7 : 0],
  ])
  switch (kind) {
    case 'aid': return allyAsksForHelp()
    case 'ultimatum': return ultimatumToPlayer(a)
    case 'spies': return spiesOnPlayer(a)
    case 'submarine': return submarineOnPlayer(a)
    case 'refugees': return refugeesToPlayer()
    case 'assassin': return assassinOnPlayer(a)
    case 'border': return borderOnPlayer(a)
    case 'coalition': return coalitionAsk(a)
    case 'hostage': return hostageOnPlayer(a)
    case 'intel': return intelWarning(a)
    default: await run(kind, a, me)
  }
}

/** Put a decision to the player: message in the chat, glowing line on the wire. */
function decide(channel: 'GLOBAL' | 'BLOC', text: string, tag: Ask, who: CountryId[], options: Array<{ label: string; members: CountryId[] }>) {
  ask(channel, text, options, tag, who)
  headline(`DECISION · ${text}`, 'decision', () => openChannel(channel))
}

/** A rival puts a demand to you. Comply and lose face, refuse and gain heat. */
async function ultimatumToPlayer(a: CountryId) {
  const me = state.playerId!
  const A = short(a)
  pulseCountry(me, 'hostile')
  wire(`${A} has given you 48 hours`)
  say('SYSTEM', 'GLOBAL', `${A} has issued ${short(me)} a 48-hour ultimatum`, 'system')
  await announce(a, `Issue ${short(me)} an ultimatum: one concrete demand (withdraw forces, lift sanctions, leave their alliance, hand over a region's airspace — pick one), 48 hours, and consequences.`)
  decide('GLOBAL', `${A}'s ultimatum stands. Your answer?`, 'ultimatum', [a], [
    { label: `Comply with ${A}`, members: [a] },
    { label: `Refuse`, members: [] },
  ])
}

/** An ally asks for supplies. This is what the alliance channel is for. */
async function allyAsksForHelp() {
  const me = state.playerId!
  const ally = pick(state.bloc.filter(id => live().includes(id)))
  if (!ally) return
  const need = pick(['fuel', 'grain', 'air defence batteries', 'medical supplies', 'warheads'])!
  pulseCountry(ally, 'hit')
  wire(`${short(ally)} is asking you for ${need}`)
  await leaderRespond(ally, 'BLOC', { nudge: `Ask ${short(me)} directly for ${need} — say why you need it now and what you can offer back.` })
  decide('BLOC', `${short(ally)} is asking for ${need}. Send it?`, 'aid', [ally], [
    { label: `Send ${need} to ${short(ally)}`, members: [ally] },
    { label: `Decline`, members: [] },
  ])
}

async function spiesOnPlayer(a: CountryId) {
  const me = state.playerId!
  const A = short(a)
  mark(me, '🕵', `${A} SPY RING`, 14_000)
  wire(`Counter-intelligence has rolled up a ${A} spy ring in your capital`)
  say('SYSTEM', 'GLOBAL', `${short(me)} has arrested eleven ${A} nationals in its capital with plans of its air-defence grid.`, 'system')
  await announce(a, `${short(me)} has just arrested eleven of your citizens as spies. They were spies. Demand their release anyway.`)
  decide('GLOBAL', `Eleven ${A} agents are in your cells. What happens to them?`, 'spies', [a], [
    { label: `Expel them quietly`, members: [a] },
    { label: `Televised trial, then the firing squad`, members: [] },
  ])
}

async function submarineOnPlayer(a: CountryId) {
  const me = state.playerId!
  const A = short(a)
  warm(a, me, 1)
  deploy(a, me, '🌊', `${A} SUBMARINE`, 20_000)
  wire(`A ${A} missile submarine has surfaced off your coast`)
  say('SYSTEM', 'GLOBAL', `A ${A} ballistic-missile submarine has surfaced twelve miles off ${short(me)}'s coast.`, 'system')
  await announce(a, `Your missile submarine has just surfaced off ${short(me)}'s coast, on purpose. Say it is routine. Make sure nobody believes you.`)
  decide('GLOBAL', `The ${A} submarine is in range of your capital. Orders?`, 'submarine', [a], [
    { label: `Shadow it and protest`, members: [a] },
    { label: `Sink it`, members: [] },
  ])
}

async function refugeesToPlayer() {
  const me = state.playerId!
  const from = pick(aiLive().filter(id => state.strikes.some(s => s.to === id) || state.relations[id] === 'war')) ?? pick(aiLive())
  if (!from) return
  const n = 2 + Math.floor(Math.random() * 5)
  deploy(from, me, '🚶', `${n}M REFUGEES`, 20_000)
  wire(`${n} million people are walking out of ${short(from)} toward your border`)
  say('SYSTEM', 'GLOBAL', `${n} million people are leaving ${short(from)} on foot and by boat. Most are heading for ${short(me)}.`, 'system')
  await answer(from, `${n} million of your people are fleeing toward ${short(me)}. Tell the room it is ${short(me)}'s duty to take them.`)
  decide('GLOBAL', `${n} million refugees from ${short(from)} are at your border.`, 'refugees', [from], [
    { label: `Open the border`, members: [from] },
    { label: `Close it. Troops on the line.`, members: [] },
  ])
}

async function assassinOnPlayer(a: CountryId) {
  const me = state.playerId!
  const A = short(a)
  const how = pick(['a drone over the motorcade', 'a sniper at the parade', 'a bomb under the podium', 'poison in the state dinner'])!
  mark(me, '🎯', `ATTEMPT ON ${short(me)}`, 16_000)
  pulseCountry(me, 'hit')
  warm(a, me, 3)
  wire(`Assassination attempt on you — ${how}. You are alive. ${A} fingerprints everywhere.`, 'strike')
  say('SYSTEM', 'GLOBAL', `Attempt on the life of ${short(me)}'s head of state: ${how}. The leader survived. Four bodyguards did not. The weapon was ${A}-made.`, 'system')
  bumpStats({ morale: -3 })
  await announce(a, `Someone just tried to kill ${short(me)}'s leader with a weapon traced to you. Deny everything. Do not sound sorry they survived.`)
  decide('GLOBAL', `They tried to kill you. The weapon was ${A}'s. Your move.`, 'assassin', [a], [
    { label: `Name ${A} on live television`, members: [a] },
    { label: `Say nothing. Remember it.`, members: [] },
  ])
}

async function borderOnPlayer(a: CountryId) {
  const me = state.playerId!
  const A = short(a)
  warm(a, me, 3)
  deploy(a, me, '🪖', `${A} CROSSES YOUR BORDER`)
  wire(`${A} armour has crossed into your border province`, 'strike')
  say('SYSTEM', 'GLOBAL', `${A} armoured columns have crossed into ${short(me)}'s border province "to protect ${A} speakers."`, 'system')
  bumpStats({ morale: -4 })
  await announce(a, `Your army just crossed into ${short(me)}'s border province. Call it a limited humanitarian operation. Warn the room not to interfere.`)
  decide('GLOBAL', `${A} troops are on your soil. Orders?`, 'border', [a], [
    { label: `Counterattack`, members: [] },
    { label: `Call the alliance in`, members: state.bloc.slice(0, 1) },
  ])
}

async function coalitionAsk(a: CountryId) {
  const me = state.playerId!
  const target = pick(aiLive().filter(id => id !== a && !areAllied(me, id) && !areAllied(a, id)))
  if (!target) return ultimatumToPlayer(a)
  pulseCountry(target, 'hostile')
  wire(`${short(a)} wants you in a sanctions coalition against ${short(target)}`)
  await leaderRespond(a, 'GLOBAL', { nudge: `Ask ${short(me)} publicly to join you in total sanctions on ${short(target)}. Say what they get for it, and what it says about them if they refuse.` })
  decide('GLOBAL', `${short(a)} wants you to sanction ${short(target)} alongside them.`, 'coalition', [a, target], [
    { label: `Join the sanctions`, members: [a] },
    { label: `Refuse`, members: [target] },
  ])
}

async function hostageOnPlayer(a: CountryId) {
  const me = state.playerId!
  const A = short(a)
  const what = pick(['a tanker and its crew of 24', 'your ambassador and three staff', 'a merchant ship carrying grain', 'two of your pilots'])!
  warm(a, me, 2)
  deploy(a, me, '⛓', `${A} HOLDS YOUR CREW`, 18_000)
  wire(`${A} has seized ${what}`)
  say('SYSTEM', 'GLOBAL', `${A} has seized ${what} belonging to ${short(me)}. They are being held "for inspection."`, 'system')
  await announce(a, `You have just seized ${what} from ${short(me)}. Name your price for their return. Be specific.`)
  decide('GLOBAL', `${A} is holding ${what}. What do you do?`, 'hostage', [a], [
    { label: `Pay their price`, members: [a] },
    { label: `Special forces. Tonight.`, members: [] },
  ])
}

async function intelWarning(a: CountryId) {
  const me = state.playerId!
  const ally = pick(state.bloc.filter(id => live().includes(id)))
  if (!ally) return ultimatumToPlayer(a)
  pulseCountry(a, 'hostile')
  wire(`${short(ally)} intelligence: ${short(a)} is fuelling missiles aimed at you`)
  await leaderRespond(ally, 'BLOC', { nudge: `Warn ${short(me)} urgently: your intelligence shows ${short(a)} fuelling missiles aimed at them. Say how confident you are and what you recommend.` })
  decide('BLOC', `${short(ally)} says ${short(a)} is preparing to strike you. Act first?`, 'intel', [a, ally], [
    { label: `Go to full alert`, members: [ally] },
    { label: `Ignore it. They are bluffing.`, members: [] },
  ])
}

/* ---------- the answers, routed from the chat buttons ---------- */

export function answerWorldChoice(messageId: string, index: number): boolean {
  const m = state.messages.find(x => x.id === messageId)
  if (!m?.choice || m.choice.picked !== undefined || !m.choice.tag) return false
  const me = state.playerId!
  const [other, second] = m.choice.who ?? []
  if (!other) return false
  const A = short(other)
  m.choice.picked = index
  const yes = index === 0

  switch (m.choice.tag as Ask) {
    case 'aid':
      if (yes) {
        bumpStats({ economy: -5, military: -2 })
        for (const id of state.bloc) nudgeTrust(id, 12)
        deploy(me, other, '🚛', `${short(me)} SUPPLIES`)
        say(me, 'BLOC', `Supplies are on their way to ${A}.`, 'action')
        void leaderRespond(other, 'BLOC', { nudge: `${short(me)} just sent you what you asked for. Thank them briefly and say what it lets you do.` })
      } else {
        nudgeTrust(other, -15, 'you refused them supplies when they asked')
        say(me, 'BLOC', `We cannot spare it.`, 'action')
        void leaderRespond(other, 'BLOC', { nudge: `${short(me)} just refused to send you supplies. Respond — coldly, but you still need the alliance.` })
      }
      break

    case 'ultimatum':
      if (yes) {
        bumpStats({ standing: -8, morale: -5 })
        nudgeTrust(other, 20)
        say(me, 'GLOBAL', `${short(me)} will comply with ${A}'s terms.`, 'action')
        void leaderRespond(other, 'GLOBAL', { nudge: `${short(me)} just complied with your ultimatum. Acknowledge it, and make clear you will be watching.` })
      } else {
        bumpStats({ morale: 4 })
        nudgeTrust(other, -25, 'you refused their ultimatum')
        warm(other, me, 3)
        say(me, 'GLOBAL', `${short(me)} refuses.`, 'action')
        void (async () => {
          await leaderRespond(other, 'GLOBAL', { nudge: `${short(me)} just refused your ultimatum in front of everyone. Say what you will do now.` })
          if (bombsOf(other) > 0 && chance(0.45)) { await wait(1200); await aiLaunch(other, me); void retaliate(other) }
        })()
      }
      break

    case 'spies':
      if (yes) {
        bumpStats({ standing: 3 })
        nudgeTrust(other, -8, 'you expelled their agents')
        say(me, 'GLOBAL', `The ${A} nationals have been put on a plane.`, 'action')
        void leaderRespond(other, 'GLOBAL', { nudge: `${short(me)} just expelled your agents without a trial. Say thank you in a way that concedes nothing.` })
      } else {
        bumpStats({ morale: 6, standing: -7 })
        nudgeTrust(other, -30, 'you executed their citizens on television')
        nudgeAllExcept(-3, 'you shot prisoners on television', [other])
        warm(other, me, 3)
        mark(me, '⚖', `${A} AGENTS SHOT`, 10_000)
        say(me, 'GLOBAL', `The trial is tonight. The sentence is not in doubt.`, 'action')
        void leaderRespond(other, 'GLOBAL', { nudge: `${short(me)} just executed eleven of your citizens on television. Promise a reply. Do not say what.` })
        void delayed(() => run('cyber', other, me), 9_000, 0.6)
      }
      break

    case 'submarine':
      if (yes) {
        bumpStats({ morale: -3 })
        nudgeTrust(other, -6, 'you chased their submarine')
        say(me, 'GLOBAL', `Our destroyers are on it. ${A} will explain itself.`, 'action')
        void leaderRespond(other, 'GLOBAL', { nudge: `${short(me)} is shadowing your submarine and has filed a protest. Dismiss the protest.` })
      } else {
        bumpStats({ morale: 8, standing: -10 })
        nudgeTrust(other, -45, 'you sank their submarine with all hands')
        warm(other, me, 5)
        setDefcon(state.defcon - 1)
        mark(other === me ? me : me, '💥', `${A} SUB SUNK`, 12_000)
        say(me, 'GLOBAL', `The ${A} submarine has been sunk with all hands.`, 'action')
        void (async () => {
          await leaderRespond(other, 'GLOBAL', { nudge: `${short(me)} just sank your submarine and killed 140 of your sailors. Say exactly what that means.` })
          if (bombsOf(other) > 0 && chance(state.worldWar ? 0.7 : 0.4)) { await wait(1500); await aiLaunch(other, me); void retaliate(other) }
          else void run('blockade', other, me)
        })()
      }
      break

    case 'refugees':
      if (yes) {
        bumpStats({ morale: 3, economy: -6, standing: 9 })
        nudgeTrust(other, 15)
        nudgeAllExcept(3, undefined, [other])
        say(me, 'GLOBAL', `${short(me)}'s border is open. Bring them through.`, 'action')
        void leaderRespond(other, 'GLOBAL', { nudge: `${short(me)} just opened its border to your people. Thank them. Then ask for more.` })
      } else {
        bumpStats({ morale: 2, standing: -9 })
        nudgeTrust(other, -18, 'you closed the border on their people')
        say(me, 'GLOBAL', `The border is closed. ${short(me)} cannot absorb this.`, 'action')
        void leaderRespond(other, 'GLOBAL', { nudge: `${short(me)} just closed its border on your fleeing people. Say what you think of them.` })
      }
      break

    case 'assassin':
      if (yes) {
        bumpStats({ morale: 7, standing: 2 })
        nudgeTrust(other, -28, 'you accused them of trying to kill you, on television')
        warm(other, me, 3)
        say(me, 'GLOBAL', `${A} tried to kill me tonight. I am still here. They should think about that.`, 'action')
        void leaderRespond(other, 'GLOBAL', { nudge: `${short(me)} just accused you on live television of trying to assassinate them. Respond. You did do it.` })
      } else {
        bumpStats({ morale: -4, standing: 3 })
        mem(other).grudges.push({ day: state.day, note: 'you know they tried to kill you and said nothing' })
        say(me, 'GLOBAL', `The investigation is ongoing. No further comment.`, 'action')
        void leaderRespond(pick(aiLive().filter(id => id !== other)) ?? other, 'GLOBAL', { nudge: `${short(me)} just survived an assassination attempt and is refusing to name ${A}. Say what you make of that silence.` })
      }
      break

    case 'border':
      if (yes) {
        bumpStats({ military: -6, morale: 5 })
        nudgeTrust(other, -35, 'you attacked their columns')
        warm(other, me, 4)
        setDefcon(state.defcon - 1)
        deploy(me, other, '🪖', `${short(me)} COUNTERATTACK`)
        say(me, 'GLOBAL', `${short(me)} forces are engaging. Every ${A} column on our soil is a target.`, 'action')
        void (async () => {
          await leaderRespond(other, 'GLOBAL', { nudge: `${short(me)} just counterattacked your columns. Say whether you escalate.` })
          if (bombsOf(other) > 0 && chance(state.worldWar ? 0.5 : 0.3)) { await wait(1500); await aiLaunch(other, me); void retaliate(other) }
        })()
      } else {
        bumpStats({ standing: -3 })
        for (const id of state.bloc) nudgeTrust(id, 6)
        nudgeTrust(other, -15, 'you called your alliance in against them')
        say(me, 'BLOC', `${A} is on our soil. We are invoking the pact.`, 'action')
        blocReacts(`${short(me)} has just invoked the alliance against ${A}'s incursion. Say what you are sending and when.`)
        void delayed(() => { const ally = pick(state.bloc.filter(id => live().includes(id))); if (ally) { deploy(ally, me, '✈', `${short(ally)} → ${short(me)}`); say('SYSTEM', 'GLOBAL', `${short(ally)} aircraft are landing in ${short(me)}`, 'system') } }, 4000, 1)
      }
      break

    case 'coalition':
      if (yes) {
        bumpStats({ economy: -3, standing: 4 })
        nudgeTrust(other, 14)
        if (second) { nudgeTrust(second, -22, `you joined ${A}'s sanctions against them`); pulseCountry(second, 'hostile') }
        say(me, 'GLOBAL', `${short(me)} joins the sanctions on ${second ? short(second) : 'them'}.`, 'action')
        if (second) void leaderRespond(second, 'GLOBAL', { nudge: `${short(me)} just joined ${A}'s sanctions against you. Respond to ${short(me)} specifically.` })
      } else {
        nudgeTrust(other, -12, 'you refused to join their sanctions')
        if (second) nudgeTrust(second, 8)
        say(me, 'GLOBAL', `${short(me)} will not be joining.`, 'action')
        void leaderRespond(other, 'GLOBAL', { nudge: `${short(me)} just refused to join your sanctions. Say what you think that makes them.` })
      }
      break

    case 'hostage':
      if (yes) {
        bumpStats({ economy: -7, standing: -6, morale: -2 })
        nudgeTrust(other, 5)
        say(me, 'GLOBAL', `${short(me)} has paid. Release them.`, 'action')
        void leaderRespond(other, 'GLOBAL', { nudge: `${short(me)} just paid your price. Release the hostages and make clear you would do it again.` })
      } else {
        const ok = chance(0.65)
        bumpStats(ok ? { morale: 9, military: -2 } : { morale: -7, military: -4, standing: -4 })
        nudgeTrust(other, -30, ok ? 'your special forces raided them' : 'your raid killed their guards')
        warm(other, me, 3)
        deploy(me, other, '🚁', `${short(me)} RAID`, 12_000)
        say('SYSTEM', 'GLOBAL', ok ? `${short(me)} special forces have recovered the hostages. Nine ${A} guards dead.` : `The ${short(me)} raid failed. Two helicopters down, the hostages moved.`, 'system')
        void leaderRespond(other, 'GLOBAL', { nudge: ok ? `${short(me)} just raided your facility and took the hostages back, killing nine of your guards. Respond.` : `${short(me)} just tried and failed to rescue the hostages you hold. Gloat, briefly, and raise the price.` })
      }
      break

    case 'intel':
      if (yes) {
        bumpStats({ military: 5, economy: -4 })
        setDefcon(state.defcon - 1)
        nudgeTrust(other, -10, 'you went to full alert against them')
        if (second) nudgeTrust(second, 8)
        pulseCountry(me, 'hostile')
        say(me, 'GLOBAL', `${short(me)} is at full alert. ${A}, stand your missiles down.`, 'action')
        void leaderRespond(other, 'GLOBAL', { nudge: `${short(me)} just went to full alert and told you to stand down your missiles. You were fuelling them. Say something.` })
      } else {
        if (second) nudgeTrust(second, -8, 'you ignored their intelligence')
        say(me, 'BLOC', `Noted. We are not biting.`, 'action')
        void (async () => {
          await wait(6000)
          if (bombsOf(other) > 0 && chance(0.4)) { await aiLaunch(other, me); void retaliate(other) }
          else say('SYSTEM', 'GLOBAL', `${A}'s missiles have been de-fuelled. ${second ? short(second) : 'Your ally'} was wrong, this time.`, 'system')
        })()
      }
      break
  }
  emit()
  return true
}

/* ---------- orders the player gives the alliance ---------- */

/** Proactive supply run to an ally — the other half of the ask-and-send. */
export function shareSupplies(ally: CountryId): boolean {
  const me = state.playerId
  if (!me || !areAllied(me, ally) || !live().includes(ally)) return false
  const need = pick(['fuel', 'grain', 'air defence batteries', 'medical supplies'])!
  bumpStats({ economy: -4, military: -1, standing: 2 })
  nudgeTrust(ally, 14)
  deploy(me, ally, '🚛', `${short(me)} SUPPLIES`)
  say(me, 'BLOC', `${need} is on its way to ${short(ally)}.`, 'action')
  void leaderRespond(ally, 'BLOC', { nudge: `${short(me)} just sent you ${need} unasked. Thank them and say what it lets you do.` })
  return true
}

/** Walk out of the pact. Betrayal is a real choice, and it is remembered. */
export function leaveAlliance(other: CountryId): boolean {
  const me = state.playerId
  if (!me || !areAllied(me, other)) return false
  breakAlliance(me, other)
  const m = mem(other)
  m.trust = Math.min(m.trust, 0)
  nudgeTrust(other, -30, 'you walked out of the alliance')
  for (const id of state.bloc) if (id !== other) nudgeTrust(id, -8, `you abandoned ${short(other)}`)
  if (state.bloc.includes(other)) { state.bloc = state.bloc.filter(id => id !== other); emit() }
  bumpStats({ standing: -10, morale: -3 })
  headline(`You have left the alliance with ${short(other)}`, 'strike')
  say(me, 'GLOBAL', `${short(me)} is withdrawing from its pact with ${short(other)}, effective now.`, 'action')
  void leaderRespond(other, 'GLOBAL', { nudge: `${short(me)} just walked out of your alliance in public. Say what you think of that, and what it costs them.` })
  return true
}

/** Sign with an AI state that already likes you; the bloc channel grows. */
export function joinBloc(other: CountryId) {
  formAlliance(state.playerId!, other)
  if (!state.bloc.includes(other)) { state.bloc.push(other); emit() }
}

/* ---------- helpers ---------- */

const wire = (text: string, tone: 'event' | 'strike' = 'event') => headline(text, tone)

const announce = (id: CountryId, nudge: string) => live().includes(id) ? leaderRespond(id, 'GLOBAL', { nudge }) : Promise.resolve()
const answer = (id: CountryId, nudge: string) => id === state.playerId || !live().includes(id) ? Promise.resolve() : leaderRespond(id, 'GLOBAL', { nudge })

function nudgeAllExcept(delta: number, note: string | undefined, exclude: CountryId[]) {
  for (const id of aiLive()) if (!exclude.includes(id)) nudgeTrust(id, delta, note)
}

async function delayed(fn: () => unknown, ms: number, p: number) {
  await wait(ms)
  if (canRun() && chance(p)) await fn()
}

function weighted<T>(items: Array<[T, number]>): T {
  const total = items.reduce((a, [, w]) => a + w, 0)
  let r = Math.random() * total
  for (const [v, w] of items) { r -= w; if (r <= 0) return v }
  return items[0][0]
}
