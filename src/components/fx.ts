import { centroidOf, regionPoint, MAP_VIEWBOX } from './worldMap'
import type { Region } from '../state/types'

const SVG_NS = 'http://www.w3.org/2000/svg'

function el<K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string | number>) {
  const n = document.createElementNS(SVG_NS, name)
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v))
  return n
}

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

const DEFS = `
  <radialGradient id="fxFlash">
    <stop offset="0%"   stop-color="#fff"    stop-opacity="1" />
    <stop offset="35%"  stop-color="#ffd89b" stop-opacity=".9" />
    <stop offset="70%"  stop-color="#f5a524" stop-opacity=".35" />
    <stop offset="100%" stop-color="#d93a2b" stop-opacity="0" />
  </radialGradient>
  <radialGradient id="fxCloud">
    <stop offset="0%"   stop-color="#ffe8b0" stop-opacity=".95" />
    <stop offset="55%"  stop-color="#e8842f" stop-opacity=".75" />
    <stop offset="100%" stop-color="#4a2318" stop-opacity="0" />
  </radialGradient>
  <filter id="fxSoften"><feGaussianBlur stdDeviation="2.2" /></filter>`

/**
 * The overlay lives on <body>, NOT inside #app. Any state change re-renders
 * #app.innerHTML, which would otherwise destroy an in-flight animation.
 * It mirrors the map's viewBox and bounding box, so viewBox coords land exactly.
 */
function overlay(): SVGSVGElement | null {
  const shell = document.getElementById('map-shell')
  if (!shell) return null
  const r = shell.getBoundingClientRect()

  let svg = document.getElementById('fx-overlay') as SVGSVGElement | null
  if (!svg) {
    svg = document.createElementNS(SVG_NS, 'svg')
    svg.id = 'fx-overlay'
    svg.setAttribute('viewBox', `0 0 ${MAP_VIEWBOX.w} ${MAP_VIEWBOX.h}`)
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
    const defs = document.createElementNS(SVG_NS, 'defs')
    defs.innerHTML = DEFS
    svg.appendChild(defs)
    document.body.appendChild(svg)
  }
  Object.assign(svg.style, {
    position: 'fixed',
    left: `${r.left}px`, top: `${r.top}px`,
    width: `${r.width}px`, height: `${r.height}px`,
    pointerEvents: 'none', zIndex: '70',
  })
  return svg
}

/**
 * Full strike sequence: missile arc → impact flash → shockwave rings →
 * mushroom cloud, plus a screen shake and a red vignette pulse.
 */
export function strike(fromId: string, toId: string, label = 'IMPACT', region?: Region) {
  const svg = overlay()
  if (!svg) return

  const [x1, y1] = centroidOf(fromId)
  const [x2, y2] = region ? regionPoint(toId, region) : centroidOf(toId)

  const group = el('g', { class: 'fx' })
  svg.appendChild(group)

  const ARC = reduced() ? 0 : 700
  const dist = Math.hypot(x2 - x1, y2 - y1)
  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2 - Math.min(180, dist * 0.45)
  const arcPath = `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`

  /* 1 — missile arc */
  if (ARC) {
    group.appendChild(el('path', {
      class: 'fx-arc', d: arcPath, style: `--arc-len:${dist * 1.6}`,
    }))
    const head = el('circle', { class: 'fx-head', r: 2.4, cx: 0, cy: 0 })
    head.appendChild(el('animateMotion', { dur: `${ARC}ms`, fill: 'freeze', path: arcPath }))
    group.appendChild(head)
    setTimeout(() => head.remove(), ARC)
  }

  /* 2 — detonation */
  setTimeout(() => {
    group.appendChild(el('circle', { class: 'fx-flash', cx: x2, cy: y2, r: 1, fill: 'url(#fxFlash)' }))

    for (let i = 0; i < 3; i++) {
      group.appendChild(el('circle', {
        class: 'fx-ring', cx: x2, cy: y2, r: 4, style: `animation-delay:${i * 130}ms`,
      }))
    }

    const cloud = el('g', { class: 'fx-cloud' })
    cloud.appendChild(el('rect', { class: 'fx-stem', x: x2 - 2.6, y: y2 - 20, width: 5.2, height: 20, rx: 2 }))
    cloud.appendChild(el('circle', { class: 'fx-cap', cx: x2, cy: y2 - 22, r: 11, fill: 'url(#fxCloud)', filter: 'url(#fxSoften)' }))
    cloud.appendChild(el('circle', { class: 'fx-cap fx-cap--2', cx: x2, cy: y2 - 16, r: 7, fill: 'url(#fxCloud)', filter: 'url(#fxSoften)' }))
    group.appendChild(cloud)

    const tag = el('text', { class: 'fx-label', x: x2, y: y2 + 26, 'text-anchor': 'middle' })
    tag.textContent = label
    group.appendChild(tag)

    shake()
    pulseVignette()
  }, ARC)

  setTimeout(() => group.remove(), ARC + 2600)
}

/** #app is never replaced (only its innerHTML), so a class here survives re-renders. */
function shake() {
  const app = document.getElementById('app')
  if (!app || reduced()) return
  app.classList.remove('shake')
  void app.offsetWidth
  app.classList.add('shake')
  setTimeout(() => app.classList.remove('shake'), 620)
}

function pulseVignette() {
  let v = document.getElementById('blast-vignette')
  if (!v) {
    v = document.createElement('div')
    v.id = 'blast-vignette'
    document.body.appendChild(v)
  }
  v.classList.remove('on')
  void v.offsetWidth
  v.classList.add('on')
}

/**
 * Something sails, flies or drives from one state toward another: a marker
 * travels along the line and holds at the midpoint with a label for a while.
 * Blockades, deployments, convoys — the world moving where the player can see it.
 */
export function deploy(fromId: string, toId: string, icon: string, label: string, holdMs = 22_000) {
  const svg = overlay()
  if (!svg) return
  const [x1, y1] = centroidOf(fromId)
  const [x2, y2] = centroidOf(toId)
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
  const group = el('g', { class: 'fx fx-deploy' })
  svg.appendChild(group)

  group.appendChild(el('line', { class: 'fx-route', x1, y1, x2: mx, y2: my }))
  const mover = el('text', { class: 'fx-unit', 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 14 })
  mover.textContent = icon
  const travel = reduced() ? 0 : 1600
  if (travel) mover.appendChild(el('animateMotion', { dur: `${travel}ms`, fill: 'freeze', path: `M${x1},${y1} L${mx},${my}` }))
  else { mover.setAttribute('x', String(mx)); mover.setAttribute('y', String(my)) }
  group.appendChild(mover)

  setTimeout(() => {
    group.appendChild(el('circle', { class: 'fx-hold', cx: mx, cy: my, r: 7 }))
    const tag = el('text', { class: 'fx-label fx-label--deploy', x: mx, y: my + 14, 'text-anchor': 'middle' })
    tag.textContent = label
    group.appendChild(tag)
  }, travel)

  setTimeout(() => { group.classList.add('fx-out'); setTimeout(() => group.remove(), 900) }, holdMs)
}

/** A country flashes on the map — hostile red for threats, amber for something happening there. */
export function pulseCountry(id: string, tone: 'hostile' | 'hit') {
  const path = document.querySelector<SVGPathElement>(`path.country[data-id="${CSS.escape(id)}"]`)
  if (!path) return
  const cls = tone === 'hostile' ? 'is-pulsing-hostile' : 'is-pulsing-hit'
  path.classList.remove(cls); void path.getBoundingClientRect(); path.classList.add(cls)
  setTimeout(() => path.classList.remove(cls), 2400)
}

/**
 * The one-time alarm: the world just went to total war. A red stamp with the
 * exclamation, a longer shake, the vignette left burning. Lives on <body> like
 * the overlay so no re-render can cut it short.
 */
export function worldWarAlarm() {
  let v = document.getElementById('ww3-alarm')
  if (v) return
  v = document.createElement('div')
  v.id = 'ww3-alarm'
  v.innerHTML = `
    <div class="ww3-mark"><span>!</span></div>
    <div class="ww3-text"><b>World War III</b><small>has started</small></div>`
  document.body.appendChild(v)
  const app = document.getElementById('app')
  if (app && !reduced()) {
    app.classList.remove('shake', 'shake--long')
    void app.offsetWidth
    app.classList.add('shake--long')
    setTimeout(() => app.classList.remove('shake--long'), 1800)
  }
  pulseVignette()
  setTimeout(() => pulseVignette(), 700)
  setTimeout(() => v?.classList.add('out'), 6500)
  setTimeout(() => v?.remove(), 7400)
}

/** called when leaving the game screen */
export function clearFx() {
  document.getElementById('fx-overlay')?.remove()
  document.getElementById('ww3-alarm')?.remove()
}
