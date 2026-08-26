import { LEADERS, LEADER_BY_ID } from './mock'
import { REGIONS, type CountryId, type Region } from './types'
import {
  state, say, ask, setPhase, setCrisis, setBloc, formAlliance, nudgeTrust, strikeCountry,
  spendBomb, setDefcon, mem, openChannel, bombsOf, alliesOf,
} from './store'
import { formatExact } from './population'
import { leaderRespond } from '../net/respond'
import { strike as strikeFx } from '../components/fx'
import { startRecruit } from './recruit'

const pick = <T,>(arr: T[]): T | undefined => arr[Math.floor(Math.random() * arr.length)]
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const short = (id: CountryId) => LEADER_BY_ID.get(id)?.short ?? id
const names = (ids: CountryId[]) => ids.map(short).join(' · ')

/**
 * The world does not wait for you. The moment the guide closes, one state
 * has already struck another; the room splits over it, argues in front of
 * you, and then asks which side you are on. Every line is the model's, fed
 * the incident and its side — this is where the game earns its API key.
 */
export async function runOpening(): Promise<void> {
  if (!state.playerId || state.phase !== 'guide') return
  setPhase('opening')
  openChannel('GLOBAL')

  const ai = LEADERS.filter(l => l.id !== state.playerId).map(l => l.id)
  const aggressor = pick(ai.filter(id => bombsOf(id) >= 4)) ?? ai[0]
  const rest = ai.filter(id => id !== aggressor)
  const victim = pick(rest)!
  const others = shuffle(rest.filter(id => id !== victim))
  // blocs are never the same size twice: 3 to 5 states each, the rest unaligned
  const sizeA = 3 + Math.floor(Math.random() * 3)
  const sizeB = 3 + Math.floor(Math.random() * 3)
  const sideA = [aggressor, ...others.slice(0, sizeA - 1)]
  const sideB = [victim, ...others.slice(sizeA - 1, sizeA - 1 + sizeB - 1)]
  const region = pick(REGIONS) as Region

  for (const side of [sideA, sideB]) {
    for (const a of side) for (const b of side) if (a !== b && !alliesOf(a).includes(b)) formAlliance(a, b)
    for (const m of side) mem(m).bloc = side.filter(x => x !== m)
  }
  setCrisis({ aggressor, victim, region, sides: [sideA, sideB] })

  // the strike itself — it really happens
  await wait(900)
  spendBomb(aggressor)
  say('SYSTEM', 'GLOBAL', `BREAKING — ${short(aggressor)} has launched on ${short(victim)}`, 'system')
  strikeFx(aggressor, victim, `${short(victim).toUpperCase()} · ${region.toUpperCase()}`, region)
  await wait(1500)
  const toll = strikeCountry(victim, aggressor, region)
  setDefcon(2)
  say('SYSTEM', 'GLOBAL', `${short(victim)} ${region} — ${formatExact(toll)} dead`, 'system')

  // the room argues, in order, each with a reason to speak
  const p = short(state.playerId)
  const turns: Array<[CountryId, string]> = [
    [victim, `Your country was just struck by ${short(aggressor)}, ${region} region, ${Math.round(toll / 1e6)} million dead. Address ${short(aggressor)} and the room. Demand an answer.`],
    [aggressor, `You just struck ${short(victim)}. Justify it to the room as a necessary act and warn ${short(victim)}'s allies (${names(sideB.slice(1))}) to stay out.`],
    [sideB[1], `${short(victim)} is your ally and was just struck by ${short(aggressor)}. Commit to ${short(victim)}'s side in public and warn ${short(aggressor)}.`],
    [sideA[1], `${short(aggressor)} is your ally. Back ${short(aggressor)} and tell ${names(sideB)} that your side will answer any retaliation.`],
    // deeper benches speak too — every extra member of a 4- or 5-state bloc adds one hard line
    ...sideB.slice(3).map((id): [CountryId, string] =>
      [id, `You are also sworn to ${short(victim)}'s side (${names(sideB)}). Add one hard line of your own: what your bloc does if ${short(aggressor)}'s side moves again.`]),
    ...sideA.slice(3).map((id): [CountryId, string] =>
      [id, `You are also sworn to ${short(aggressor)}'s side (${names(sideA)}). Add one hard line of your own backing ${short(aggressor)} against ${names(sideB)}.`]),
    [sideB[2], `Turn to ${p}, who has said nothing yet. Ask ${p} directly whether they stand with ${names(sideB)} or with ${names(sideA)}.`],
    [sideA[2], `${p} has not chosen a side. Make ${p} an offer to join ${names(sideA)} — say what ${p} gains, and what ${p} risks by refusing.`],
  ]
  for (const [id, nudge] of turns) {
    await leaderRespond(id, 'GLOBAL', { nudge })
    await wait(400 + Math.random() * 500)
  }

  ask('GLOBAL', 'The room is waiting. Whose side are you on?', [
    { label: `Join ${names(sideA)}`, members: sideA },
    { label: `Join ${names(sideB)}`, members: sideB },
    { label: 'Neither — found your own alliance', members: [] },
  ])
}

/** The player picks a side: pacts with one bloc, a grudge from the other, and a channel of their own. */
export function pickSide(messageId: string, index: number): void {
  const m = state.messages.find(x => x.id === messageId)
  if (!m?.choice || m.choice.picked !== undefined || !state.playerId || !state.crisis) return
  m.choice.picked = index
  const me = state.playerId
  const chosen = m.choice.options[index].members

  // the third door: refuse both blocs and shop for your own
  if (!chosen.length) {
    say(me, 'GLOBAL', `${short(me)} declines both blocs and will found an alliance of its own.`, 'action')
    startRecruit()
    return
  }
  const other = m.choice.options.find((o, i) => i !== index && o.members.length)?.members ?? []

  for (const id of chosen) { formAlliance(me, id); nudgeTrust(id, 30); mem(id).bloc.push(me) }
  for (const id of other) nudgeTrust(id, -30, `you joined ${names(chosen)} against them`)
  setBloc(chosen)
  say(me, 'GLOBAL', `${short(me)} stands with ${names(chosen)}.`, 'action')
  say('SYSTEM', 'BLOC', `Alliance channel — ${names([me, ...chosen])}. Only members can read this.`, 'system')
  state.unread['BLOC'] = 1
  setPhase('play')

  const p = short(me)
  void (async () => {
    await wait(600)
    await leaderRespond(pick(other)!, 'GLOBAL', { nudge: `${p} just sided against you with ${names(chosen)}. Respond to ${p} directly.` })
    await leaderRespond(chosen[0], 'BLOC', { nudge: `${p} has just joined your alliance. Welcome ${p} and propose the first coordinated move against ${names(other)}.` })
    await leaderRespond(chosen[1], 'BLOC', { nudge: `Add to the plan or raise a concern about it; ask ${p} what ${p} can commit.` })
  })()
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}
