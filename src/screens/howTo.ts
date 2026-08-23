import { goto } from '../state/store'
import { LEADERS, ENDINGS } from '../state/mock'
import { arrowRight, arrowLeft } from '../components/arrow'

/**
 * The basic guide. Everything here is read off the real mechanics — the orders
 * are the ones in actionBar, the stats are the ones the HUD tracks — so the
 * page cannot quietly drift out of date while the game changes underneath it.
 */

const ORDERS = [
  ['Diplomacy', 'Opens your inbox so you can talk to someone directly.', ''],
  ['Propose alliance', 'Signs a bloc with whoever you are talking to.', 'Standing, morale'],
  ['Sanction', 'Punishes a rival. They will not take it well.', 'Costs economy and standing, drops DEFCON'],
  ['Mobilise', 'Puts your forces on the board.', 'Military up, economy and morale down, drops DEFCON'],
  ['Propaganda', 'Tells your people things are going great.', 'Morale up, standing down'],
  ['End day', 'Passes the turn. The world keeps moving without you.', ''],
  ['Launch', 'A warhead. It kills a share of a real population and removes that state from the game.', 'Wrecks standing, morale and economy'],
] as const

const STATS = [
  ['Military', 'What you can threaten with.'],
  ['Economy', 'What you can afford. Sanctions and mobilising both eat it.'],
  ['Morale', 'Whether your own people are still with you.'],
  ['Standing', 'What everyone else thinks of you. The hardest one to get back.'],
] as const

const step = (n: number, title: string, body: string) => `
  <li class="step">
    <span class="step-n">${String(n).padStart(2, '0')}</span>
    <div>
      <h3>${title}</h3>
      <p>${body}</p>
    </div>
  </li>`

export function renderHowTo(): string {
  const endings = Object.values(ENDINGS)

  return `
  <div class="screen howto">
    <header class="select-head">
      <div class="select-title">
        <p class="eyebrow">How to play</p>
        <h2>The basics</h2>
        <p class="select-sub">A group chat with ${LEADERS.length} heads of state. You are one of them.</p>
      </div>

      <div class="select-head-side">
        <p class="eyebrow">${endings.length} endings</p>
        <button class="btn btn--go btn--back" data-go="splash">
          <span class="btn-arrow">${arrowLeft()}</span>
          Back
        </button>
      </div>
    </header>

    <div class="howto-body">
      <section class="howto-block">
        <p class="eyebrow">The loop</p>
        <ol class="steps">
          ${step(1, 'Take office', 'Pick one of the ' + LEADERS.length + ' states. Your doctrine sets your opening stats — nobody starts equal.')}
          ${step(2, 'Talk', 'Everything happens in the chat. Post in GLOBAL so all twelve see it, or open a DM and work someone privately. They remember what you said.')}
          ${step(3, 'Give orders', 'The bar along the bottom is what you can actually do. Every order moves your stats and the room reacts to it.')}
          ${step(4, 'End the day', 'Time only moves when you say so. Then it happens again, with worse tempers.')}
        </ol>
      </section>

      <section class="howto-block">
        <p class="eyebrow">Your orders</p>
        <table class="howto-table">
          <tbody>
            ${ORDERS.map(([name, what, cost]) => `
              <tr${name === 'Launch' ? ' class="is-nuke"' : ''}>
                <th>${name}</th>
                <td>${what}</td>
                <td class="howto-cost">${cost}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </section>

      <section class="howto-block">
        <p class="eyebrow">What you are juggling</p>
        <dl class="howto-defs">
          ${STATS.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}
          <div>
            <dt>DEFCON</dt>
            <dd>Starts at 5 and only falls. Sanctioning and mobilising push it down; a launch puts it straight to 1.</dd>
          </div>
          <div>
            <dt>Population</dt>
            <dd>Real numbers. A warhead kills a share of the people actually living there, and the death toll is the one figure you cannot argue with.</dd>
          </div>
        </dl>
      </section>

      <section class="howto-block">
        <p class="eyebrow">How it ends</p>
        <p class="howto-note">
          There are ${endings.length} endings and you will not see them coming. Some are won, some are
          survived, and one of them is simply being ignored for the entire war.
        </p>
        <ul class="howto-endings">
          ${endings.map(e => `<li class="tone-${e.tone}">${e.title}</li>`).join('')}
        </ul>
      </section>

      <div class="howto-go">
        <button class="btn btn--primary btn--go" data-go="select">
          Take office<span class="btn-arrow" aria-hidden="true">${arrowRight()}</span>
        </button>
      </div>
    </div>
  </div>`
}

export function bindHowTo(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-go]').forEach(el =>
    el.addEventListener('click', () => goto(el.dataset.go as 'splash' | 'select')))
}
