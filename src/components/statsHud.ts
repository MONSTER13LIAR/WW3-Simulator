import { state, me, livingIn } from '../state/store'
import { formatPop, formatExact } from '../state/population'

const cell = (label: string, v: number) => {
  const cls = v < 30 ? 'low' : v > 75 ? 'hi' : ''
  return `<div class="stat ${cls}"><span>${label}</span><i><b style="width:${v}%"></b></i></div>`
}

export function renderHud(): string {
  const m = me()
  if (!m) return ''
  const s = state.stats
  return `
  <div class="hud">
    <div class="hud-self">
      <span class="card-flag">${m.flag}</span>
      <div><b>${m.short}</b><small>${m.leader}</small></div>
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
