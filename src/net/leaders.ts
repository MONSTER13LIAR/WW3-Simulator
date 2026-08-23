import { state, messagesFor, mem, alliesOf, livingIn } from '../state/store'
import { LEADER_BY_ID } from '../state/mock'
import { POPULATION } from '../state/population'

export interface AskResult {
  text: string
  fallback: boolean
}

export interface AskOptions {
  /** a direction for this one line: what just happened, what they should do about it */
  nudge?: string
  /** for intercepts: the leader this line is privately addressed to */
  toId?: string
}

const short = (id: string) => LEADER_BY_ID.get(id)?.short ?? id

/**
 * Everything the model needs to speak as a head of state who has been paying
 * attention: who they are allied with, who has struck whom, what they hold
 * against the player, and the shape of the war so far.
 */
function worldBrief(leaderId: string): string {
  const lines: string[] = []
  const allies = alliesOf(leaderId).map(short)
  lines.push(allies.length ? `Your allies: ${allies.join(', ')}.` : 'You have no formal allies.')
  const hits = state.strikes.filter(s => s.to === leaderId)
  if (hits.length) lines.push(`You have been struck by: ${[...new Set(hits.map(h => short(h.from)))].join(', ')}.`)
  const fired = state.strikes.filter(s => s.from === leaderId)
  if (fired.length) lines.push(`You have struck: ${[...new Set(fired.map(h => short(h.to)))].join(', ')}.`)
  const recent = state.strikes.slice(-4).map(s => `${short(s.from)} struck ${short(s.to)} (${s.region}, ${Math.round(s.dead / 1e6)}M dead)`)
  if (recent.length) lines.push(`Recent strikes: ${recent.join('; ')}.`)
  const lost = 1 - livingIn(leaderId) / (POPULATION[leaderId] || 1)
  if (lost > 0.05) lines.push(`Your country has lost ${Math.round(lost * 100)}% of its people.`)
  if (state.worldWar) lines.push('World War III is under way.')
  if (state.crisis) {
    const c = state.crisis
    lines.push(`The crisis began when ${short(c.aggressor)} struck ${short(c.victim)}. Sides: [${c.sides[0].map(short).join(', ')}] vs [${c.sides[1].map(short).join(', ')}].`)
  }
  return lines.join(' ')
}

/**
 * Ask one leader for their next line. The API key never reaches the browser —
 * this posts to our own /api/leader, which calls Featherless server-side.
 * Any failure returns fallback:true so the caller can use a canned line
 * and the game keeps playing.
 */
export async function askLeader(leaderId: string, channel: string, opts: AskOptions = {}): Promise<AskResult> {
  if (!state.playerId) return { text: '', fallback: true }

  const history = messagesFor(channel).slice(-12).map(m => ({
    who: m.from === 'SYSTEM' ? 'SYSTEM' : (LEADER_BY_ID.get(m.from)?.short ?? String(m.from)),
    text: m.text,
  }))
  const m = mem(leaderId)

  try {
    const res = await fetch('/api/leader', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // a hung request must not hold the world ticker's busy flag forever
      signal: AbortSignal.timeout(12_000),
      body: JSON.stringify({
        leaderId,
        playerId: state.playerId,
        channel,
        history,
        day: state.day,
        defcon: state.defcon,
        atWar: state.relations[leaderId] === 'war',
        trust: m.trust,
        grudges: m.grudges.slice(-4).map(g => g.note),
        playerAllied: alliesOf(leaderId).includes(state.playerId),
        bloc: channel === 'BLOC' ? state.bloc.map(short) : [],
        brief: worldBrief(leaderId),
        nudge: opts.nudge,
        toId: opts.toId,
      }),
    })
    const data = await res.json() as { text?: string; fallback?: boolean }
    const text = (data.text ?? '').trim()
    return text ? { text, fallback: false } : { text: '', fallback: true }
  } catch {
    return { text: '', fallback: true }
  }
}
