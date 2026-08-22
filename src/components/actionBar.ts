import { LEADERS, LEADER_BY_ID } from '../state/mock'
import {
  state, say, setDefcon, bumpStats, openChannel, strikeCountry, nudgeTrust, nudgeAll,
  formAlliance, bombsOf, spendBomb, conquer, holderOf, setTargetRegion, livingIn, mem,
} from '../state/store'
import { REGIONS, type Region } from '../state/types'
import { POPULATION, formatExact } from '../state/population'
import { strike } from './fx'
import { leaderRespond, someoneReacts } from '../net/respond'
import { INBOX } from './chatPanel'
import { endDay, resolveEnding } from '../state/turn'

const ACTIONS = [
  ['diplomacy', 'Diplomacy'],
  ['alliance', 'Propose alliance'],
  ['sanction', 'Sanction'],
  ['mobilise', 'Mobilise'],
  ['propaganda', 'Propaganda'],
  ['invade', 'Invade'],
  ['endturn', 'End day'],
] as const

const REGION_LABEL: Record<Region, string> = { north: 'N', west: 'W', east: 'E', south: 'S' }

export function renderActionBar(): string {
  const t = target()
  const lock = state.resolving || state.phase !== 'play' ? ' disabled' : ''
  const bombs = state.playerId ? bombsOf(state.playerId) : 0
  return `
  <div class="actionbar" data-sig="${actionBarSignature()}">
    <span class="eyebrow">Orders</span>
    ${ACTIONS.map(([k, label]) => `<button class="act" data-act="${k}"${lock}>${label}</button>`).join('')}
    <span class="target" title="Where the next warhead lands">
      <span class="eyebrow">Target</span>
      <b>${t ? (LEADER_BY_ID.get(t)?.short ?? t) : '—'}</b>
      <span class="regions">${REGIONS.map(r =>
        `<button class="region${state.targetRegion === r ? ' on' : ''}" data-region="${r}" title="${r}">${REGION_LABEL[r]}</button>`).join('')}</span>
    </span>
    <button class="act act--nuke" data-act="launch"${lock || (bombs ? '' : ' disabled')}>☢ Launch <b>${bombs}</b></button>
  </div>`
}

/** Fingerprint of what the bar shows, so the game screen can patch it only when it changes. */
export function actionBarSignature(): string {
  return `${state.resolving}|${state.phase}|${state.targetRegion}|${target()}|${state.playerId ? bombsOf(state.playerId) : 0}`
}

/** Prefer whoever you are currently talking to; otherwise the first live rival. */
function target(): string | null {
  const ch = state.openChannel
  if (ch !== 'GLOBAL' && ch !== INBOX && ch !== 'INTERCEPT' && ch !== state.playerId && LEADER_BY_ID.has(ch)) return ch
  const alive = LEADERS.filter(l => l.id !== state.playerId && state.relations[l.id] !== 'destroyed')
  return alive.length ? alive[(state.day * 3) % alive.length].id : null
}

export function bindActionBar(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-act]').forEach(el =>
    el.addEventListener('click', () => run(el.dataset.act!)))
  root.querySelectorAll<HTMLElement>('[data-region]').forEach(el =>
    el.addEventListener('click', () => setTargetRegion(el.dataset.region as Region)))
}

const short = (id: string) => LEADER_BY_ID.get(id)?.short ?? id

function run(act: string) {
  if (state.resolving || state.phase !== 'play') return
  const t = target()
  const me = state.playerId
  if (!me) return

  switch (act) {
    case 'diplomacy':
      openChannel(INBOX)
      break

    case 'alliance':
      if (!t) return
      if (mem(t).trust < -30) {
        nudgeTrust(t, -4, 'you asked for an alliance while they were furious')
        say('SYSTEM', 'GLOBAL', `${short(t)} has declined the alliance`, 'system')
      } else {
        formAlliance(me, t)
        nudgeTrust(t, 25)
        nudgeAll(-6, `you allied with ${short(t)}`, [t])
        bumpStats({ standing: 6, morale: 3 })
        say('SYSTEM', 'GLOBAL', `Alliance signed with ${short(t)}`, 'system')
      }
      void leaderRespond(t, 'GLOBAL')
      break

    case 'sanction':
      if (!t) return
      nudgeTrust(t, -35, 'you sanctioned them')
      for (const b of mem(t).bloc) nudgeTrust(b, -10, `you sanctioned their ally ${short(t)}`)
      bumpStats({ economy: -5, standing: -8 })
      setDefcon(state.defcon - 1)
      say('SYSTEM', 'GLOBAL', `Sanctions imposed on ${short(t)}`, 'system')
      void leaderRespond(t, 'GLOBAL')
      break

    case 'mobilise':
      bumpStats({ military: 7, economy: -6, morale: -4 })
      nudgeAll(-6, 'you mobilised')
      setDefcon(state.defcon - 1)
      say('SYSTEM', 'GLOBAL', 'Forces mobilised', 'system')
      someoneReacts()
      break

    case 'propaganda':
      bumpStats({ morale: 9, standing: -5 })
      nudgeAll(-4, 'your state broadcast mentioned them')
      say('SYSTEM', 'GLOBAL', 'State broadcast issued', 'system')
      break

    case 'invade': {
      if (!t) return
      const weak = livingIn(t) <= POPULATION[t] * 0.55 || state.relations[t] === 'destroyed'
      if (holderOf(t) === me) return
      if (!weak && state.stats.military < 80) {
        say('SYSTEM', 'GLOBAL', `${short(t)} is holding. Weaken them first, or mobilise past 80.`, 'system')
        return
      }
      conquer(me, t)
      bumpStats({ military: -12, standing: -14, morale: 6 })
      nudgeAll(-12, `you invaded ${short(t)}`, [t])
      say(me, 'GLOBAL', `${short(t)} is under our administration now.`, 'action')
      someoneReacts([t])
      resolveEnding()
      break
    }

    case 'endturn':
      void endDay()
      break

    case 'launch': {
      if (!t) return
      if (!spendBomb(me)) return
      const r = state.targetRegion
      state.nukesLaunched++
      setDefcon(1)
      strike(me, t, `${short(t).toUpperCase()} · ${r.toUpperCase()}`, r)
      mem(t).trust = Math.min(mem(t).trust, -100)
      nudgeTrust(t, -30, 'you nuked them')
      nudgeAll(-30, `you nuked ${short(t)}`, [t])
      say(me, 'GLOBAL', `Launch confirmed on ${short(t)}. ${r} sector.`, 'action')
      setTimeout(() => {
        const toll = strikeCountry(t, me, r)
        bumpStats({ standing: -22, morale: -10, economy: -8 })
        say('SYSTEM', 'GLOBAL', `${short(t)} ${r} — ${formatExact(toll)} dead`, 'system')
        if (livingIn(t) <= POPULATION[t] * 0.55) {
          conquer(me, t)
          say('SYSTEM', 'GLOBAL', `${short(t)} has fallen. It is yours.`, 'system')
        }
        // the room reacts to the launch — the funniest beat in the game
        someoneReacts([t])
        resolveEnding()
      }, 1400)
      break
    }
  }
}
