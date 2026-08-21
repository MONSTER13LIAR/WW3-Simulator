/**
 * Neoclassical column for the landing page edges.
 *
 * Drawn in the lobby's own palette rather than the sandy tones the style
 * usually comes in — a pale ink-tinted stone, so it reads as architecture
 * without competing with the flags for attention.
 *
 * Built from stacked blocks rather than one image so the shaft can flex to any
 * viewport height while the capital and base keep their proportions: a column
 * whose capital stretched with the window would stop reading as stone.
 */
export function pillar(side: 'left' | 'right'): string {
  return `
  <div class="pillar pillar--${side}" aria-hidden="true">
    <div class="pillar-cap">
      <i class="pillar-abacus"></i>
      <i class="pillar-echinus"></i>
      <i class="pillar-necking"></i>
    </div>
    <div class="pillar-shaft"></div>
    <div class="pillar-foot">
      <i class="pillar-necking"></i>
      <i class="pillar-torus"></i>
      <i class="pillar-plinth"></i>
    </div>
  </div>`
}
