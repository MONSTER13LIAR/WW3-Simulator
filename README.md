# WW3 Simulator

You are a head of state in a group chat with eleven others. One of them just launched. Fourteen days later the world has either made peace, made you its ruler, or stopped existing.

Every other leader is played by a language model with a posture, a volatility, and a memory of everything you have done to them. They overreact, hold grudges, DM each other behind your back, and occasionally fire a warhead because you left them on read.

## Playing

- **Pick a country.** Twelve are playable, each with its own military, economy, morale and standing.
- **The opening crisis.** One state strikes another. The room splits. You pick a side and get an alliance channel.
- **The room.** A global channel, private DMs with every leader, your alliance, and an intercept feed of traffic the others think you cannot read.
- **Orders.** Diplomacy, alliances, sanctions, mobilisation, propaganda, invasion, supplies to allies, walking out of a pact — and the launch button. Every order shows its cost on hover and asks once before it goes through.
- **The world moves without you.** One real minute is one day. Each day one to five things happen on the map: blockades, seized straits, armour over a border, submarines off your coast, a satellite shot down, a coup, a leader killed in a motorcade. Roughly half of them put a decision to you with consequences either way.
- **Endings.** Peace treaty, victory, annihilation, colonised, debt, coup, exile, forgotten. A run is ten to fifteen minutes. Nothing saves you from the consequences of the previous one.

## Running it

```
npm install
npm run dev        # http://localhost:3000
```

Leader dialogue comes from a model behind `/api/leader`. Put a Featherless key in `.env`:

```
FEATHERLESS_API_KEY=...
FEATHERLESS_MODEL=Qwen/Qwen3-30B-A3B-Instruct-2507
```

Without a key the game still plays — every leader falls back to scripted lines. The key never reaches the browser; the Vite dev server and the Vercel function both call the model server-side with a per-IP rate limit.

`npm run build` type-checks and produces `dist/`. Deploys as a static site plus one serverless function (`api/leader.ts`).

## Stack

TypeScript, Vite, no framework. The map is `d3-geo` over `world-atlas` topojson; animations are SVG on a body-level overlay so state re-renders never cut a missile mid-flight. Game state is a single store with a localStorage save, so a refresh lands back in the same day.

## Disclaimer

Every leader is invented. No real politician is depicted; national character colours how a state speaks, never what it decides. It is a game about how wars start over nothing.
