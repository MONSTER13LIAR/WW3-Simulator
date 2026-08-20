import { LEADERS } from '../state/mock'
import { startGame, goto } from '../state/store'
import { arrowRight, arrowLeft } from '../components/arrow'
import type { Leader } from '../state/types'

const bar = (label: string, v: number) => `
  <div class="bar">
    <span>${label}</span>
    <i><b style="width:${v}%"></b></i>
    <span class="bar-n">${v}</span>
  </div>`

const card = (l: Leader, i: number) => `
  <button class="card" data-pick="${l.id}">
    <div class="card-top">
      <span class="card-flag">${l.flag}</span>
      <div class="card-id">
        <div class="card-name">${l.short}</div>
        <div class="card-leader">${l.leader}</div>
      </div>
      <span class="card-no">${String(i + 1).padStart(2, '0')}</span>
    </div>

    <p class="card-doctrine">${l.doctrine}</p>
    <p class="card-persona">${l.persona}</p>

    <div class="bars">
      ${bar('Military', l.stats.military)}
      ${bar('Economy', l.stats.economy)}
      ${bar('Morale', l.stats.morale)}
      ${bar('Standing', l.stats.standing)}
    </div>

    <span class="card-go">
      Take office
      <span class="btn-arrow">${arrowRight()}</span>
    </span>
  </button>`

export function renderSelect(): string {
  return `
  <div class="screen select">
    <header class="select-head">
      <div class="select-title">
        <p class="eyebrow">Step 01 — assume power</p>
        <h2>Pick a country</h2>
        <p class="select-sub">Your doctrine sets your opening stats. Everyone else becomes a problem.</p>
      </div>

      <div class="select-head-side">
        <p class="eyebrow">${LEADERS.length} heads of state</p>
        <button class="btn btn--go btn--back" data-go="splash">
          <span class="btn-arrow">${arrowLeft()}</span>
          Back
        </button>
      </div>
    </header>

    <div class="select-grid">${LEADERS.map(card).join('')}</div>
  </div>`
}

export function bindSelect(root: HTMLElement) {
  root.querySelector<HTMLElement>('[data-go="splash"]')?.addEventListener('click', () => goto('splash'))
  root.querySelectorAll<HTMLElement>('[data-pick]').forEach(el =>
    el.addEventListener('click', () => startGame(el.dataset.pick!)))
}
