import { ENDINGS, LEADER_BY_ID } from '../state/mock'
import { state, reset, goto } from '../state/store'
import { WORLD_POPULATION, formatPop, formatExact } from '../state/population'

const short = (id: string) => LEADER_BY_ID.get(id)?.short ?? id
const flags = (ids: string[]) => ids.map(id => LEADER_BY_ID.get(id)?.flag ?? '').join(' ')

/** The signed document: who pays what to whom, so the world can be put back. */
function treatySheet(): string {
  const t = state.treaty?.terms
  if (!t) return ''
  const wePay = state.playerId ? t.payer.includes(state.playerId) : false
  return `
  <div class="treaty-sheet">
    <div class="treaty-head">
      <span class="eyebrow">Treaty of ${short('Switzerland')} · day ${state.treaty?.day}</span>
      <h3>${wePay ? 'Your alliance pays' : 'Your alliance receives'}</h3>
      <p>${flags(t.payer)} <b>${t.payer.map(short).join(' · ')}</b> → ${flags(t.payee)} <b>${t.payee.map(short).join(' · ')}</b></p>
    </div>
    <div class="treaty-grid">
      <div><span class="eyebrow">Reconstruction</span><b>$${t.billions}B</b></div>
      <div><span class="eyebrow">Oil</span><b>${t.oilMillionBarrels}M</b><small>barrels</small></div>
      <div><span class="eyebrow">Grain</span><b>${t.grainMillionTonnes}M</b><small>tonnes</small></div>
      <div><span class="eyebrow">Over</span><b>${t.rebuildYears}</b><small>years</small></div>
    </div>
    <p class="treaty-note">${Math.round(t.deadByPayer / 1e6)}M killed by the paying side against ${Math.round(t.deadByPayee / 1e6)}M suffered. All strikes cease. Held territory returns to its people.</p>
  </div>`
}

export function renderEnding(): string {
  const e = ENDINGS[state.ending ?? 'forgotten']
  const me = state.playerId ? LEADER_BY_ID.get(state.playerId) : null

  const firstShot = Object.entries(state.relations).find(([, r]) => r === 'destroyed')?.[0]
  const funniest = [...state.messages].reverse().find(m => m.kind === 'said' && m.from !== state.playerId)

  return `
  <div class="screen ending">
    <div class="endcard ${e.tone}">
      <div class="endcard-top">
        <p class="eyebrow">${me ? `${me.flag} ${me.short}` : 'Head of state'} · ending ${Object.keys(ENDINGS).indexOf(e.id) + 1} of ${Object.keys(ENDINGS).length}</p>
        <h2>${e.title}</h2>
        <p class="verdict">${e.verdict}</p>
        <p class="blurb">${e.blurb}</p>
      </div>

      ${e.id === 'treaty' ? treatySheet() : ''}

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
        <span class="eyebrow">Last word in the room</span>
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
