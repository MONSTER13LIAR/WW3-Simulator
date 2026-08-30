/**
 * Circular country flags for the dot-matrix panel.
 *
 * The artwork is the official circle-flags set (MIT, github.com/HatScripts/circle-flags)
 * vendored into src/assets/flags — every file is already masked to a circle, so a flag
 * drops straight into a dot's slot without any cropping of our own.
 *
 * Each flag is emitted once as a <symbol> and then referenced per cell with <use>, so a
 * panel that repeats forty countries across a hundred cells still ships forty copies of
 * the artwork rather than a hundred.
 */

const RAW = import.meta.glob('../assets/flags/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** ISO code -> raw svg source, keyed off the filename. */
const SOURCE: Record<string, string> = {}
for (const path in RAW) {
  const code = path.slice(path.lastIndexOf('/') + 1, -4)
  SOURCE[code] = RAW[path]
}

/**
 * Draw order. The fourteen playable states come first so they take the opening cells
 * of the panel; the rest fills out the remaining lit cells. Fifty entries for the
 * fifty lit cells in WW3, so every country appears exactly once.
 */
export const FLAG_CODES = [
  // playable
  'us', 'ru', 'cn', 'in', 'jp', 'de', 'fr', 'gb', 'br', 'au', 'ca', 'ch', 'il', 'ir',
  // widely recognised
  'kr', 'it', 'es', 'mx', 'za', 'ar', 'eg', 'tr', 'se', 'no', 'dk', 'fi',
  'nl', 'be', 'pt', 'gr', 'pl', 'ua', 'sa', 'pk', 'id', 'th',
  'vn', 'ph', 'ng', 'ke', 'my', 'sg', 'nz', 'ie', 'at', 'cz', 'hu', 'ro',
  'cl', 'co',
].filter(code => code in SOURCE)

/**
 * The edge ring. Flags with white fields — Japan, Singapore, Poland, Argentina,
 * Czechia — dissolve into a paper background without one, which breaks the
 * letterform they are supposed to be spelling. Drawn wholly inside r=256 so the
 * ring never enlarges the circle: an outward stroke would push each flag past
 * its cell and start overlapping neighbours once hover scales it.
 *
 * On dark flags it is all but invisible, which is the point — only the ones that
 * need an edge get a visible one.
 */
const RING = '<circle cx="256" cy="256" r="249" fill="none"'
  + ' stroke="rgba(20,40,74,.42)" stroke-width="14"/>'

/**
 * Rewrites one flag file into a <symbol>.
 *
 * Every source file declares its circular mask as id="a". Inlining more than one of
 * them into a single document would leave every url(#a) pointing at whichever landed
 * first, so the id is namespaced per country on the way in.
 */
function toSymbol(code: string): string {
  const body = SOURCE[code]
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/id="a"/g, `id="fm-${code}"`)
    .replace(/url\(#a\)/g, `url(#fm-${code})`)

  // Ring last, so it sits over the artwork rather than under the mask.
  return `<symbol id="flag-${code}" viewBox="0 0 512 512">${body}${RING}</symbol>`
}

/** A <defs> block holding one <symbol> per distinct code, in the order given. */
export function flagDefs(codes: string[]): string {
  const seen = new Set(codes.filter(c => c in SOURCE))
  if (!seen.size) return ''
  return `<defs>${[...seen].map(toSymbol).join('')}</defs>`
}

/** Cycles the palette so a panel larger than the list still fills. */
export function flagAt(i: number): string {
  return FLAG_CODES[i % FLAG_CODES.length]
}
