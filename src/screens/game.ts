import { state, reset, endGame } from '../state/store'
import { renderWorldMap, bindMapClicks } from '../components/worldMap'
import { renderHud } from '../components/statsHud'
import { renderActionBar, bindActionBar } from '../components/actionBar'
import { renderRail, bindRail } from '../components/chatPanel'
import { ENDINGS } from '../state/mock'
import type { EndingId } from '../state/types'

export function renderGame(): string {
  const hot = state.defcon <= 2 ? ' hot' : ''
  return `
  <div class="screen game">
    <header class="topbar">
      <span class="brand">WW3 <span>Simulator</span></span>
      <span class="chip">Day <b>${state.day}</b></span>
      <span class="chip chip--defcon${hot}">Defcon <b>${state.defcon}</b></span>
      <span class="chip">Warheads used <b>${state.nukesLaunched}</b></span>
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

export function bindGame(root: HTMLElement) {
  const shell = root.querySelector<HTMLElement>('#map-shell')
  if (shell) bindMapClicks(shell)
  bindActionBar(root)
  bindRail(root)
  root.querySelector<HTMLElement>('[data-quit]')?.addEventListener('click', () => reset())
  root.querySelectorAll<HTMLElement>('[data-end]').forEach(el =>
    el.addEventListener('click', () => endGame(el.dataset.end as EndingId)))
}
