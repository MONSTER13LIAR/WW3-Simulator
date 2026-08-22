import { state, subscribe, startGame } from './store'
import type { GameState } from './types'

const KEY = 'ww3.save.v1'

/** Everything that is the game. Not the transient bits: typing, resolving. */
const FIELDS: Array<keyof GameState> = [
  'screen', 'day', 'defcon', 'playerId', 'relations', 'memory', 'messages', 'openChannel', 'unread',
  'stats', 'nukesLaunched', 'worldNukes', 'population', 'deaths', 'bombs', 'owner', 'alliances',
  'strikes', 'worldWar', 'worldWarDay', 'targetRegion', 'phase', 'crisis', 'bloc', 'treaty',
  'playerDestroyed', 'playerMessages', 'ending',
]

let timer: ReturnType<typeof setTimeout> | null = null

function save() {
  try {
    if (state.screen !== 'game' || state.ending) { localStorage.removeItem(KEY); return }
    const out: Partial<GameState> = {}
    for (const k of FIELDS) (out as Record<string, unknown>)[k] = state[k]
    localStorage.setItem(KEY, JSON.stringify(out))
  } catch { /* storage full or blocked — the game still plays */ }
}

/** Write the run to localStorage a beat after every change, so a refresh lands back in it. */
export function startPersisting() {
  subscribe(() => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(save, 250)
  })
}

/**
 * Put a saved run back. A run mid-opening cannot be resumed — the argument was
 * an async sequence that died with the tab — so that one restarts from the
 * guide with the same country. A run in play resumes exactly where it was.
 */
export function restore(): boolean {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return false
    const saved = JSON.parse(raw) as Partial<GameState>
    if (saved.screen !== 'game' || !saved.playerId || saved.ending) return false
    if (saved.phase !== 'play') { startGame(saved.playerId); return true }
    Object.assign(state, saved)
    state.typing = []
    state.resolving = false
    return true
  } catch {
    return false
  }
}
