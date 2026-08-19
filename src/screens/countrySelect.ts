import { LEADERS } from '../state/mock'
import { startGame, goto } from '../state/store'
import type { Leader } from '../state/types'

const bar = (label: string, v: number) =>
  `<div class="bar"><span>${label}</span><i><b style="width:${v}%"></b></i><span>${v}</span></div>`

const card = (l: Leader) => `
  <button class="card" data-pick="${l.id}">
    <div class="card-top">
      <span class="card-flag">${l.flag}</span>
      <div>
        <div class="card-name">${l.short}</div>
        <div class="card-leader">${l.leader}</div>
      </div>
    </div>
    <div class="card-doctrine">“${l.doctrine}”</div>
    <div class="card-persona">${l.persona}</div>
    <div class="bars">
      ${bar('Military', l.stats.military)}
      ${bar('Economy', l.stats.economy)}
      ${bar('Morale', l.stats.morale)}
      ${bar('Standing', l.stats.standing)}
    </div>
  </button>`

export function renderSelect(): string {
  return `
  <div class="screen select">
    <div class="select-head">
      <div>
        <p class="eyebrow">Step 01 — assume power</p>
        <h2>Pick a country</h2>
        <p>Your doctrine sets your opening stats. Everyone else becomes a problem.</p>
      </div>
      <button class="btn" data-go="splash">← Back</button>
    </div>
    <div class="select-grid">${LEADERS.map(card).join('')}</div>
  </div>`
}

export function bindSelect(root: HTMLElement) {
  root.querySelector<HTMLElement>('[data-go="splash"]')?.addEventListener('click', () => goto('splash'))
  root.querySelectorAll<HTMLElement>('[data-pick]').forEach(el =>
    el.addEventListener('click', () => startGame(el.dataset.pick!)))
}
