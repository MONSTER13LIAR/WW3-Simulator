import { LEADERS } from '../state/mock'
import { startGame, goto } from '../state/store'
import { arrowRight, arrowLeft } from '../components/arrow'
import { POPULATION, WORLD_POPULATION, formatPop, formatExact } from '../state/population'
import { COLOURS, PLAYER_COLOUR } from '../components/worldMap'
import { startingBombs } from '../state/store'
import type { Leader } from '../state/types'

/** The population bar is scaled against the largest country, not against 100. */
const BIGGEST = Math.max(...Object.values(POPULATION))

const bar = (label: string, v: number) => `
  <div class="bar ${v >= 85 ? 'is-top' : v < 40 ? 'is-low' : ''}">
    <span>${label}</span>
    <i><b style="width:${v}%"></b></i>
    <span class="bar-n">${v}</span>
  </div>`

const card = (l: Leader, i: number) => `
  <button class="card" data-pick="${l.id}" style="--c:${COLOURS[l.id] ?? '#888'}">
    <div class="card-top">
      <span class="card-flag">${l.flag}</span>
      <div class="card-id">
        <div class="card-name">${l.short}</div>
        <div class="card-full">${l.id === 'United States of America' ? 'United States' : l.id}</div>
      </div>
      <span class="card-no">${String(i + 1).padStart(2, '0')}</span>
    </div>

    <div class="card-keys">
      <div><span>Population</span><b title="${formatExact(POPULATION[l.id])} people">${formatPop(POPULATION[l.id])}</b></div>
      <div><span>Warheads</span><b>${startingBombs(l.id)}</b></div>
      <div><span>Allies</span><b>0</b></div>
    </div>

    <div class="bars">
      <div class="bar bar--pop">
        <span>Population</span>
        <i><b style="width:${(POPULATION[l.id] / BIGGEST * 100).toFixed(1)}%"></b></i>
        <span class="bar-n">${(POPULATION[l.id] / WORLD_POPULATION * 100).toFixed(0)}%</span>
      </div>
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
        <p class="select-sub">Opening stats are the only edge you get. Everyone else is also playing.</p>
        <p class="select-key"><i style="background:${PLAYER_COLOUR}"></i> Your country is always this colour on the map</p>
      </div>

      <div class="select-head-side">
        <p class="eyebrow">${LEADERS.length} states · ${formatPop(WORLD_POPULATION)} people</p>
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
