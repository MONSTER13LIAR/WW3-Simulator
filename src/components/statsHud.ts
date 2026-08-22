import { state, me, livingIn } from '../state/store'
import { formatPop, formatExact } from '../state/population'

/**
 * Last value shown per stat, so a change can be flashed. The HUD node is
 * replaced wholesale on every update, which is exactly what makes this work:
 * the pulse class is only present on mount when the value moved, so the
 * animation plays once and only when there is something to notice.
 */
const last: Record<string, number> = {}

/** Called when the game screen mounts, so a new run doesn't pulse against the
    stats of the previous one. */
export function resetHudMemory() {
  for (const k of Object.keys(last)) delete last[k]
}

const cell = (label: string, v: number) => {
  const key = label.toLowerCase()
  const prev = last[key]
  const moved = prev !== undefined && prev !== v
    ? (v > prev ? ' went-up' : ' went-down')
    : ''
  last[key] = v
  const cls = v < 30 ? 'low' : v > 75 ? 'hi' : ''
  return `
  <div class="stat ${cls}">
    <span>${label}</span>
    <div class="stat-track"><i><b style="width:${v}%"></b></i><em class="stat-n${moved}">${v}</em></div>
  </div>`
}

/**
 * Fingerprint of everything the HUD shows. updateGame skips the re-render when
 * this hasn't moved — partly to save DOM churn on every chat message, but
 * mostly because replacing the node mid-pulse was erasing the pulse: an order
 * emits twice in one click (stats, then the announcement), and the second
 * render saw no change and swapped out the animating number.
 */
export function hudSignature(): string {
  const m = me()
  if (!m) return ''
  const s = state.stats
  return `${m.id}|${s.military}|${s.economy}|${s.morale}|${s.standing}|${livingIn(m.id)}`
}

export function renderHud(): string {
  const m = me()
  if (!m) return ''
  const s = state.stats
  return `
  <div class="hud" data-sig="${hudSignature()}">
    <div class="hud-self">
      <span class="card-flag">${m.flag}</span>
      <div><b>${m.short}</b><small>${m.id === 'United States of America' ? 'United States' : m.id}</small></div>
      <div class="hud-pop" title="${formatExact(livingIn(m.id))} alive">
        <span>Population</span>
        <b>${formatPop(livingIn(m.id))}</b>
      </div>
    </div>
    <div class="hud-stats">
      ${cell('Military', s.military)}
      ${cell('Economy', s.economy)}
      ${cell('Morale', s.morale)}
      ${cell('Standing', s.standing)}
    </div>
  </div>`
}
