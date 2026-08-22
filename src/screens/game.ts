import { state, reset, endGame, bombsOf } from '../state/store'
import { INBOX } from '../components/chatPanel'
import { renderWorldMap, bindMapClicks, refreshMap } from '../components/worldMap'
import { renderHud, resetHudMemory, hudSignature } from '../components/statsHud'
import { renderActionBar, bindActionBar, actionBarSignature } from '../components/actionBar'
import { worldWarAlarm } from '../components/fx'
import { MAX_DAYS } from '../state/turn'
import { renderRail, bindRail, updateRail } from '../components/chatPanel'
import { ENDINGS } from '../state/mock'
import { formatPop, formatExact } from '../state/population'
import type { EndingId } from '../state/types'
import { arrowRight } from '../components/arrow'

/**
 * Whether the chat rail is on screen. Pure layout state: it lives here rather
 * than in the store because collapsing the chat is not a game event — nothing
 * about the war changes, so nothing else should re-render over it.
 */
let railOpen = true

/**
 * How many messages existed when the rail was collapsed. The store never marks
 * the open channel unread — it assumes you are reading it — which stops being
 * true the moment the rail is hidden, so those have to be counted from here.
 */
let seenAtCollapse = 0

/**
 * The guide: four short callouts over a blurred stage the first time the game
 * screen mounts in a run. Pure presentation — dismissing it changes nothing in
 * the store, so it lives here, like the rail toggle.
 */
const GUIDE = [
  { at: 'hud',    side: 'down',  text: 'Your country. Population and the four stats every order spends or earns.' },
  { at: 'map',    side: 'up',    text: 'The world. Every state has its own colour; yours is blue. Click one to talk to it.' },
  { at: 'orders', side: 'up',    text: 'Orders. Pick a target and a quarter, then act. End the day to let the world move.' },
  { at: 'chat',   side: 'left',  text: 'The room. Every other state is here, talking to you and to each other.' },
] as const

function renderGuide(): string {
  return `
  <div class="guide" data-guide>
    ${GUIDE.map(g => `
      <div class="callout callout--${g.at} callout--${g.side}">
        <span class="callout-arrow">${arrowRight()}</span>
        <p>${g.text}</p>
      </div>`).join('')}
    <button class="btn btn--primary guide-go" data-guide-go>Begin <span class="btn-arrow">${arrowRight()}</span></button>
  </div>`
}

/** Whether this run's WW3 alarm has already fired; reset on mount. */
let alarmed = false

/** Unread messages across every channel the player is not currently reading. */
function unreadTotal(): number {
  let n = 0
  for (const [ch, count] of Object.entries(state.unread)) {
    if (ch !== state.openChannel && ch !== INBOX) n += count ?? 0
  }
  if (!railOpen) {
    n += state.messages
      .slice(seenAtCollapse)
      .filter(m => m.channel === state.openChannel && m.from !== state.playerId).length
  }
  return n
}

/**
 * The rail toggle. When the chat is closed this badge is the only signal that
 * the room is still talking, so it must stay accurate while collapsed.
 */
function railToggle(): string {
  const n = unreadTotal()
  const badge = !railOpen && n ? `<span class="rail-badge">${n > 9 ? '9+' : n}</span>` : ''
  return `Chat <span class="toggle-arrow">${railOpen ? '⟩' : '⟨'}</span>${badge}`
}

/** The only part of the topbar that moves; swapped on its own during updates. */
function chips(): string {
  const hot = state.defcon <= 2 ? ' hot' : ''
  const bombs = state.playerId ? bombsOf(state.playerId) : 0
  return `
    <span class="chip">Day <b>${Math.min(state.day, MAX_DAYS)}</b> / ${MAX_DAYS}</span>
    ${state.worldWar ? '<span class="chip chip--ww3">WW3 <b>day ' + (state.day - state.worldWarDay + 1) + '</b></span>' : ''}
    <span class="chip chip--defcon${hot}">Defcon <b>${state.defcon}</b></span>
    <span class="chip" title="Warheads in the silo">Warheads <b>${bombs}</b></span>
    ${state.resolving ? '<span class="chip chip--resolving">Resolving<b>…</b></span>' : ''}
    <span class="chip chip--dead${state.deaths ? ' on' : ''}" title="${formatExact(state.deaths)} dead">
      Dead <b>${formatPop(state.deaths)}</b>
    </span>`
}

export function renderGame(): string {
  resetHudMemory()
  railOpen = true
  alarmed = false
  return `
  <div class="screen game is-guided">
    ${renderGuide()}
    <header class="topbar">
      <span class="brand">WW3 <span>Simulator</span></span>
      <span class="chips">${chips()}</span>
      <span class="spacer"></span>
      <button class="quit" data-quit>Resign</button>
      <button class="rail-toggle" data-rail-toggle aria-expanded="true"
        title="Show or hide the chat">${railToggle()}</button>
    </header>

    <div class="game-body${railOpen ? '' : ' rail-closed'}">
      <section class="stage">
        ${renderHud()}
        ${renderWorldMap()}
        ${renderActionBar()}
      </section>
      <div class="rail-slot">${renderRail()}</div>
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
  const chipBar = root.querySelector<HTMLElement>('.chips')
  if (chipBar) chipBar.innerHTML = chips()

  const hud = root.querySelector<HTMLElement>('.hud')
  if (hud && hudSignature() !== hud.dataset.sig) hud.outerHTML = renderHud()

  const shell = root.querySelector<HTMLElement>('#map-shell')
  if (shell) refreshMap(shell)

  const bar = root.querySelector<HTMLElement>('.actionbar')
  if (bar && bar.dataset.sig !== actionBarSignature()) {
    bar.outerHTML = renderActionBar()
    bindActionBar(root.querySelector<HTMLElement>('.actionbar')!)
  }

  if (state.worldWar && !alarmed) { alarmed = true; worldWarAlarm() }

  const toggle = root.querySelector<HTMLElement>('[data-rail-toggle]')
  if (toggle) toggle.innerHTML = railToggle()

  updateRail(root)
}

export function bindGame(root: HTMLElement) {
  const shell = root.querySelector<HTMLElement>('#map-shell')
  if (shell) bindMapClicks(shell)
  bindActionBar(root)
  bindRail(root)
  bindQuit(root)

  const toggle = root.querySelector<HTMLButtonElement>('[data-rail-toggle]')
  toggle?.addEventListener('click', () => {
    railOpen = !railOpen
    if (!railOpen) seenAtCollapse = state.messages.length
    root.querySelector('.game-body')?.classList.toggle('rail-closed', !railOpen)
    toggle.setAttribute('aria-expanded', String(railOpen))
    toggle.innerHTML = railToggle()
  })
  root.querySelectorAll<HTMLElement>('[data-end]').forEach(el =>
    el.addEventListener('click', () => endGame(el.dataset.end as EndingId)))

  root.querySelector<HTMLElement>('[data-guide-go]')?.addEventListener('click', () => {
    root.querySelector('.game')?.classList.remove('is-guided')
    root.querySelector('[data-guide]')?.remove()
  })
}

/**
 * Resign throws away the whole run, so it asks twice: the first click arms it
 * for three seconds, the second one goes through. Cheaper than a modal and
 * still impossible to hit by accident.
 */
function bindQuit(root: HTMLElement) {
  const btn = root.querySelector<HTMLButtonElement>('[data-quit]')
  if (!btn) return
  let timer: ReturnType<typeof setTimeout> | null = null

  btn.addEventListener('click', () => {
    if (btn.classList.contains('is-armed')) {
      if (timer) clearTimeout(timer)
      reset()
      return
    }
    btn.classList.add('is-armed')
    btn.textContent = 'Confirm resign?'
    timer = setTimeout(() => {
      btn.classList.remove('is-armed')
      btn.textContent = 'Resign'
    }, 3000)
  })
}
