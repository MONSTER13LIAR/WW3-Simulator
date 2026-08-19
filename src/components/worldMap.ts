import { geoNaturalEarth1, geoPath, geoGraticule10 } from 'd3-geo'
import { feature } from 'topojson-client'
import type { FeatureCollection, Geometry } from 'geojson'
import topo from 'world-atlas/countries-110m.json'
import { state, openChannel } from '../state/store'
import { LEADER_BY_ID } from '../state/mock'

const VB_W = 1000
const VB_H = 520

const world = feature(topo as never, (topo as never as { objects: { countries: never } }).objects.countries) as unknown as FeatureCollection<Geometry, { name: string }>

const projection = geoNaturalEarth1().fitExtent([[8, 8], [VB_W - 8, VB_H - 8]], world)
const path = geoPath(projection)

/** viewBox-space centroid per country — the anchor every explosion aims at */
export const CENTROIDS = new Map<string, [number, number]>()
for (const f of world.features) {
  const c = path.centroid(f)
  if (Number.isFinite(c[0])) CENTROIDS.set(f.properties.name, [c[0], c[1]])
}

export function centroidOf(id: string): [number, number] {
  return CENTROIDS.get(id) ?? [VB_W / 2, VB_H / 2]
}

export const MAP_VIEWBOX = { w: VB_W, h: VB_H }

export function renderWorldMap(): string {
  const graticule = path(geoGraticule10()) ?? ''

  const countries = world.features.map(f => {
    const id = f.properties.name
    const d = path(f)
    if (!d) return ''
    const rel = state.relations[id]
    const playable = LEADER_BY_ID.has(id)
    const cls = ['country', rel ? `rel-${rel}` : '', playable ? 'is-playable' : ''].filter(Boolean).join(' ')
    return `<path class="${cls}" d="${d}" data-id="${escapeAttr(id)}"><title>${escapeHtml(id)}</title></path>`
  }).join('')

  const pins = [...LEADER_BY_ID.keys()].map(id => {
    const [x, y] = centroidOf(id)
    const rel = state.relations[id]
    return `<circle class="pin rel-${rel}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" data-id="${escapeAttr(id)}" />`
  }).join('')

  return `
  <div class="map-shell" id="map-shell">
    <svg class="map" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="World map">
      <path class="graticule" d="${graticule}" />
      <g class="countries">${countries}</g>
      <g class="pins">${pins}</g>
    </svg>
    <div class="map-vignette"></div>
    <div class="map-scanline"></div>
  </div>`
}

/** delegate clicks once; the map is re-rendered as innerHTML on every state change */
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
