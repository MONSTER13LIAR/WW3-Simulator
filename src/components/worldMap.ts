import { geoNaturalEarth1, geoPath, geoGraticule10 } from 'd3-geo'
import { feature } from 'topojson-client'
import type { FeatureCollection, Geometry } from 'geojson'
import topo from 'world-atlas/countries-110m.json'
import { state, openChannel, holderOf, livingIn, areAllied } from '../state/store'
import { LEADER_BY_ID } from '../state/mock'
import { formatPop } from '../state/population'
import { flagDefs } from './flags'
import type { Region } from '../state/types'

const VB_W = 1000
const VB_H = 520

const world = feature(topo as never, (topo as never as { objects: { countries: never } }).objects.countries) as unknown as FeatureCollection<Geometry, { name: string }>

const projection = geoNaturalEarth1().fitExtent([[8, 8], [VB_W - 8, VB_H - 8]], world)
const path = geoPath(projection)

/** viewBox-space centroid per country — the anchor every explosion aims at */
export const CENTROIDS = new Map<string, [number, number]>()
/** viewBox-space bounds per country, for aiming at one quarter of it */
const BOUNDS = new Map<string, [[number, number], [number, number]]>()
for (const f of world.features) {
  const c = path.centroid(f)
  if (Number.isFinite(c[0])) CENTROIDS.set(f.properties.name, [c[0], c[1]])
  const b = path.bounds(f)
  if (Number.isFinite(b[0][0])) BOUNDS.set(f.properties.name, b)
}

export function centroidOf(id: string): [number, number] {
  return CENTROIDS.get(id) ?? [VB_W / 2, VB_H / 2]
}

/**
 * Where a strike on one quarter of a country lands: a point pushed from the
 * centroid toward that edge of the country's extent. Countries with scattered
 * territory (USA, France) have wide bounds, so the push is capped.
 */
export function regionPoint(id: string, region: Region): [number, number] {
  const [cx, cy] = centroidOf(id)
  const b = BOUNDS.get(id)
  if (!b) return [cx, cy]
  const dx = Math.min(60, (b[1][0] - b[0][0]) * 0.22)
  const dy = Math.min(36, (b[1][1] - b[0][1]) * 0.22)
  switch (region) {
    case 'north': return [cx, cy - dy]
    case 'south': return [cx, cy + dy]
    case 'east':  return [cx + dx, cy]
    case 'west':  return [cx - dx, cy]
  }
}

export const MAP_VIEWBOX = { w: VB_W, h: VB_H }

/**
 * Every state owns a colour, and its colour goes wherever its flag goes: a
 * conquered territory is painted in the holder's. Muted on purpose — the
 * accent, the war pulse and the embers still have to read over them.
 */
export const COLOURS: Record<string, string> = {
  'United States of America': '#4f7f8c',
  'Russia':                   '#8a4d4d',
  'China':                    '#a0533a',
  'India':                    '#b07a3a',
  'Japan':                    '#8c5a76',
  'Germany':                  '#5c6670',
  'France':                   '#4f6f8f',
  'United Kingdom':           '#6a5f8e',
  'Brazil':                   '#4f8a5f',
  'Australia':                '#9a7a3c',
  'Canada':                   '#8a4f62',
  'Switzerland':              '#7a5650',
  'Israel':                   '#5f7f7a',
}

/** circle-flags code per playable state, for the on-map label */
const ISO: Record<string, string> = {
  'United States of America': 'us', 'Russia': 'ru', 'China': 'cn', 'India': 'in',
  'Japan': 'jp', 'Germany': 'de', 'France': 'fr', 'United Kingdom': 'gb',
  'Brazil': 'br', 'Australia': 'au', 'Canada': 'ca', 'Switzerland': 'ch', 'Israel': 'il',
}

/** Label anchors nudged off the centroid where Europe gets crowded. */
const LABEL_OFFSET: Record<string, [number, number]> = {
  'United Kingdom': [-30, -14],
  'France':         [28, -42],   // centroid is dragged toward French Guiana
  'Germany':        [10, -18],
  'Switzerland':    [4, 22],
  'Israel':         [18, 16],
  'Japan':          [26, 4],
  'Canada':         [-10, -8],
  'United States of America': [14, 8],
}

/**
 * Reserved for whoever is playing, whichever country that is. Blue is the
 * "friendly" colour in NATO APP-6 military symbology — the convention every
 * war-room map the player has ever seen already uses — so it needs no legend.
 * No state in COLOURS comes near it.
 */
export const PLAYER_COLOUR = '#2f80ed'

export function colourOf(id: string): string | null {
  const h = holderOf(id)
  if (h === state.playerId) return PLAYER_COLOUR
  return COLOURS[h] ?? null
}

/** One country's classes; the `rel-*` classes still drive war/ember animation and strokes. */
function countryClass(id: string): string {
  const rel = state.relations[id]
  const held = state.owner[id] ? 'is-held' : ''
  return ['country', rel ? `rel-${rel}` : '', LEADER_BY_ID.has(id) ? 'is-playable' : '', held]
    .filter(Boolean).join(' ')
}

function countryStyle(id: string): string {
  const c = colourOf(id)
  return c ? `fill:${c}` : ''
}

function labelText(id: string): { name: string; pop: string; tag: string } {
  const l = LEADER_BY_ID.get(id)
  const holder = holderOf(id)
  const name = holder !== id ? `${l?.short ?? id} · ${LEADER_BY_ID.get(holder)?.short ?? holder}` : (l?.short ?? id)
  const tag = id === state.playerId ? 'YOU'
    : state.playerId && areAllied(state.playerId, id) ? 'ALLY'
    : state.relations[id] === 'war' ? 'WAR' : ''
  return { name, pop: formatPop(livingIn(id)), tag }
}

function renderLabel(id: string): string {
  const [cx, cy] = centroidOf(id)
  const [ox, oy] = LABEL_OFFSET[id] ?? [0, 0]
  const x = cx + ox, y = cy + oy
  const { name, pop, tag } = labelText(id)
  const code = ISO[id]
  return `
    <g class="label" data-id="${escapeAttr(id)}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
      ${code ? `<use href="#flag-${code}" x="-22" y="-7" width="14" height="14" />` : ''}
      <text class="label-name" x="-5" y="-1">${escapeHtml(name)}</text>
      <text class="label-pop" x="-5" y="7">${pop}</text>
      <text class="label-tag" x="-5" y="15">${tag}</text>
    </g>`
}

export function renderWorldMap(): string {
  const graticule = path(geoGraticule10()) ?? ''

  const countries = world.features.map(f => {
    const id = f.properties.name
    const d = path(f)
    if (!d) return ''
    return `<path class="${countryClass(id)}" style="${countryStyle(id)}" d="${d}" data-id="${escapeAttr(id)}"><title>${escapeHtml(id)}</title></path>`
  }).join('')

  const pins = [...LEADER_BY_ID.keys()].map(id => {
    const [x, y] = centroidOf(id)
    const rel = state.relations[id]
    return `<circle class="pin rel-${rel}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" data-id="${escapeAttr(id)}" />`
  }).join('')

  const labels = [...LEADER_BY_ID.keys()].map(renderLabel).join('')

  return `
  <div class="map-shell" id="map-shell">
    <svg class="map" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="World map">
      ${flagDefs(Object.values(ISO))}
      <path class="graticule" d="${graticule}" />
      <g class="countries">${countries}</g>
      <g class="pins">${pins}</g>
      <g class="labels">${labels}</g>
    </svg>
    <div class="map-vignette"></div>
    <div class="map-scanline"></div>
  </div>`
}

/**
 * Repaint the existing map from state. Rebuilding the SVG on every state change
 * cost a full re-parse of 177 country paths and restarted the war/ember pulses,
 * so relations, colours and label text are pushed onto the nodes already in
 * the document instead.
 */
export function refreshMap(root: HTMLElement) {
  for (const el of root.querySelectorAll<SVGPathElement>('path.country')) {
    const id = el.dataset.id
    if (!id) continue
    const cls = countryClass(id)
    // only touch it when it actually changed — reassigning restarts the pulse
    if (el.getAttribute('class') !== cls) el.setAttribute('class', cls)
    const style = countryStyle(id)
    if (el.getAttribute('style') !== style) el.setAttribute('style', style)
  }

  for (const el of root.querySelectorAll<SVGCircleElement>('circle.pin')) {
    const id = el.dataset.id
    if (!id) continue
    const cls = `pin rel-${state.relations[id]}`
    if (el.getAttribute('class') !== cls) el.setAttribute('class', cls)
  }

  for (const el of root.querySelectorAll<SVGGElement>('g.label')) {
    const id = el.dataset.id
    if (!id) continue
    const { name, pop, tag } = labelText(id)
    const set = (sel: string, v: string) => {
      const t = el.querySelector(sel)
      if (t && t.textContent !== v) t.textContent = v
    }
    set('.label-name', name); set('.label-pop', pop); set('.label-tag', tag)
    const cls = `label${tag ? ` tag-${tag.toLowerCase()}` : ''}${livingIn(id) === 0 ? ' is-dead' : ''}`
    if (el.getAttribute('class') !== cls) el.setAttribute('class', cls)
  }
}

/** delegate clicks once; the listener survives because the map is never rebuilt */
export function bindMapClicks(root: HTMLElement) {
  root.addEventListener('click', e => {
    const el = (e.target as HTMLElement).closest('[data-id]') as HTMLElement | null
    if (!el) return
    const id = el.dataset.id!
    if (!LEADER_BY_ID.has(id) || id === state.playerId) return
    openChannel(id)
  })
}

const escapeHtml = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!))
const escapeAttr = (s: string) => s.replace(/"/g, '&quot;')
