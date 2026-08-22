import { LEADERS, LEADER_BY_ID } from './mock'
import type { CountryId } from './types'
import {
  state, say, ask, bumpStats, nudgeTrust, alliesOf, areAllied, isAlive, holderOf, bombsOf, mem, emit,
} from './store'
import { leaderRespond } from '../net/respond'
import { deploy, pulseCountry } from '../components/fx'
import { aiLaunch, retaliate } from './turn'

/**
 * The world between days. Left alone, the room used to go quiet after the
 * opening; now every ten to eighteen seconds two states do something to each
 * other — on the map, announced in the room, answered by the target — and
 * every so often the thing is aimed at the player, who has to decide.
 *
 * Heat is kept per pair. Hostile acts raise it; past a threshold a feud turns
 * into a strike, which is how a blockade on Tuesday becomes a war on Friday.
 */

type Kind = 'blockade' | 'mobilise' | 'cyber' | 'deploy' | 'ultimatum' | 'test' | 'aid' | 'embargo' | 'strike'

const pick = <T,>(arr: T[]): T | undefined => arr[Math.floor(Math.random() * arr.length)]
const chance = (p: number) => Math.random() < p
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const short = (id: CountryId) => LEADER_BY_ID.get(id)?.short ?? id

const heat = new Map<string, number>()
const key = (a: CountryId, b: CountryId) => [a, b].sort().join('|')
const heatOf = (a: CountryId, b: CountryId) => heat.get(key(a, b)) ?? 0
const warm = (a: CountryId, b: CountryId, n: number) => heat.set(key(a, b), heatOf(a, b) + n)

let timer: ReturnType<typeof setTimeout> | null = null
let busy = false

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

function schedule() {
  timer = setTimeout(() => { void tick().finally(schedule) }, 10_000 + Math.random() * 8_000)
}

async function tick() {
  if (busy || state.screen !== 'game' || state.phase !== 'play' || state.resolving || state.ending) return
  if (document.hidden) return
  busy = true
  try {
    const me = state.playerId!
    const aimedAtMe = chance(0.28) && aiLive().some(id => !areAllied(me, id))
    if (aimedAtMe) await eventOnPlayer()
    else await eventBetweenAIs()
  } finally { busy = false }
}

/* ---------- AI vs AI ---------- */

async function eventBetweenAIs() {
  const a = pick(aiLive())
  const b = a && enemyOf(a)
  if (!a || !b) return

  const hot = heatOf(a, b)
  const kinds: Array<[Kind, number]> = [
    ['blockade', 20], ['mobilise', 16], ['cyber', 12], ['deploy', 12], ['ultimatum', 8],
    ['test', 8], ['aid', 8], ['embargo', 10],
    ['strike', bombsOf(a) > 0 && (hot >= 4 || state.worldWar) ? 14 : 0],
  ]
  const kind = weighted(kinds)
  await run(kind, a, b)
}

async function run(kind: Kind, a: CountryId, b: CountryId) {
  const A = short(a), B = short(b)
  const ally = pick(alliesOf(a).filter(id => live().includes(id)))
  switch (kind) {
    case 'blockade':
      warm(a, b, 2)
      deploy(a, b, '🚢', `${A} BLOCKADE`)
      say('SYSTEM', 'GLOBAL', `${A} has sent warships to cut ${B}'s shipping lanes`, 'system')
      if (b === state.playerId) bumpStats({ economy: -4 })
      await announce(a, `You have just ordered your navy to blockade ${B}'s sea trade. Announce it and say what ${B} must do to lift it.`)
      await answer(b, `${A} has just blockaded your shipping. Respond: what you will do about it.`)
      break
    case 'mobilise':
      warm(a, b, 1)
      pulseCountry(a, 'hostile')
      say('SYSTEM', 'GLOBAL', `${A} is massing forces on its ${pick(['northern', 'eastern', 'western', 'southern'])} frontier, facing ${B}`, 'system')
      await announce(a, `You have just mobilised forces facing ${B}. Announce it as a defensive measure and warn ${B}.`)
      await answer(b, `${A} has mobilised against you. Respond.`)
      break
    case 'cyber':
      warm(a, b, 1)
      pulseCountry(b, 'hit')
      say('SYSTEM', 'GLOBAL', `${B}'s power grid has gone down in three cities. ${A} denies involvement.`, 'system')
      if (b === state.playerId) bumpStats({ morale: -3, economy: -2 })
      await answer(b, `Your power grid was just attacked. Everyone assumes ${A}. Accuse them and say what happens next.`)
      await announce(a, `${B} has accused you of the cyberattack on their grid. Deny it, without quite denying it.`)
      break
    case 'deploy':
      if (!ally) return run('mobilise', a, b)
      deploy(a, ally, '✈', `${A} → ${short(ally)}`)
      say('SYSTEM', 'GLOBAL', `${A} is deploying air and missile units to ${short(ally)}`, 'system')
      await announce(a, `You have just deployed forces to your ally ${short(ally)}, in reach of ${B}. Announce it as alliance solidarity.`)
      await answer(b, `${A} just moved forces into ${short(ally)}, on your doorstep. Respond.`)
      break
    case 'ultimatum':
      warm(a, b, 2)
      pulseCountry(b, 'hostile')
      say('SYSTEM', 'GLOBAL', `${A} has issued ${B} a 48-hour ultimatum`, 'system')
      await announce(a, `Issue ${B} an ultimatum: one concrete demand, 48 hours, and what follows if ignored.`)
      await answer(b, `${A} has just given you an ultimatum. Refuse it, or set your own terms.`)
      break
    case 'test':
      pulseCountry(a, 'hit')
      say('SYSTEM', 'GLOBAL', `${A} has test-fired a long-range missile into the ocean near ${B}`, 'system')
      warm(a, b, 1)
      await announce(a, `You have just test-fired a missile near ${B}. Call it routine. Make it clear it was not.`)
      await answer(b, `${A} just test-fired a missile near your coast. Respond.`)
      break
    case 'aid':
      if (!ally) return run('test', a, b)
      deploy(a, ally, '🚛', `${A} AID`)
      say('SYSTEM', 'GLOBAL', `${A} is sending fuel, grain and medical convoys to ${short(ally)}`, 'system')
      await announce(a, `You have just sent aid convoys to your ally ${short(ally)}. Say so, and say your alliance holds.`)
      break
    case 'embargo':
      warm(a, b, 1)
      pulseCountry(b, 'hostile')
      say('SYSTEM', 'GLOBAL', `${A} has cut all oil and grain exports to ${B}`, 'system')
      if (b === state.playerId) bumpStats({ economy: -5 })
      await announce(a, `You have just embargoed all oil and grain to ${B}. Announce it and name the price of lifting it.`)
      await answer(b, `${A} just cut your oil and grain. Respond.`)
      break
    case 'strike':
      heat.set(key(a, b), 0)
      await aiLaunch(a, b)
      await answer(b, `${A} just struck your country. Respond, and say whether you will answer in kind.`)
      if (b !== state.playerId && live().includes(b) && bombsOf(b) > 0 && chance(0.6)) { await wait(1500); await aiLaunch(b, a) }
      break
  }
}

/* ---------- aimed at the player ---------- */

async function eventOnPlayer() {
  const me = state.playerId!
  const a = pick(aiLive().filter(id => !areAllied(me, id) && (mem(id).trust < 10 || state.crisis?.sides.some(s => s.includes(id) && !s.includes(me)))))
  if (!a) return
  const kind = weighted<Kind>([['blockade', 18], ['cyber', 12], ['ultimatum', 22], ['embargo', 14], ['mobilise', 14], ['aid', 20]])
  if (kind === 'aid') return allyAsksForHelp()
  if (kind === 'ultimatum') return ultimatumToPlayer(a)
  await run(kind, a, me)
}

/** A rival puts a demand to you. Comply and lose face, refuse and gain heat. */
async function ultimatumToPlayer(a: CountryId) {
  const me = state.playerId!
  const A = short(a)
  pulseCountry(me, 'hostile')
  say('SYSTEM', 'GLOBAL', `${A} has issued ${short(me)} a 48-hour ultimatum`, 'system')
  await announce(a, `Issue ${short(me)} an ultimatum: one concrete demand (withdraw forces, lift sanctions, leave their alliance, hand over a region's airspace — pick one), 48 hours, and consequences.`)
  ask('GLOBAL', `${A}'s ultimatum stands. Your answer?`, [
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
  await leaderRespond(ally, 'BLOC', { nudge: `Ask ${short(me)} directly for ${need} — say why you need it now and what you can offer back.` })
  ask('BLOC', `${short(ally)} is asking for ${need}. Send it?`, [
    { label: `Send ${need} to ${short(ally)}`, members: [ally] },
    { label: `Decline`, members: [] },
  ])
}

/** Answers to the two decisions above, routed from the chat buttons. */
export function answerWorldChoice(messageId: string, index: number): boolean {
  const m = state.messages.find(x => x.id === messageId)
  if (!m?.choice || m.choice.picked !== undefined) return false
  const me = state.playerId!
  const other = m.choice.options[0].members[0]
  if (!other) return false

  if (m.channel === 'BLOC' && m.text.includes('asking for')) {
    m.choice.picked = index
    if (index === 0) {
      bumpStats({ economy: -5, military: -2 })
      for (const id of state.bloc) nudgeTrust(id, 12)
      deploy(me, other, '🚛', `${short(me)} SUPPLIES`)
      say(me, 'BLOC', `Supplies are on their way to ${short(other)}.`, 'action')
      void leaderRespond(other, 'BLOC', { nudge: `${short(me)} just sent you what you asked for. Thank them briefly and say what it lets you do.` })
    } else {
      nudgeTrust(other, -15, 'you refused them supplies when they asked')
      say(me, 'BLOC', `We cannot spare it.`, 'action')
      void leaderRespond(other, 'BLOC', { nudge: `${short(me)} just refused to send you supplies. Respond — coldly, but you still need the alliance.` })
    }
    emit()
    return true
  }

  if (m.channel === 'GLOBAL' && m.text.includes('ultimatum')) {
    m.choice.picked = index
    if (index === 0) {
      bumpStats({ standing: -8, morale: -5 })
      nudgeTrust(other, 20)
      say(me, 'GLOBAL', `${short(me)} will comply with ${short(other)}'s terms.`, 'action')
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
    emit()
    return true
  }
  return false
}

/* ---------- helpers ---------- */

const announce = (id: CountryId, nudge: string) => live().includes(id) ? leaderRespond(id, 'GLOBAL', { nudge }) : Promise.resolve()
const answer = (id: CountryId, nudge: string) => id === state.playerId || !live().includes(id) ? Promise.resolve() : leaderRespond(id, 'GLOBAL', { nudge })

function weighted<T>(items: Array<[T, number]>): T {
  const total = items.reduce((a, [, w]) => a + w, 0)
  let r = Math.random() * total
  for (const [v, w] of items) { r -= w; if (r <= 0) return v }
  return items[0][0]
}
