import { state, messagesFor } from '../state/store'
import { LEADER_BY_ID } from '../state/mock'

export interface AskResult {
  text: string
  fallback: boolean
}

/**
 * Ask one leader for their next line. The API key never reaches the browser —
 * this posts to our own /api/leader, which calls Featherless server-side.
 * Any failure returns fallback:true so the caller can use a canned line
 * and the game keeps playing.
 */
export async function askLeader(leaderId: string, channel: string): Promise<AskResult> {
  if (!state.playerId) return { text: '', fallback: true }

  const history = messagesFor(channel).slice(-10).map(m => ({
    who: m.from === 'SYSTEM' ? 'SYSTEM' : (LEADER_BY_ID.get(m.from)?.short ?? String(m.from)),
    text: m.text,
  }))

  try {
    const res = await fetch('/api/leader', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leaderId,
        playerId: state.playerId,
        channel,
        history,
        day: state.day,
        defcon: state.defcon,
        atWar: state.relations[leaderId] === 'war',
      }),
    })
    const data = await res.json() as { text?: string; fallback?: boolean }
    const text = (data.text ?? '').trim()
    return text ? { text, fallback: false } : { text: '', fallback: true }
  } catch {
    return { text: '', fallback: true }
  }
}
