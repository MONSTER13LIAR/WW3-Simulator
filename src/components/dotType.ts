/**
 * Dot-matrix typesetter.
 *
 * The title is drawn as a physical LED panel: every cell in the panel grid gets
 * a dot, the lit ones spell the word. Keeping the unlit dots is the whole look —
 * without them it reads as a stencil font instead of a board.
 *
 * Glyphs are 5x7 bitmaps, the classic display-board cell.
 */

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
}

/**
 * Renders `text` as an SVG dot grid. The viewBox is measured in cells, so the
 * caller sizes it with plain CSS width and the dots stay perfectly round.
 */
export function dotType(text: string, opts: Options = {}): string {
  const { tracking = 1, className = '', delayOffset = 0 } = opts
  const chars = [...text.toUpperCase()].filter(c => c in FONT)
  if (!chars.length) return ''

  const cols = chars.length * COLS + (chars.length - 1) * tracking
  const dots: string[] = []

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
        dots.push(
          `<circle cx="${cx + 0.5}" cy="${y + 0.5}" r="0.34"` +
          ` class="dot${lit ? ' dot--lit' : ''}" style="--d:${step}ms"/>`
        )
      }
    }
  })

  return `<svg class="dotgrid ${className}" viewBox="0 0 ${cols} ${ROWS}"
    role="img" aria-label="${text}" preserveAspectRatio="xMidYMid meet">${dots.join('')}</svg>`
}
