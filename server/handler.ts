import { leaderReply, type LeaderTurn } from './featherless.js'

/** Crude per-IP token bucket so a demo that goes around doesn't drain the account. */
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 60
const buckets = new Map<string, { n: number; reset: number }>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const b = buckets.get(ip)
  if (!b || now > b.reset) {
    buckets.set(ip, { n: 1, reset: now + WINDOW_MS })
    return false
  }
  b.n++
  return b.n > MAX_PER_WINDOW
}

export interface HandlerResult {
  status: number
  body: unknown
}

const str = (v: unknown, max = 600) => typeof v === 'string' ? v.slice(0, max) : undefined
const strs = (v: unknown, n = 8) => Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, n) as string[] : []

export async function handleLeader(
  raw: unknown,
  ip: string,
  env: { FEATHERLESS_API_KEY?: string; FEATHERLESS_MODEL?: string },
): Promise<HandlerResult> {
  if (rateLimited(ip)) {
    return { status: 429, body: { error: 'rate_limited', text: '', fallback: true } }
  }

  const t = raw as Partial<LeaderTurn>
  if (!t || typeof t.leaderId !== 'string' || typeof t.playerId !== 'string') {
    return { status: 400, body: { error: 'bad_request', text: '', fallback: true } }
  }

  const turn: LeaderTurn = {
    leaderId: t.leaderId,
    playerId: t.playerId,
    channel: typeof t.channel === 'string' ? t.channel : 'GLOBAL',
    history: Array.isArray(t.history) ? t.history.slice(-12) : [],
    day: Number(t.day) || 1,
    defcon: Number(t.defcon) || 5,
    atWar: Boolean(t.atWar),
    trust: Number(t.trust) || 0,
    grudges: strs(t.grudges),
    playerAllied: Boolean(t.playerAllied),
    bloc: strs(t.bloc),
    brief: str(t.brief, 1200) ?? '',
    nudge: str(t.nudge),
    toId: str(t.toId, 80),
  }

  const reply = await leaderReply(turn, env)
  return { status: 200, body: reply }
}
