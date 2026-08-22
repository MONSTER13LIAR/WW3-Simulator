/**
 * Dot-matrix typesetter.
 *
 * The title is drawn as a physical LED panel: every cell in the panel grid gets
 * a dot, the lit ones spell the word. Keeping the unlit dots is the whole look —
 * without them it reads as a stencil font instead of a board.
 *
 * Glyphs are 5x7 bitmaps, the classic display-board cell.
 */

import { flagDefs, flagAt } from './flags'

/** Flag cells are fatter than plain dots, so the panel reads as a ball pit. */
const FLAG_R = 0.44
const DOT_R = 0.30
/** The letterform reads over the board when its cells are clearly the bigger ones. */
const LIT_R = 0.42

const ROWS = 7
const COLS = 5

const FONT: Record<string, string[]> = {
  A: ['.XXX.', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
  E: ['XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'XXXXX'],
  I: ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', 'XXXXX'],
  L: ['X....', 'X....', 'X....', 'X....', 'X....', 'X....', 'XXXXX'],
  M: ['X...X', 'XX.XX', 'X.X.X', 'X.X.X', 'X...X', 'X...X', 'X...X'],
  O: ['.XXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'],
  R: ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X..X.', 'X...X', 'X...X'],
  S: ['.XXX.', 'X...X', 'X....', '.XXX.', '....X', 'X...X', '.XXX.'],
  T: ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', '..X..'],
  U: ['X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'],
  W: ['X...X', 'X...X', 'X...X', 'X.X.X', 'X.X.X', 'XX.XX', 'X...X'],
  '3': ['.XXX.', 'X...X', '....X', '..XX.', '....X', 'X...X', '.XXX.'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
}

type Options = {
  /** Extra dot columns between glyphs. */
  tracking?: number
  /** Class added to the <svg>, for sizing and colour. */
  className?: string
  /** Dots animate in from this index onward, so stacked lines cascade. */
  delayOffset?: number
  /**
   * Glyph indices whose cells are drawn as circular country flags instead of
   * plain dots. Lit cells take the front of the flag list — the playable
   * states — and the unlit ones fill in behind the word.
   */
  flagGlyphs?: number[]
}

/**
 * A little life in the board: every second, 4–5 of each letter's unlit cells
 * flick to cyan and the previous ones go dark again. The lit cells — the
 * letterform — are never touched. Returns a stop function.
 */
export function sparkle(svg: Element, perGlyph = 4): () => void {
  const byGlyph = new Map<string, Element[]>()
  for (const d of svg.querySelectorAll('.dot[data-g]')) {
    const g = (d as HTMLElement).dataset.g!
    ;(byGlyph.get(g) ?? byGlyph.set(g, []).get(g)!).push(d)
  }
  let current: Element[] = []
  const tick = () => {
    for (const d of current) d.classList.remove('dot--spark')
    current = []
    for (const cells of byGlyph.values()) {
      const n = perGlyph + (Math.random() < 0.5 ? 1 : 0)
      const pool = [...cells]
      for (let k = 0; k < n && pool.length; k++) {
        const [d] = pool.splice(Math.floor(Math.random() * pool.length), 1)
        d.classList.add('dot--spark')
        current.push(d)
      }
    }
  }
  tick()
  const timer = setInterval(tick, 1000)
  return () => { clearInterval(timer); for (const d of current) d.classList.remove('dot--spark') }
}

/**
 * Renders `text` as an SVG dot grid. The viewBox is measured in cells, so the
 * caller sizes it with plain CSS width and the dots stay perfectly round.
 */
export function dotType(text: string, opts: Options = {}): string {
  const { tracking = 1, className = '', delayOffset = 0, flagGlyphs = [] } = opts
  const flagged = new Set(flagGlyphs)
  const chars = [...text.toUpperCase()].filter(c => c in FONT)
  if (!chars.length) return ''

  const cols = chars.length * COLS + (chars.length - 1) * tracking
  const dots: string[] = []
  /* Only the lit cells carry artwork, so this collects exactly the countries
     that need a <symbol> emitting. */
  const used: string[] = []
  let litSeq = 0

  chars.forEach((char, i) => {
    const glyph = FONT[char]
    const originX = i * (COLS + tracking)

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (char === ' ') continue
        const lit = glyph[y][x] === 'X'
        const cx = originX + x
        // Diagonal cascade: dots light up left-to-right, top-to-bottom.
        const step = delayOffset + cx * 7 + y * 4

        /* A flagged glyph is flags and nothing else — its unlit cells are
           dropped rather than drawn as dots, so the countries read as the
           letterform on their own. Unflagged glyphs keep the full panel grid,
           which is what still makes SIMULATOR read as a display board. */
        if (flagged.has(i) && !lit) continue

        if (flagged.has(i)) {
          const code = flagAt(litSeq++)
          used.push(code)
          /* Two layers on purpose. The wrapper owns the entry animation, which
             runs with fill-mode forwards and would otherwise keep pinning
             transform after it finished, outranking the hover rule. The inner
             <use> is left free to be transformed on hover.

             Both carry an explicit origin at the cell's centre, in view-box
             units. `transform-box: fill-box` is the obvious way to say the same
             thing and Chromium reports honouring it on <use>, but scales about
             the SVG root anyway — which slides the flag sideways as it grows,
             out from under the cursor, so :hover drops and it oscillates. */
          const origin = `transform-origin:${cx + 0.5}px ${y + 0.5}px`
          dots.push(
            `<g class="flagcell" style="--d:${step}ms;${origin}">` +
            `<use href="#flag-${code}" x="${cx + 0.5 - FLAG_R}" y="${y + 0.5 - FLAG_R}"` +
            ` width="${FLAG_R * 2}" height="${FLAG_R * 2}"` +
            ` class="flagdot" style="${origin}" data-country="${code}"/>` +
            `</g>`
          )
          continue
        }

        // unlit cells carry their glyph index so the sparkle can pick per letter
        dots.push(
          `<circle cx="${cx + 0.5}" cy="${y + 0.5}" r="${lit ? LIT_R : DOT_R}"` +
          ` class="dot${lit ? ' dot--lit' : ''}" style="--d:${step}ms"${lit ? '' : ` data-g="${i}"`}/>`
        )
      }
    }
  })

  return `<svg class="dotgrid ${className}" viewBox="0 0 ${cols} ${ROWS}"
    role="img" aria-label="${text}" preserveAspectRatio="xMidYMid meet">${flagDefs(used)}${dots.join('')}</svg>`
}
