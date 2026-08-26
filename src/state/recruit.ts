import { LEADER_BY_ID, msg } from './mock'
import type { CountryId } from './types'
import {
  state, push, say, emit, setBloc, setPhase, formAlliance, breakAlliance, nudgeTrust, mem, isAlive,
} from './store'
import { leaderRespond } from '../net/respond'

const short = (id: CountryId) => LEADER_BY_ID.get(id)?.short ?? id
const names = (ids: CountryId[]) => ids.map(short).join(' · ')
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

/**
 * The third answer to "whose side are you on?" — neither. You name your own
 * pact and invite whoever you want. Roughly 60% of invitations land; states
 * already sworn to a crisis side are harder to pull, and warmth with you
 * tilts the odds either way.
 */
export function acceptOdds(id: CountryId): number {
  let p = 0.6 + mem(id).trust / 300
  if (state.crisis?.sides.some(s => s.includes(id))) p *= 0.8
  return Math.max(0.15, Math.min(0.9, p))
}

/** Puts the recruitment form into the global channel. The world watches you shop. */
export function startRecruit(): void {
  const m = msg('SYSTEM', 'GLOBAL',
    'Found your own alliance. Toggle every state you want in it — about 60% of invitations are accepted, and leaders already sworn to a side are harder to pull.',
    state.day, 'recruit')
  m.recruit = { chosen: [] }
  push(m)
}

export function toggleRecruit(messageId: string, id: CountryId): void {
  const m = state.messages.find(x => x.id === messageId)
  const r = m?.recruit
  if (!r || r.sent) return
  r.chosen = r.chosen.includes(id) ? r.chosen.filter(x => x !== id) : [...r.chosen, id]
  emit()
}

/**
 * The invitations go out at once and everyone answers on the spot. Whoever
 * signs walks out of the side they were on — pacts broken, blocmates
 * reshuffled — and your alliance channel opens with the founders in it.
 */
export async function sendInvites(messageId: string): Promise<void> {
  const m = state.messages.find(x => x.id === messageId)
  const r = m?.recruit
  const me = state.playerId
  if (!m || !r || r.sent || !me) return
  const invited = r.chosen.filter(id => id !== me && isAlive(id))
  if (!invited.length) return
  r.sent = true

  const accepted: CountryId[] = []
  const declined: CountryId[] = []
  for (const id of invited) (Math.random() < acceptOdds(id) ? accepted : declined).push(id)
  // an alliance of one is a press release, not a pact — the warmest invitee always signs
  if (!accepted.length) {
    const best = [...invited].sort((a, b) => mem(b).trust - mem(a).trust)[0]
    accepted.push(best)
    declined.splice(declined.indexOf(best), 1)
  }
  r.accepted = accepted
  r.declined = declined

  say(me, 'GLOBAL', `${short(me)} invites ${names(invited)} to found a new alliance.`, 'action')

  for (const id of accepted) {
    // leaving the old side: crisis roster, pacts and blocmate lists all let go
    if (state.crisis) for (const side of state.crisis.sides) {
      const i = side.indexOf(id)
      if (i < 0) continue
      side.splice(i, 1)
      for (const old of side) {
        breakAlliance(id, old)
        mem(old).bloc = mem(old).bloc.filter(x => x !== id)
      }
    }
    formAlliance(me, id)
    nudgeTrust(id, 30)
    mem(id).bloc = [me, ...accepted.filter(x => x !== id)]
  }
  for (const id of declined) nudgeTrust(id, -3)

  if (declined.length) say('SYSTEM', 'GLOBAL', `Declined: ${names(declined)}`, 'system')
  say('SYSTEM', 'GLOBAL', `A new alliance is signed: ${names([me, ...accepted])}`, 'system')
  setBloc(accepted)
  say('SYSTEM', 'BLOC', `Alliance channel — ${names([me, ...accepted])}. Only members can read this.`, 'system')
  state.unread['BLOC'] = 1
  setPhase('play')

  const p = short(me)
  void (async () => {
    await wait(600)
    if (declined.length) {
      await leaderRespond(declined[0], 'GLOBAL', { nudge: `${p} just invited you into a brand-new alliance and you turned it down. Say why, publicly, in your own terms.` })
    }
    await leaderRespond(accepted[0], 'BLOC', { nudge: `You have just co-founded a new alliance with ${p} (members: ${names([me, ...accepted])}). Welcome the pact and propose its first coordinated move.` })
    if (accepted[1]) {
      await leaderRespond(accepted[1], 'BLOC', { nudge: `Add to the plan or raise a concern about it; ask ${p} what this alliance's red line is.` })
    }
  })()
}
