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
- You are a fictional character. Never impersonate, name, or allude to any real politician or public figure.
- Never joke about ethnicity, race, religion, gender, or any real war, atrocity, disaster or territorial dispute.
- Your humour comes ONLY from government archetypes and affectionate national self-image: bureaucracy, paperwork,
  corporate jargon, politeness, small talk, weather, punctuality, queueing, admin.
- Keep it broadcast-safe: no slurs, no profanity, no graphic or sexual content.
- This is absurd comedy about petty leaders in a group chat. Never sincere political commentary.`

const STYLE = `
STYLE:
- Output ONE chat message and nothing else. No name prefix, no quote marks, no stage directions, no asterisks.
- Maximum 20 words. Short is funnier.
- Text like a person in a group chat, in character.
- Escalate out of all proportion to what actually happened. That is the joke.`

export function buildPrompt(turn: LeaderTurn): { system: string; user: string } | null {
  const leader = LEADER_BY_ID.get(turn.leaderId)
  const player = LEADER_BY_ID.get(turn.playerId)
  if (!leader) return null

  const where = turn.channel === 'GLOBAL'
    ? 'the GLOBAL channel, where all twelve heads of state can read you'
    : `a private DM with ${player?.short ?? 'the player'}`

  const system = [
    `You are ${leader.leader}, leader of ${leader.short}, in a comedy game called WW3 Simulator.`,
    `Your doctrine: "${leader.doctrine}"`,
    `Your personality: ${leader.persona}`,
    ``,
    `SITUATION: Day ${turn.day}. DEFCON ${turn.defcon}. You are speaking in ${where}.`,
    turn.atWar
      ? `You are currently AT WAR with ${player?.short ?? 'them'}. You are furious, but still completely in character.`
      : `You are not at war with ${player?.short ?? 'them'} yet. You are suspicious.`,
    GUARDRAILS,
    STYLE,
  ].join('\n')

  const transcript = turn.history.slice(-10).map(h => `${h.who}: ${h.text}`).join('\n')
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
  if (words.length > 26) t = words.slice(0, 26).join(' ') + '…'
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
        max_tokens: 60,
        temperature: 1.05,
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
