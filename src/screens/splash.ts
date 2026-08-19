import { goto } from '../state/store'

export function renderSplash(): string {
  return `
  <div class="screen splash">
    <div class="splash-main">
      <p class="eyebrow">A world war simulator · 12 heads of state · 1 group chat</p>

      <h1>Left<br/>On <em>Read</em></h1>

      <p class="splash-sub">
        You are the head of state. So are eleven others, and none of them are well.
        Talk, threaten, ally, betray — <strong>every other leader is an AI with a temper and a
        long memory.</strong> Most world wars here start over a message nobody answered.
      </p>

      <div class="splash-actions">
        <button class="btn btn--primary" data-go="select">Take office →</button>
        <span class="eyebrow">8 endings · none of them good for you</span>
      </div>
    </div>

    <div class="splash-meta">
      <div class="disclaimer">
        <b>Before you play.</b> This is satire. Every leader here is a fictional character, and the
        national personalities are affectionate jokes about bureaucracy, small talk, paperwork and
        corporate speak — nothing else. No real politician, ethnicity, religion or real-world conflict
        is depicted. If a country is rude to you in this game, it is a bit. Please take it as one.
      </div>
    </div>
  </div>`
}

export function bindSplash(root: HTMLElement) {
  root.querySelector<HTMLElement>('[data-go="select"]')?.addEventListener('click', () => goto('select'))
}
