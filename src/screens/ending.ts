import { ENDINGS, LEADER_BY_ID } from '../state/mock'
import { state, reset, goto } from '../state/store'
import { WORLD_POPULATION, formatPop, formatExact } from '../state/population'

export function renderEnding(): string {
  const e = ENDINGS[state.ending ?? 'forgotten']
  const me = state.playerId ? LEADER_BY_ID.get(state.playerId) : null

  const firstShot = Object.entries(state.relations).find(([, r]) => r === 'destroyed')?.[0]
  const funniest = [...state.messages].reverse().find(m => m.kind === 'said' && m.from !== state.playerId)

  return `
  <div class="screen ending">
    <div class="endcard ${e.tone}">
      <div class="endcard-top">
        <p class="eyebrow">${me ? `${me.flag} ${me.leader}` : 'Head of state'} · ending ${Object.keys(ENDINGS).indexOf(e.id) + 1} of 8</p>
        <h2>${e.title}</h2>
        <p class="verdict">${e.verdict}</p>
        <p class="blurb">${e.blurb}</p>
      </div>

      <div class="endcard-grid">
        <div><span class="eyebrow">Days survived</span><b>${state.day}</b></div>
        <div><span class="eyebrow">Warheads used</span><b>${state.nukesLaunched}</b></div>
        <div><span class="eyebrow">Final defcon</span><b>${state.defcon}</b></div>
        <div><span class="eyebrow">First to fall</span><b>${firstShot ? (LEADER_BY_ID.get(firstShot)?.flag ?? '—') : '—'}</b></div>
      </div>

      <div class="endcard-toll" title="${formatExact(state.deaths)} dead">
        <span class="eyebrow">People killed</span>
        <b>${formatPop(state.deaths)}</b>
        <small>${((state.deaths / WORLD_POPULATION) * 100).toFixed(1)}% of everyone who was alive when you took office</small>
      </div>

      <div class="endcard-quote">
        <span class="eyebrow">Dumbest reason for war</span>
        <q>${funniest ? funniest.text : 'Nobody said anything. That was the problem.'}</q>
      </div>

      <div class="endcard-foot">
        <button class="btn btn--primary" data-again>Run it back</button>
        <button class="btn" data-home>Title screen</button>
      </div>
    </div>
  </div>`
}

export function bindEnding(root: HTMLElement) {
  root.querySelector<HTMLElement>('[data-again]')?.addEventListener('click', () => goto('select'))
  root.querySelector<HTMLElement>('[data-home]')?.addEventListener('click', () => reset())
}
