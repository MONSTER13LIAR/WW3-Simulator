/** The one arrow used across the app, so every button reveals the same mark. */
const path = (d: string) =>
  `<svg viewBox="0 0 22 12" fill="none" aria-hidden="true"><path d="${d}" stroke="currentColor"
    stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`

export const arrowRight = () => path('M1 6h18M14 1l5 5-5 5')
export const arrowLeft = () => path('M21 6H3M8 1L3 6l5 5')
