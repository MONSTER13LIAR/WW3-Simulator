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
const DOT_R = 0.34

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

        /* In a flagged glyph only the lit cells become flags. The unlit ones
           stay plain dots — drawn at the flag radius so the grid pitch matches —
           because real flags ghosted back far enough to sit behind the word
           carry wildly uneven lightness (Japan and Switzerland all but vanish,
           Germany stays dark) and turn the panel to noise. */
        if (flagged.has(i) && lit) {
          const code = flagAt(litSeq++)
          used.push(code)
          /* Two layers on purpose. The wrapper owns the entry animation, which
             runs with fill-mode forwards and would otherwise keep pinning
             transform after it finished, outranking the hover rule. The inner
             <use> is left free to be transformed on hover. */
          dots.push(
            `<g class="flagcell" style="--d:${step}ms">` +
            `<use href="#flag-${code}" x="${cx + 0.5 - FLAG_R}" y="${y + 0.5 - FLAG_R}"` +
            ` width="${FLAG_R * 2}" height="${FLAG_R * 2}"` +
            ` class="flagdot" data-country="${code}"/>` +
            `</g>`
          )
          continue
        }

        const r = flagged.has(i) ? FLAG_R : DOT_R
        dots.push(
          `<circle cx="${cx + 0.5}" cy="${y + 0.5}" r="${r}"` +
          ` class="dot${lit ? ' dot--lit' : ''}" style="--d:${step}ms"/>`
        )
      }
    }
  })

  /* The magnifier. SVG paints in document order and has no z-index, so a flag
     that grew in place would be covered by every cell declared after it. Rather
     than re-parent the hovered cell — which drops :hover in Chromium, because
     hover is not re-evaluated when the node under the cursor is moved — this
     sits last, permanently on top, and mirrors whichever flag is hovered. It
     rests at exactly the size and position of the cell it is covering, so
     shrinking back is seamless. */
  const zoom = used.length
    ? '<use class="flagzoom" aria-hidden="true" pointer-events="none"/>'
    : ''

  return `<svg class="dotgrid ${className}" viewBox="0 0 ${cols} ${ROWS}"
    role="img" aria-label="${text}" preserveAspectRatio="xMidYMid meet">${flagDefs(used)}${dots.join('')}${zoom}</svg>`
}
