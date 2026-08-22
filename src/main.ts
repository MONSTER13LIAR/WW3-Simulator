import './styles/tokens.css'
import './styles/base.css'
import './styles/app.css'

import { state, subscribe } from './state/store'
import type { Screen } from './state/types'
import { renderSplash, bindSplash } from './screens/splash'
import { renderHowTo, bindHowTo } from './screens/howTo'
import { renderSelect, bindSelect } from './screens/countrySelect'
import { renderGame, bindGame, updateGame } from './screens/game'
import { renderEnding, bindEnding } from './screens/ending'
import { clearFx } from './components/fx'
import { stopClock } from './state/turn'

// dev only: lets a browser driver read the store without a UI round-trip
if (import.meta.env.DEV) (window as unknown as { __ww3: unknown }).__ww3 = state

const app = document.getElementById('app')!

/** Which screen is currently in the document, so we only remount on a change. */
let mountedScreen: Screen | null = null

function mount() {
  switch (state.screen) {
    case 'splash': app.innerHTML = renderSplash(); bindSplash(app); break
    case 'howto':  app.innerHTML = renderHowTo();  bindHowTo(app);  break
    case 'select': app.innerHTML = renderSelect(); bindSelect(app); break
    case 'game':   app.innerHTML = renderGame();   bindGame(app);   break
    case 'ending': app.innerHTML = renderEnding(); bindEnding(app); break
  }
  mountedScreen = state.screen
}

/**
 * Replacing #app on every emit meant the fresh .screen element replayed its
 * fade-in each time — a full-page flash on every message, channel switch and
 * typing indicator. The screen is built once and patched from then on; only
 * the game screen has anything that changes while it is open.
 */
function render() {
  if (state.screen !== 'game') { clearFx(); stopClock() }

  if (state.screen !== mountedScreen) {
    mount()
    return
  }

  if (state.screen === 'game') updateGame(app)
}

subscribe(render)
render()
