import { centroidOf, MAP_VIEWBOX } from './worldMap'

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
export function strike(fromId: string, toId: string, label = 'IMPACT') {
  const svg = overlay()
  if (!svg) return

  const [x1, y1] = centroidOf(fromId)
  const [x2, y2] = centroidOf(toId)

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

/** called when leaving the game screen */
export function clearFx() {
  document.getElementById('fx-overlay')?.remove()
}
