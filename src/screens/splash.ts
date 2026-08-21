import { goto } from '../state/store'
import { dotType } from '../components/dotType'
import { arrowRight } from '../components/arrow'
import { pillar } from '../components/pillar'

export function renderSplash(): string {
  return `
  <div class="screen splash">
    ${pillar('left')}
    ${pillar('right')}

    <main class="splash-stage">
      <div class="wordmark">
        ${dotType('WW3', { className: 'wordmark-1', tracking: 2, flagGlyphs: [0, 1, 2] })}
        ${dotType('SIMULATOR', { className: 'wordmark-2', delayOffset: 240 })}
      </div>

      <p class="splash-line">Twelve heads of state. One group chat. Eight ways it ends.</p>

      <div class="splash-actions">
        <button class="btn btn--primary btn--go" data-go="select">
          Start Game<span class="btn-arrow" aria-hidden="true">${arrowRight()}</span>
        </button>
        <button class="btn btn--go" data-go="howto">
          Learn how to play<span class="btn-arrow" aria-hidden="true">${arrowRight()}</span>
        </button>
      </div>
    </main>

    <div class="warn-anchor">
      <button class="warn-btn" data-warn-open aria-haspopup="dialog">
        <span class="warn-glyph" aria-hidden="true">!</span>
        Disclaimer
      </button>
      <span class="warn-bubble" aria-hidden="true">check it out!</span>
    </div>

    <div class="overlay" data-overlay hidden>
      <div class="overlay-scrim" data-warn-close></div>
      <div class="overlay-panel" role="dialog" aria-modal="true" aria-labelledby="warn-title">
        <header class="overlay-head">
          <span class="warn-glyph warn-glyph--lg" aria-hidden="true">!</span>
          <h2 id="warn-title">Before you play</h2>
          <button class="overlay-x" data-warn-close aria-label="Close">&times;</button>
        </header>

        <div class="overlay-body">
          <p>
            <strong>This is satire.</strong> Every leader here is a fictional character. The national
            personalities are affectionate jokes about bureaucracy, small talk, paperwork and corporate
            speak &mdash; nothing else.
          </p>
          <p>
            No real politician, ethnicity, religion or real-world conflict is depicted. If a country is
            rude to you in this game, it is a bit. Please take it as one.
          </p>
          <p class="overlay-fine">
            The game contains fictional depictions of war and nuclear escalation, played for absurdity.
          </p>
        </div>

        <footer class="overlay-foot">
          <button class="btn btn--primary" data-warn-close>Understood</button>
        </footer>
      </div>
    </div>
  </div>`
}

export function bindSplash(root: HTMLElement) {
  root.querySelector<HTMLElement>('[data-go="select"]')
    ?.addEventListener('click', () => goto('select'))

  // "Learn how to play" is UI-only for now — no screen behind it yet.

  const overlay = root.querySelector<HTMLElement>('[data-overlay]')!
  const opener = root.querySelector<HTMLButtonElement>('[data-warn-open]')!

  function open() {
    overlay.hidden = false
    // Next frame, so the transition has a closed state to animate away from.
    requestAnimationFrame(() => overlay.classList.add('is-open'))
    overlay.querySelector<HTMLButtonElement>('.btn--primary')?.focus()
    document.addEventListener('keydown', onKey)
  }

  function close() {
    overlay.classList.remove('is-open')
    document.removeEventListener('keydown', onKey)
    opener.focus()
    // Wait out the fade before pulling it from the a11y tree.
    setTimeout(() => { if (!overlay.classList.contains('is-open')) overlay.hidden = true }, 220)
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') close()
  }

  opener.addEventListener('click', open)
  root.querySelectorAll<HTMLElement>('[data-warn-close]')
    .forEach(el => el.addEventListener('click', close))
}
