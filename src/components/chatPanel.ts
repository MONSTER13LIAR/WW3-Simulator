import { LEADERS, LEADER_BY_ID } from '../state/mock'
import { state, messagesFor, openChannel, say } from '../state/store'
import { leaderRespond } from '../net/respond'
import type { ChatMsg } from '../state/types'

export const INBOX = 'INBOX'

const QUICK_GLOBAL = ['gm 🙏', 'Who did this.', 'I demand a summit.', 'Nobody panic.']
const QUICK_DM = ['k', 'Seen.', 'Is that a threat?', 'Alliance?', 'Absolutely not.']

/** Message ids that have already been on screen; they must not re-animate. */
const mounted = new Set<string>()

const esc = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!))

function bubble(m: ChatMsg): string {
  const mine = m.from === state.playerId
  const l = m.from !== 'SYSTEM' ? LEADER_BY_ID.get(m.from) : null
  const cls = m.kind === 'system' ? 'msg--system' : m.kind === 'action' ? 'msg--action' : mine ? 'msg--me' : ''
  const who = m.kind === 'system' ? '' : `<span class="who">${l ? `${l.flag} ${l.short}` : ''}</span>`
  const fresh = mounted.has(m.id) ? '' : ' is-new'
  mounted.add(m.id)
  return `<div class="msg ${cls}${fresh}" data-mid="${m.id}">${who}<div class="bubble">${esc(m.text)}</div></div>`
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

function typingBubble(ch: string): string {
  return state.typing
    .filter(t => t.channel === ch)
    .map(t => {
      const l = LEADER_BY_ID.get(t.leaderId)
      return `<div class="msg"><span class="who">${l ? `${l.flag} ${l.short}` : ''}</span>
    <div class="typing"><i></i><i></i><i></i></div></div>`
    })
    .join('')
}

export function renderRail(): string {
  const ch = state.openChannel

  if (ch === INBOX) {
    return `
    <aside class="rail" data-channel="${INBOX}">
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
  <aside class="rail" data-channel="${esc(ch)}">
    <div class="rail-head">
      <button class="back" data-ch="${INBOX}" title="Back to inbox">←</button>
      <div class="who"><b>${title}</b><small>${esc(sub)}</small></div>
      <span class="dot"></span>
    </div>
    <div class="log" id="log">${messagesFor(ch).map(bubble).join('')}${typingBubble(ch)}</div>
    <div class="composer">
      <div class="quick">${quick}</div>
      <div class="row">
        <input id="say" placeholder="${l ? `Message ${l.short}…` : 'Address the world…'}" autocomplete="off" />
        <button class="send" id="send">Send</button>
      </div>
    </div>
  </aside>`
}

/**
 * Swap the rail for its current state without losing what the player was in the
 * middle of doing: an unsent draft, the caret, and the scroll position if they
 * had scrolled up to read back.
 */
export function updateRail(root: HTMLElement) {
  const old = root.querySelector<HTMLElement>('.rail')
  if (!old) return

  // A draft belongs to the conversation it was typed in; switching channels
  // must not carry "I will end you" into someone else's DM.
  const sameChannel = old.dataset.channel === String(state.openChannel)
  const input = old.querySelector<HTMLInputElement>('#say')
  const draft = sameChannel ? input?.value ?? '' : ''
  const caret = input?.selectionStart ?? null
  const hadFocus = sameChannel && document.activeElement === input

  const log = old.querySelector<HTMLElement>('#log')
  // "near the bottom" means new messages should keep pulling the view down
  const pinned = !log || log.scrollHeight - log.scrollTop - log.clientHeight < 48
  const wasAt = log?.scrollTop ?? 0

  old.outerHTML = renderRail()

  const rail = root.querySelector<HTMLElement>('.rail')
  if (!rail) return
  bindRail(rail)

  const next = rail.querySelector<HTMLInputElement>('#say')
  if (next && draft) {
    next.value = draft
    if (hadFocus) {
      next.focus()
      if (caret !== null) next.setSelectionRange(caret, caret)
    }
  } else if (next && hadFocus) {
    next.focus()
  }

  const nextLog = rail.querySelector<HTMLElement>('#log')
  if (nextLog && !pinned) nextLog.scrollTop = wasAt
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
    ? LEADERS.filter(l => l.id !== state.playerId && state.relations[l.id] !== 'destroyed')[
        Math.floor(Math.random() * Math.max(1, LEADERS.filter(l => l.id !== state.playerId && state.relations[l.id] !== 'destroyed').length))]
    : LEADER_BY_ID.get(ch)

  if (responder) void leaderRespond(responder.id, ch)
}

