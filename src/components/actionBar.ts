import { LEADERS } from '../state/mock'
import { state, say, setRelation, setDefcon, bumpStats, advanceDay, openChannel, endGame } from '../state/store'
import { strike } from './fx'
import { leaderRespond, someoneReacts } from '../net/respond'
import { INBOX } from './chatPanel'

const ACTIONS = [
  ['diplomacy', 'Diplomacy'],
  ['alliance', 'Propose alliance'],
  ['sanction', 'Sanction'],
  ['mobilise', 'Mobilise'],
  ['propaganda', 'Propaganda'],
  ['endturn', 'End day'],
] as const

export function renderActionBar(): string {
  return `
  <div class="actionbar">
    <span class="eyebrow">Orders</span>
    ${ACTIONS.map(([k, label]) => `<button class="act" data-act="${k}">${label}</button>`).join('')}
    <button class="act act--nuke" data-act="launch">☢ Launch</button>
  </div>`
}

/** Prefer whoever you are currently talking to; otherwise the first live rival. */
function target(): string | null {
  const ch = state.openChannel
  if (ch !== 'GLOBAL' && ch !== INBOX && ch !== state.playerId) return ch
  const alive = LEADERS.filter(l => l.id !== state.playerId && state.relations[l.id] !== 'destroyed')
  return alive.length ? alive[(state.day * 3) % alive.length].id : null
}

export function bindActionBar(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-act]').forEach(el =>
    el.addEventListener('click', () => run(el.dataset.act!)))
}

function run(act: string) {
  const t = target()

  switch (act) {
    case 'diplomacy':
      openChannel(INBOX)
      break

    case 'alliance':
      if (!t) return
      setRelation(t, 'ally')
      bumpStats({ standing: 6, morale: 3 })
      say('SYSTEM', 'GLOBAL', `Alliance signed with ${t}`, 'system')
      void leaderRespond(t, 'GLOBAL')
      break

    case 'sanction':
      if (!t) return
      setRelation(t, 'war')
      bumpStats({ economy: -5, standing: -8 })
      setDefcon(state.defcon - 1)
      say('SYSTEM', 'GLOBAL', `Sanctions imposed on ${t}`, 'system')
      void leaderRespond(t, 'GLOBAL')
      break

    case 'mobilise':
      bumpStats({ military: 7, economy: -6, morale: -4 })
      setDefcon(state.defcon - 1)
      say('SYSTEM', 'GLOBAL', 'Forces mobilised', 'system')
      someoneReacts()
      break

    case 'propaganda':
      bumpStats({ morale: 9, standing: -5 })
      say('SYSTEM', 'GLOBAL', 'State broadcast issued', 'system')
      break

    case 'endturn':
      advanceDay()
      break

    case 'launch': {
      if (!t || !state.playerId) return
      state.nukesLaunched++
      setDefcon(1)
      strike(state.playerId, t, t)
      setRelation(t, 'war')
      say(state.playerId, 'GLOBAL', `Launch confirmed on ${t}.`, 'action')
      setTimeout(() => {
        setRelation(t, 'destroyed')
        bumpStats({ standing: -22, morale: -10, economy: -8 })
        say('SYSTEM', 'GLOBAL', `${t} is gone`, 'system')
        // the room reacts to the launch — the funniest beat in the game
        someoneReacts([t])
      }, 1400)
      if (state.nukesLaunched >= 4) setTimeout(() => endGame('annihilation'), 3200)
      break
    }
  }
}
