import { LEADERS, LEADER_BY_ID } from '../state/mock'
import { state, messagesFor, openChannel, say, emit } from '../state/store'
import type { ChatMsg } from '../state/types'

export const INBOX = 'INBOX'

/** Placeholder retorts. Replaced by Featherless persona calls in the next pass. */
const RETORTS: Record<string, string[]> = {
  'France': ['I am choosing to interpret that as an insult.', 'I have left the alliance. I have rejoined. I am leaving again.'],
  'Russia': ['no', '.', 'we will see'],
  'Japan': ['I am so sorry to hear that. The fleet is already moving.', 'Thank you for your message. Please evacuate the coast.'],
  'Germany': ['That response was not submitted in the approved format.', 'I am escalating this to Annex 7.'],
  'United Kingdom': ['Ah. Right. Lovely.', 'No worries if not! (I have sunk your navy.)'],
  'Switzerland': ['I have no opinion. Your account balance, however, does.', 'Neutral. Watching. Charging interest.'],
  'Australia': ['yeah nah', 'sorry mate the bird’s back'],
  'Canada': ['sorry — did I do something? sorry', 'okay. okay. that’s fine. that is completely fine.'],
  'India': ['Kindly do the needful.', 'Forwarded to all 14 groups 🙏'],
  'China': ['A rail link now connects our capitals. It was not requested.', 'Completed ahead of schedule.'],
  'Brazil': ['come over, bring the tanks', 'this is a great energy honestly'],
  'United States of America': ['Love this for us! Circling back post-detonation.', 'Let’s take this to a working group.'],
}

const QUICK_GLOBAL = ['gm 🙏', 'Who did this.', 'I demand a summit.', 'Nobody panic.']
const QUICK_DM = ['k', 'Seen.', 'Is that a threat?', 'Alliance?', 'Absolutely not.']

const esc = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!))

function bubble(m: ChatMsg): string {
  const mine = m.from === state.playerId
  const l = m.from !== 'SYSTEM' ? LEADER_BY_ID.get(m.from) : null
  const cls = m.kind === 'system' ? 'msg--system' : m.kind === 'action' ? 'msg--action' : mine ? 'msg--me' : ''
  const who = m.kind === 'system' ? '' : `<span class="who">${l ? `${l.flag} ${l.short}` : ''}</span>`
  return `<div class="msg ${cls}">${who}<div class="bubble">${esc(m.text)}</div></div>`
}

function lastLine(channel: string): string {
  const list = messagesFor(channel)
  return list.length ? list[list.length - 1].text : '—'
}

function renderInbox(): string {
  const rows = LEADERS
    .filter(l => l.id !== state.playerId)
    .map(l => {
      const n = state.unread[l.id] ?? 0
      const war = state.relations[l.id] === 'war' ? ' at-war' : ''
      return `
      <button class="thread${war}" data-ch="${l.id}">
        <span class="f">${l.flag}</span>
        <span class="t"><b>${l.short} · ${l.leader.split(' ').slice(-1)[0]}</b><small>${esc(lastLine(l.id))}</small></span>
        ${n ? `<span class="n">${n}</span>` : '<span></span>'}
      </button>`
    }).join('')

  const gn = state.unread['GLOBAL'] ?? 0
  const global = `
    <button class="thread" data-ch="GLOBAL">
      <span class="f">🌐</span>
      <span class="t"><b>GLOBAL CHANNEL</b><small>${esc(lastLine('GLOBAL'))}</small></span>
      ${gn ? `<span class="n">${gn}</span>` : '<span></span>'}
    </button>`

  return `<div class="inbox">${global}${rows}</div>`
}

export function renderRail(): string {
  const ch = state.openChannel

  if (ch === INBOX) {
    return `
    <aside class="rail">
      <div class="rail-head">
        <div class="who"><b>Inbox</b><small>Every head of state, one message away</small></div>
      </div>
      ${renderInbox()}
      <div class="composer"><span class="eyebrow">Click a country on the map to open its DM</span></div>
    </aside>`
  }

  const l = ch === 'GLOBAL' ? null : LEADER_BY_ID.get(ch)
  const title = l ? `${l.flag} ${l.short}` : '🌐 Global Channel'
  const sub = l ? l.leader : `${LEADERS.length} heads of state connected`
  const quick = (l ? QUICK_DM : QUICK_GLOBAL)
    .map(q => `<button class="qb" data-quick="${esc(q)}">${esc(q)}</button>`).join('')

  return `
  <aside class="rail">
    <div class="rail-head">
      <button class="back" data-ch="${INBOX}" title="Back to inbox">←</button>
      <div class="who"><b>${title}</b><small>${esc(sub)}</small></div>
      <span class="dot"></span>
    </div>
    <div class="log" id="log">${messagesFor(ch).map(bubble).join('')}</div>
    <div class="composer">
      <div class="quick">${quick}</div>
      <div class="row">
        <input id="say" placeholder="${l ? `Message ${l.short}…` : 'Address the world…'}" autocomplete="off" />
        <button class="send" id="send">Send</button>
      </div>
    </div>
  </aside>`
}

export function bindRail(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-ch]').forEach(el =>
    el.addEventListener('click', () => openChannel(el.dataset.ch!)))

  root.querySelectorAll<HTMLElement>('[data-quick]').forEach(el =>
    el.addEventListener('click', () => send(el.dataset.quick!)))

  const input = root.querySelector<HTMLInputElement>('#say')
  const fire = () => { if (input && input.value.trim()) { send(input.value.trim()); input.value = '' } }
  root.querySelector('#send')?.addEventListener('click', fire)
  input?.addEventListener('keydown', e => { if (e.key === 'Enter') fire() })

  const log = root.querySelector<HTMLElement>('#log')
  if (log) log.scrollTop = log.scrollHeight
}

function send(text: string) {
  if (!state.playerId) return
  const ch = state.openChannel
  say(state.playerId, ch, text)

  const responder = ch === 'GLOBAL'
    ? LEADERS.filter(l => l.id !== state.playerId)[state.messages.length % (LEADERS.length - 1)]
    : LEADER_BY_ID.get(ch)
  if (!responder) return

  showTyping()
  const pool = RETORTS[responder.id] ?? ['…']
  const line = pool[state.messages.length % pool.length]
  setTimeout(() => say(responder.id, ch, line), 900)
}

function showTyping() {
  const log = document.getElementById('log')
  if (!log) return
  const t = document.createElement('div')
  t.className = 'typing'
  t.innerHTML = '<i></i><i></i><i></i>'
  log.appendChild(t)
  log.scrollTop = log.scrollHeight
  setTimeout(() => { t.remove(); emit() }, 880)
}
