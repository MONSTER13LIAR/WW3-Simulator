import { LEADER_BY_ID } from '../src/state/mock'

export interface LeaderTurn {
  /** country id of the leader who should speak */
  leaderId: string
  /** 'GLOBAL' or a country id (a DM thread) */
  channel: string
  /** country id the human is playing */
  playerId: string
  /** recent lines, oldest first */
  history: Array<{ who: string; text: string }>
  day: number
  defcon: number
  atWar: boolean
  /** -100..100, what this leader thinks of the player */
  trust: number
  /** what they hold against the player, newest last */
  grudges: string[]
  /** the player is in a formal alliance with this leader */
  playerAllied: boolean
  /** members of the alliance channel, when speaking in it */
  bloc: string[]
  /** the state of the world, as this leader knows it */
  brief: string
  /** a direction for this one line */
  nudge?: string
  /** intercept: the leader this is privately addressed to */
  toId?: string
}

export interface LeaderReply {
  text: string
  model: string
  /** true when this came from the offline fallback rather than the model */
  fallback: boolean
}

const API = 'https://api.featherless.ai/v1/chat/completions'
const DEFAULT_MODEL = 'Qwen/Qwen3-30B-A3B-Instruct-2507'

/**
 * Non-negotiable guardrails. This project gets reviewed on YouTube, so the
 * comedy stays on government archetypes and pop-culture national self-image.
 */
const GUARDRAILS = `
HARD RULES — these override everything else:
- You are a fictional head of state. Never impersonate, name, or allude to any real politician or public figure.
- Never reference real wars, atrocities, disasters or territorial disputes. Never joke about ethnicity, race, religion or gender.
- Keep it broadcast-safe: no slurs, no profanity, no graphic content.
- National character may colour HOW you speak — formality, bluntness, warmth — never WHAT you decide. No caricature, no catchphrases, no national-cliché jokes.`

const STYLE = `
STYLE:
- Output ONE chat message and nothing else. No name prefix, no quotes, no stage directions, no asterisks, no emoji.
- 8 to 35 words. Speak like a head of state in a secure group chat during a crisis: direct, specific, consequential.
- ALWAYS answer the substance of the last message aimed at you before anything else. Never deflect with a quip.
- Refer to states by their short names (USA, RUS, CHN...). Name who you mean.
- Take positions. Demand, warn, offer, refuse, commit. Every line should move the situation.`

export function buildPrompt(turn: LeaderTurn): { system: string; user: string } | null {
  const leader = LEADER_BY_ID.get(turn.leaderId)
  const player = LEADER_BY_ID.get(turn.playerId)
  if (!leader) return null
  const p = player?.short ?? 'the player'

  const where = turn.toId
    ? `a PRIVATE message to ${LEADER_BY_ID.get(turn.toId)?.short ?? turn.toId} about ${p}, who cannot read it`
    : turn.channel === 'GLOBAL' ? `the GLOBAL channel, where every head of state reads you`
    : turn.channel === 'BLOC' ? `your ALLIANCE channel (${turn.bloc.join(', ')}) — coordinate with your allies here; ${p} is one of them`
    : `a private DM with ${p}`

  const stance = turn.playerAllied ? `${p} is your formal ally.`
    : turn.atWar ? `You are AT WAR with ${p}.`
    : turn.trust <= -30 ? `You deeply distrust ${p}.`
    : turn.trust >= 30 ? `You are on good terms with ${p}.`
    : `You have no settled view of ${p} yet.`

  const system = [
    `You are the head of state of ${leader.short} (${leader.id}) in WW3 Simulator, a simulation of a world sliding into a third world war.`,
    `Public stance: "${leader.doctrine}"`,
    `How your government behaves: ${leader.persona}`,
    ``,
    `SITUATION: Day ${turn.day}. DEFCON ${turn.defcon}. You are speaking in ${where}.`,
    stance,
    turn.grudges.length ? `What you hold against ${p}: ${turn.grudges.join('; ')}.` : '',
    turn.brief ? `WORLD: ${turn.brief}` : '',
    turn.nudge ? `RIGHT NOW: ${turn.nudge}` : '',
    GUARDRAILS,
    STYLE,
  ].filter(Boolean).join('\n')

  const transcript = turn.history.slice(-12).map(h => `${h.who}: ${h.text}`).join('\n')
  const user = `Recent messages:\n${transcript || '(nothing yet)'}\n\nWrite your next message as ${leader.short}.`

  return { system, user }
}

/** Strips the wrappers small models like to add despite being told not to. */
export function clean(raw: string, short: string): string {
  let t = (raw || '').trim()
  t = t.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  t = t.replace(new RegExp(`^\\s*(${short}|[A-Z]{2,4})\\s*[:>-]\\s*`, 'i'), '')
  t = t.replace(/^["“'']|["”'']$/g, '')
  t = t.replace(/^\*+|\*+$/g, '')
  t = t.split('\n').map(s => s.trim()).filter(Boolean)[0] ?? ''
  const words = t.split(/\s+/)
  if (words.length > 40) t = words.slice(0, 40).join(' ') + '…'
  return t.trim()
}

export async function leaderReply(
  turn: LeaderTurn,
  env: { FEATHERLESS_API_KEY?: string; FEATHERLESS_MODEL?: string },
): Promise<LeaderReply> {
  const leader = LEADER_BY_ID.get(turn.leaderId)
  const model = env.FEATHERLESS_MODEL || DEFAULT_MODEL

  const built = buildPrompt(turn)
  if (!built || !env.FEATHERLESS_API_KEY) {
    return { text: '', model, fallback: true }
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 12_000)

  try {
    const res = await fetch(API, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Authorization': `Bearer ${env.FEATHERLESS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 90,
        temperature: 0.85,
        top_p: 0.95,
        messages: [
          { role: 'system', content: built.system },
          { role: 'user', content: built.user },
        ],
      }),
    })

    if (!res.ok) {
      console.error('[featherless]', res.status, (await res.text()).slice(0, 200))
      return { text: '', model, fallback: true }
    }

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    const text = clean(data.choices?.[0]?.message?.content ?? '', leader?.short ?? '')
    return text ? { text, model, fallback: false } : { text: '', model, fallback: true }
  } catch (err) {
    console.error('[featherless]', (err as Error).message)
    return { text: '', model, fallback: true }
  } finally {
    clearTimeout(timer)
  }
}
