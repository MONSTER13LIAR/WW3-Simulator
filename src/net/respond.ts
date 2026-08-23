import { LEADERS, LEADER_BY_ID } from '../state/mock'
import { state, say, addTyping, clearTyping, alliesOf } from '../state/store'
import { askLeader, type AskOptions } from './leaders'

/**
 * Offline fallbacks. Used when there is no API key, the request fails, or it
 * times out — the game must stay playable on a dead link. Plain statements a
 * government would actually issue, so a fallback never breaks the scene.
 */
const FALLBACK: Record<string, string[]> = {
  'United States of America': ['We are consulting our partners. Expect a coordinated response.', 'Our commitments to our allies stand.'],
  'Russia': ['Noted.', 'We will respond at a time of our choosing.'],
  'China': ['We urge all parties to exercise restraint.', 'Our position has not changed.'],
  'India': ['We are in contact with all sides.', 'We will not be drawn into a bloc.'],
  'Japan': ['We are consulting with our treaty partners.', 'Regional stability must be preserved.'],
  'Germany': ['There must be a proportionate and lawful response.', 'We are convening our partners.'],
  'France': ['France will decide its own line.', 'We stand with our allies. We will not be dictated to.'],
  'United Kingdom': ['We stand by our obligations.', 'We are reviewing the intelligence.'],
  'Brazil': ['We offer to mediate.', 'This is not our war. We would like to keep it that way.'],
  'Australia': ['We will stand with our allies.', 'Sea lanes must stay open.'],
  'Canada': ['We call for an immediate ceasefire and talks.', 'We are coordinating with the coalition.'],
  'Switzerland': ['Switzerland remains neutral. We can host talks.', 'No comment. The accounts are noted.'],
  'Israel': ['We will defend ourselves. By ourselves if necessary.', 'We do not comment on our capabilities.'],
}

function fallbackLine(id: string): string {
  const pool = FALLBACK[id] ?? ['…']
  return pool[state.messages.length % pool.length]
}

/** Shows a typing indicator, asks the model, then posts whatever came back. */
export async function leaderRespond(leaderId: string, channel: string, opts: AskOptions = {}): Promise<void> {
  if (!LEADER_BY_ID.has(leaderId)) return
  if (state.relations[leaderId] === 'destroyed') return

  addTyping(channel, leaderId)
  const started = Date.now()

  const { text, fallback } = await askLeader(leaderId, channel, opts)

  // a reply that lands instantly reads as canned; give it a beat
  const elapsed = Date.now() - started
  if (elapsed < 700) await new Promise(r => setTimeout(r, 700 - elapsed))

  clearTyping(leaderId)
  say(leaderId, channel, fallback || !text ? fallbackLine(leaderId) : text, 'said', opts.toId)
}

/** Someone in the room reacts to what just happened, in the global channel. */
export function someoneReacts(excludeIds: string[] = [], nudge?: string): void {
  const pool = LEADERS.filter(l =>
    l.id !== state.playerId &&
    !excludeIds.includes(l.id) &&
    state.relations[l.id] !== 'destroyed')
  if (!pool.length) return
  const pick = pool[Math.floor(Math.random() * pool.length)]
  void leaderRespond(pick.id, 'GLOBAL', { nudge })
}

/** One of your allies answers in the alliance channel. */
export function blocReacts(nudge?: string): void {
  const pool = state.bloc.filter(id => state.relations[id] !== 'destroyed' && alliesOf(state.playerId!).includes(id))
  if (!pool.length) return
  const pick = pool[Math.floor(Math.random() * pool.length)]
  void leaderRespond(pick, 'BLOC', { nudge })
}
