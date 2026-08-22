import { LEADER_BY_ID } from './mock'
import type { CountryId, Treaty, TreatyTerms } from './types'
import { state, say, ask, emit, endGame, alliesOf, bombsOf, isAlive, holderOf } from './store'
import { POPULATION } from './population'
import { leaderRespond } from '../net/respond'
import { retaliate } from './turn'

/** Treaties open on this day — early enough to matter, late enough to have something to settle. */
export const TREATY_DAY = 10

const short = (id: CountryId) => LEADER_BY_ID.get(id)?.short ?? id
const names = (ids: CountryId[]) => ids.map(short).join(' · ')

/** Your side and theirs. Theirs is whichever crisis side you did not join. */
export function sides(): { ours: CountryId[]; theirs: CountryId[] } | null {
  if (!state.playerId || !state.crisis || !state.bloc.length) return null
  const ours = [state.playerId, ...state.bloc]
  const theirs = state.crisis.sides.find(s => !s.includes(state.bloc[0])) ?? []
  return { ours, theirs }
}

/** People one side has killed on the other. */
function damage(from: CountryId[], to: CountryId[]): number {
  return state.strikes.filter(s => from.includes(s.from) && to.includes(s.to)).reduce((a, s) => a + s.dead, 0)
}

const popOf = (ids: CountryId[]) => ids.reduce((a, id) => a + (POPULATION[id] ?? 0), 0)

/**
 * Who pays whom, and how much. The side that inflicted more death pays, and
 * the bill scales with the net toll: cash, oil, grain and a rebuilding
 * commitment — the things a shattered side actually needs.
 */
export function draftTerms(): TreatyTerms {
  const { ours, theirs } = sides()!
  const weDid = damage(ours, theirs)
  const theyDid = damage(theirs, ours)
  const net = Math.abs(weDid - theyDid)
  const payer = weDid >= theyDid ? ours : theirs
  const payee = payer === ours ? theirs : ours
  const m = net / 1e6
  return {
    payer, payee,
    deadByPayer: Math.max(weDid, theyDid),
    deadByPayee: Math.min(weDid, theyDid),
    billions: Math.round(40 + m * 2.2),
    oilMillionBarrels: Math.round(20 + m * 0.9),
    grainMillionTonnes: Math.round(5 + m * 0.3),
    rebuildYears: Math.min(30, 5 + Math.round(m / 12)),
  }
}

/**
 * Whether the other side will sign. They refuse while the damage done to
 * them is still something they can answer: if they have lost more than a
 * quarter of their people to your side and can still shoot, they would rather
 * shoot. They sign when they are exhausted — no warheads left among them — or
 * when the exchange has been roughly even.
 */
export function theyWouldSign(): boolean {
  const { ours, theirs } = sides()!
  const lossShare = damage(ours, theirs) / Math.max(1, popOf(theirs))
  const canShoot = theirs.some(id => isAlive(id) && holderOf(id) === id && bombsOf(id) > 0)
  if (!canShoot) return true
  const theirLoss = damage(theirs, ours) / Math.max(1, popOf(ours))
  return lossShare < 0.22 || lossShare <= theirLoss * 1.3
}

export const treatyOpen = () => state.day >= TREATY_DAY && state.phase === 'play' && !!sides() && !state.ending

/** Player offers. Terms are drafted, posted to the alliance channel, and the other side answers within a beat. */
export async function offerTreaty(): Promise<void> {
  if (!treatyOpen() || state.treaty?.status === 'offered') return
  const s = sides()!
  const terms = draftTerms()
  const t: Treaty = { status: 'offered', by: 'us', day: state.day, terms }
  state.treaty = t
  say('SYSTEM', 'BLOC', treatyText(terms), 'treaty')
  say(state.playerId!, 'GLOBAL', `${short(state.playerId!)} offers ${names(s.theirs)} a peace treaty: ${summary(terms)}.`, 'action')
  emit()

  const speaker = s.theirs.find(id => isAlive(id)) ?? s.theirs[0]
  if (theyWouldSign()) {
    await leaderRespond(speaker, 'GLOBAL', { nudge: `${short(state.playerId!)} has offered a peace treaty on these terms: ${summary(terms)}. Your side will sign. Say so, and say what you expect honoured.` })
    sign()
  } else {
    t.status = 'refused'; emit()
    await leaderRespond(speaker, 'GLOBAL', { nudge: `${short(state.playerId!)} has offered a peace treaty after killing ${Math.round(terms.deadByPayer / 1e6)} million of your side's people. Refuse it. Say why the damage makes peace impossible for now, and that you will keep answering.` })
    void retaliate(speaker)
  }
}

/** The other side offers. Called from the day engine when they are worn down. */
export function receiveOffer(): void {
  if (!treatyOpen() || state.treaty?.status === 'received' || state.treaty?.status === 'signed') return
  const s = sides()!
  const terms = draftTerms()
  state.treaty = { status: 'received', by: 'them', day: state.day, terms }
  say('SYSTEM', 'BLOC', treatyText(terms), 'treaty')
  say(s.theirs[0], 'GLOBAL', `${names(s.theirs)} offer ${short(state.playerId!)}'s side a peace treaty: ${summary(terms)}.`, 'action')
  ask('BLOC', `${names(s.theirs)} are offering to sign. Do you?`, [
    { label: 'Sign the peace treaty', members: s.theirs },
    { label: 'Refuse and fight on', members: [] },
  ])
}

/** Your answer to their offer; index 0 signs. */
export function answerOffer(index: number): void {
  if (state.treaty?.status !== 'received') return
  if (index === 0) { sign(); return }
  state.treaty.status = 'refused'; emit()
  const s = sides()!
  say(state.playerId!, 'GLOBAL', `${short(state.playerId!)} refuses the treaty.`, 'action')
  void leaderRespond(s.theirs[0], 'GLOBAL', { nudge: `${short(state.playerId!)} just refused your peace offer. Respond to that.` })
}

function sign() {
  if (!state.treaty) return
  state.treaty.status = 'signed'
  say('SYSTEM', 'GLOBAL', 'The treaty is signed. The guns stop.', 'system')
  setTimeout(() => endGame('treaty'), 2400)
}

function summary(t: TreatyTerms): string {
  return `${names(t.payer)} pay $${t.billions}B, ${t.oilMillionBarrels}M barrels of oil and ${t.grainMillionTonnes}M tonnes of grain to ${names(t.payee)} over ${t.rebuildYears} years`
}

function treatyText(t: TreatyTerms): string {
  return [
    `PEACE TREATY — drafted day ${state.day}`,
    `Parties: ${names(t.payer)} and ${names(t.payee)}.`,
    `Article 1. All strikes cease on signature. Arsenals stand down.`,
    `Article 2. ${names(t.payer)}, having inflicted ${Math.round(t.deadByPayer / 1e6)}M deaths against ${Math.round(t.deadByPayee / 1e6)}M suffered, pay reparations:`,
    `  — $${t.billions} billion in reconstruction funds`,
    `  — ${t.oilMillionBarrels} million barrels of oil`,
    `  — ${t.grainMillionTonnes} million tonnes of grain`,
    `  — over ${t.rebuildYears} years, supervised by CHE.`,
    `Article 3. Borders as they stand. Held territory returns to its people.`,
  ].join('\n')
}

/** Whether the other side is worn down enough to come to you. Used by the day engine. */
export function theyWantPeace(): boolean {
  if (!treatyOpen()) return false
  const { ours, theirs } = sides()!
  const lossShare = damage(ours, theirs) / Math.max(1, popOf(theirs))
  const canShoot = theirs.some(id => isAlive(id) && holderOf(id) === id && bombsOf(id) > 0)
  return !canShoot || lossShare >= 0.22 || alliesOf(state.playerId!).length > theirs.length
}
