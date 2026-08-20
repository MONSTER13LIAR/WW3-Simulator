import { LEADERS, LEADER_BY_ID } from '../state/mock'
import { state, say, setTyping } from '../state/store'
import { askLeader } from './leaders'

/**
 * Offline fallbacks. Used when there is no API key, the request fails, or it
 * times out — the game must stay playable on a dead link.
 */
const FALLBACK: Record<string, string[]> = {
  'France': ['I am choosing to interpret that as an insult.', 'I have left the alliance. I have rejoined. I am leaving again.'],
  'Russia': ['no', '.', 'we will see'],
  'Japan': ['I am so sorry to hear that. The fleet is already moving.', 'Thank you for your message. Please evacuate the coast.'],
  'Germany': ['That response was not submitted in the approved format.', 'I am escalating this to Annex 7.'],
  'United Kingdom': ['Ah. Right. Lovely.', 'No worries if not! (I have sunk your navy.)'],
  'Switzerland': ['I have no opinion. Your account balance, however, does.', 'Neutral. Watching. Charging interest.'],
  'Australia': ['yeah nah', 'sorry mate the bird’s back'],
  'Canada': ['sorry — did I do something? sorry', 'okay. okay. that’s fine. that is completely fine.'],
  'India': ['Kindly do the needful.', 'Forwarded to all 14 groups 🙏'],
  'China': ['A rail link now connects our capitals. It was not requested.', 'Completed ahead of schedule.'],
  'Brazil': ['come over, bring the tanks', 'this is a great energy honestly'],
  'United States of America': ['Love this for us! Circling back post-detonation.', 'Let’s take this to a working group.'],
}

function fallbackLine(id: string): string {
  const pool = FALLBACK[id] ?? ['…']
  return pool[state.messages.length % pool.length]
}

/** Shows a typing indicator, asks the model, then posts whatever came back. */
export async function leaderRespond(leaderId: string, channel: string): Promise<void> {
  if (!LEADER_BY_ID.has(leaderId)) return

  setTyping({ channel, leaderId })
  const started = Date.now()

  const { text, fallback } = await askLeader(leaderId, channel)

  // a reply that lands instantly reads as canned; give it a beat
  const elapsed = Date.now() - started
  if (elapsed < 600) await new Promise(r => setTimeout(r, 600 - elapsed))

  setTyping(null)
  say(leaderId, channel, fallback || !text ? fallbackLine(leaderId) : text)
}

/** Someone in the room reacts to what just happened, in the global channel. */
export function someoneReacts(excludeIds: string[] = []): void {
  const pool = LEADERS.filter(l =>
    l.id !== state.playerId &&
    !excludeIds.includes(l.id) &&
    state.relations[l.id] !== 'destroyed')
  if (!pool.length) return
  const pick = pool[Math.floor(Math.random() * pool.length)]
  void leaderRespond(pick.id, 'GLOBAL')
}
