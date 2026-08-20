import { state, reset, endGame } from '../state/store'
import { renderWorldMap, bindMapClicks, refreshMap } from '../components/worldMap'
import { renderHud } from '../components/statsHud'
import { renderActionBar, bindActionBar } from '../components/actionBar'
import { renderRail, bindRail, updateRail } from '../components/chatPanel'
import { ENDINGS } from '../state/mock'
import { formatPop, formatExact } from '../state/population'
import type { EndingId } from '../state/types'

/** The only part of the topbar that moves; swapped on its own during updates. */
function chips(): string {
  const hot = state.defcon <= 2 ? ' hot' : ''
  return `
    <span class="chip">Day <b>${state.day}</b></span>
    <span class="chip chip--defcon${hot}">Defcon <b>${state.defcon}</b></span>
    <span class="chip">Warheads used <b>${state.nukesLaunched}</b></span>
    <span class="chip chip--dead${state.deaths ? ' on' : ''}" title="${formatExact(state.deaths)} dead">
      Dead <b>${formatPop(state.deaths)}</b>
    </span>`
}

export function renderGame(): string {
  return `
  <div class="screen game">
    <header class="topbar">
      <span class="brand">WW3 <span>Simulator</span></span>
      <span class="chips">${chips()}</span>
      <span class="spacer"></span>
      <button class="btn" data-quit>Resign</button>
    </header>

    <div class="game-body">
      <section class="stage">
        ${renderHud()}
        ${renderWorldMap()}
        ${renderActionBar()}
      </section>
      ${renderRail()}
    </div>
  </div>

  <div class="devbar">
    <span class="eyebrow">Preview endings</span>
    ${Object.keys(ENDINGS).map(k => `<button data-end="${k}">${k}</button>`).join('')}
  </div>`
}

/**
 * Patch the screen in place. Re-rendering #app on every state change restarted
 * the .screen fade-in, which read as the whole page flashing on each message.
 * Only the regions that actually depend on state are rewritten here.
 */
export function updateGame(root: HTMLElement) {
  const bar = root.querySelector<HTMLElement>('.chips')
  if (bar) bar.innerHTML = chips()

  const hud = root.querySelector<HTMLElement>('.hud')
  if (hud) hud.outerHTML = renderHud()

  const shell = root.querySelector<HTMLElement>('#map-shell')
  if (shell) refreshMap(shell)

  updateRail(root)
}

export function bindGame(root: HTMLElement) {
  const shell = root.querySelector<HTMLElement>('#map-shell')
  if (shell) bindMapClicks(shell)
  bindActionBar(root)
  bindRail(root)
  root.querySelector<HTMLElement>('[data-quit]')?.addEventListener('click', () => reset())
  root.querySelectorAll<HTMLElement>('[data-end]').forEach(el =>
    el.addEventListener('click', () => endGame(el.dataset.end as EndingId)))
}
