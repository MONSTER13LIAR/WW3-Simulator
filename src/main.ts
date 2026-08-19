import './styles/tokens.css'
import './styles/base.css'
import './styles/app.css'

import { state, subscribe } from './state/store'
import { renderSplash, bindSplash } from './screens/splash'
import { renderSelect, bindSelect } from './screens/countrySelect'
import { renderGame, bindGame } from './screens/game'
import { renderEnding, bindEnding } from './screens/ending'
import { clearFx } from './components/fx'

const app = document.getElementById('app')!

function render() {
  if (state.screen !== 'game') clearFx()

  switch (state.screen) {
    case 'splash': app.innerHTML = renderSplash(); bindSplash(app); break
    case 'select': app.innerHTML = renderSelect(); bindSelect(app); break
    case 'game':   app.innerHTML = renderGame();   bindGame(app);   break
    case 'ending': app.innerHTML = renderEnding(); bindEnding(app); break
  }
}

subscribe(render)
render()
