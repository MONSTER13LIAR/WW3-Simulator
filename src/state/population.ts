import type { CountryId, Region } from './types'

/**
 * Real populations, fetched once from the World Bank's SP.POP.TOTL indicator
 * (2025 observations, dataset last updated 2026-07-13) and frozen here. These
 * are the game's reality: nothing re-fetches them at runtime, so a session is
 * reproducible and works offline.
 *
 * https://api.worldbank.org/v2/country/{iso3}/indicator/SP.POP.TOTL
 */
export const POPULATION: Record<CountryId, number> = {
  'India': 1_463_865_525,
  'China': 1_406_585_000,
  'United States of America': 341_784_857,
  'Brazil': 212_812_405,
  'Russia': 143_513_328,
  'Japan': 123_366_734,
  'Germany': 83_491_249,
  'United Kingdom': 69_487_000,
  'France': 68_720_337,
  'Canada': 41_651_653,
  'Australia': 27_614_411,
  'Switzerland': 9_092_436,
  'Israel': 10_052_500,
  'Iran': 92_417_681,
}

/** Everyone alive at the start, for "x% of the world" style readouts. */
export const WORLD_POPULATION = Object.values(POPULATION).reduce((a, b) => a + b, 0)

/**
 * A warhead does not empty a country — it takes a share of whoever is still
 * there. The band is wide enough that two identical strikes read differently,
 * which matters because the toll is the only number the player really feels.
 */
const KILL_MIN = 0.20
const KILL_MAX = 0.30

/**
 * How much of a country lives in each quarter of it. Nobody's people are spread
 * evenly; a strike on the crowded quarter takes the top of the band, a strike
 * on the empty one the bottom. Values are a weight, not a share.
 */
export const REGION_WEIGHT: Record<CountryId, Record<Region, number>> = {
  'India':                    { north: 1.2, south: 1.0, east: 1.1, west: 0.8 },
  'China':                    { north: 0.9, south: 1.0, east: 1.3, west: 0.4 },
  'United States of America': { north: 0.9, south: 0.9, east: 1.3, west: 0.8 },
  'Brazil':                   { north: 0.5, south: 1.1, east: 1.3, west: 0.5 },
  'Russia':                   { north: 0.5, south: 0.9, east: 0.5, west: 1.4 },
  'Japan':                    { north: 0.6, south: 1.0, east: 1.3, west: 0.9 },
  'Germany':                  { north: 1.0, south: 1.1, east: 0.8, west: 1.3 },
  'United Kingdom':           { north: 0.7, south: 1.4, east: 1.0, west: 0.9 },
  'France':                   { north: 1.4, south: 1.0, east: 0.9, west: 0.8 },
  'Canada':                   { north: 0.2, south: 1.4, east: 1.1, west: 0.9 },
  'Australia':                { north: 0.4, south: 1.2, east: 1.4, west: 0.7 },
  'Switzerland':              { north: 1.2, south: 0.7, east: 0.9, west: 1.0 },
  'Israel':                   { north: 1.1, south: 0.4, east: 0.9, west: 1.4 },
  'Iran':                     { north: 1.3, south: 0.6, east: 1.0, west: 1.2 },
}

/**
 * People killed by one warhead landing on `region` of a country with `living`
 * survivors: 20–30 % of them, the exact share set by how crowded that quarter is.
 */
export function strikeToll(living: number, id: CountryId, region: Region): number {
  const w = REGION_WEIGHT[id]?.[region] ?? 1
  // weight 0.2..1.4 -> 0..1 across the band
  const t = Math.max(0, Math.min(1, (w - 0.2) / 1.2))
  const share = KILL_MIN + t * (KILL_MAX - KILL_MIN)
  return Math.min(living, Math.round(living * share))
}

/**
 * Daily growth. A strong economy adds people, a wrecked one loses them — at a
 * tiny per-day rate so a fortnight moves the number visibly, not absurdly.
 */
export function dailyGrowth(living: number, economy: number): number {
  const rate = (economy - 40) / 100 * 0.006   // economy 100 → +0.36 %/day, 0 → -0.24 %
  return Math.round(living * rate)
}

/** 1_463_865_525 -> "1.46B". Short enough for a chip, precise enough to sting. */
export function formatPop(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e7) return `${(n / 1e6).toFixed(0)}M`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return String(n)
}

/** Every digit, for the places where the whole number is the point. */
export const formatExact = (n: number): string => n.toLocaleString('en-US')
