import { LEADERS, LEADER_BY_ID } from '../state/mock'
import {
  state, say, setDefcon, bumpStats, openChannel, strikeCountry, nudgeTrust, nudgeAll,
  bombsOf, spendBomb, conquer, holderOf, setTargetRegion, livingIn, mem, areAllied,
} from '../state/store'
import { REGIONS, type Region } from '../state/types'
import { POPULATION, formatExact } from '../state/population'
import { strike } from './fx'
import { leaderRespond, someoneReacts } from '../net/respond'
import { INBOX } from './chatPanel'
import { endDay, resolveEnding, retaliate } from '../state/turn'
import { shareSupplies, leaveAlliance, joinBloc } from '../state/world'

/**
 * What each order does, in the hover card. Written as costs and effects
 * because that is what the player is weighing; the flavour is in the chat.
 */
const TIPS: Record<string, string> = {
  diplomacy:  'Open the inbox and talk to any head of state directly. Free.',
  alliance:   'Propose a pact with the target. They accept unless furious (trust under −30). Standing +6, morale +3; everyone else −6 trust.',
  sanction:   'Cut the target off. Target −35 trust, their bloc −10. You: economy −5, standing −8, Defcon −1.',
  supplies:   'Send fuel, grain or batteries to your ally. Ally +14 trust, standing +2. Economy −4.',
  mobilise:   'Call up the reserves. Military +7, economy −6, morale −4, Defcon −1. Everyone −6 trust.',
  propaganda: 'A state broadcast. Morale +9, standing −5. Everyone −4 trust.',
  invade:     'March in. Only a state at 45 % of its people, or any state if your military is over 80. Military −12, standing −14, morale +6. Everyone −12 trust.',
  leave:      'Walk out of the alliance with the target. They −30 trust, other allies −8. Standing −10, morale −3.',
  endturn:    'Skip to the next day. Stats drift, pacts form, the world moves without you.',
  launch:     'One warhead on the target\'s selected quarter. 20–30 % of its people. Standing −22, morale −10, economy −8. Everyone −30 trust. They shoot back.',
}

/** Orders that go through on the first click; everything else asks once. */
const NO_CONFIRM = new Set(['diplomacy'])

function actions(ally: boolean): ReadonlyArray<readonly [string, string]> {
  return [
    ['diplomacy', 'Diplomacy'],
    ['alliance', 'Propose alliance'],
    ally ? ['supplies', 'Send supplies'] : ['sanction', 'Sanction'],
    ['mobilise', 'Mobilise'],
    ['propaganda', 'Propaganda'],
    ally ? ['leave', 'Leave alliance'] : ['invade', 'Invade'],
    ['endturn', 'End day'],
  ]
}

const REGION_LABEL: Record<Region, string> = { north: 'N', west: 'W', east: 'E', south: 'S' }

const isAlly = (id: string | null) => !!id && !!state.playerId && areAllied(state.playerId, id)
const HOSTILE = new Set(['sanction', 'invade'])

export function renderActionBar(): string {
  const t = target()
  const ally = isAlly(t)
  const lock = state.resolving || state.phase !== 'play' ? ' disabled' : ''
  const hostile = lock || (ally ? ' disabled' : '')
  const bombs = state.playerId ? bombsOf(state.playerId) : 0
  return `
  <div class="actionbar" data-sig="${actionBarSignature()}">
    <span class="eyebrow">Orders</span>
    ${actions(ally).map(([k, label]) => `<button class="act" data-act="${k}" data-label="${label}" data-tip="${esc(TIPS[k] ?? '')}"${HOSTILE.has(k) ? hostile : lock}${k === 'alliance' && ally ? ' disabled' : ''}>${label}</button>`).join('')}
    <span class="target" title="Where the next warhead lands">
      <span class="eyebrow">Target</span>
      <b>${t ? (LEADER_BY_ID.get(t)?.short ?? t) : '—'}${ally ? ' <small>ally</small>' : ''}</b>
      <span class="regions">${REGIONS.map(r =>
        `<button class="region${state.targetRegion === r ? ' on' : ''}" data-region="${r}" title="${r}">${REGION_LABEL[r]}</button>`).join('')}</span>
    </span>
    <button class="act act--nuke" data-act="launch" data-label="☢ Launch <b>${bombs}</b>" data-tip="${esc(ally ? 'You cannot launch on an ally.' : TIPS.launch)}"${hostile || (bombs ? '' : ' disabled')}>☢ Launch <b>${bombs}</b></button>
  </div>`
}

/** Fingerprint of what the bar shows, so the game screen can patch it only when it changes. */
export function actionBarSignature(): string {
  return `${state.resolving}|${state.phase}|${state.targetRegion}|${target()}|${isAlly(target())}|${state.playerId ? bombsOf(state.playerId) : 0}`
}

/** Prefer whoever you are currently talking to; otherwise the first live rival. */
function target(): string | null {
  const ch = state.openChannel
  if (ch !== 'GLOBAL' && ch !== INBOX && ch !== 'INTERCEPT' && ch !== state.playerId && LEADER_BY_ID.has(ch)) return ch
  const alive = LEADERS.filter(l => l.id !== state.playerId && state.relations[l.id] !== 'destroyed' && !isAlly(l.id))
  return alive.length ? alive[(state.day * 3) % alive.length].id : null
}

/**
 * Every order except opening the inbox asks once: the first click arms the
 * button ("Confirm?") for three seconds, the second one goes through. A
 * mis-click on Launch is the one thing this game must never allow.
 */
export function bindActionBar(root: HTMLElement) {
  let armed: HTMLElement | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  const disarm = () => {
    if (timer) clearTimeout(timer)
    timer = null
    if (armed) { armed.classList.remove('is-armed'); armed.innerHTML = armed.dataset.label ?? armed.innerHTML }
    armed = null
  }
  root.querySelectorAll<HTMLElement>('[data-act]').forEach(el =>
    el.addEventListener('click', () => {
      const act = el.dataset.act!
      if (NO_CONFIRM.has(act)) { disarm(); run(act); return }
      if (armed === el) { disarm(); run(act); return }
      disarm()
      armed = el
      el.classList.add('is-armed')
      el.innerHTML = `Confirm ${act === 'launch' ? 'launch' : ''}?`
      timer = setTimeout(disarm, 3000)
    }))
  root.querySelectorAll<HTMLElement>('[data-region]').forEach(el =>
    el.addEventListener('click', () => setTargetRegion(el.dataset.region as Region)))
}

const short = (id: string) => LEADER_BY_ID.get(id)?.short ?? id
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

function run(act: string) {
  if (state.resolving || state.phase !== 'play') return
  const t = target()
  const me = state.playerId
  if (!me) return
  if ((act === 'launch' || act === 'sanction' || act === 'invade') && isAlly(t)) {
    say('SYSTEM', 'GLOBAL', `${short(t!)} is your ally. Leave the alliance first.`, 'system')
    return
  }

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
        joinBloc(t)
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

    case 'supplies':
      if (t) shareSupplies(t)
      break

    case 'leave':
      if (t) leaveAlliance(t)
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
      const weak = livingIn(t) <= POPULATION[t] * 0.45 || state.relations[t] === 'destroyed'
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
        if (livingIn(t) <= POPULATION[t] * 0.45) {
          conquer(me, t)
          say('SYSTEM', 'GLOBAL', `${short(t)} has fallen. It is yours.`, 'system')
        }
        someoneReacts([t], `${short(me)} just struck ${short(t)} (${r}, ${formatExact(toll)} dead). React to that specific act, as your government would.`)
        resolveEnding()
        if (!state.ending) void retaliate(t)
      }, 1400)
      break
    }
  }
}
