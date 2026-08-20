import type { CountryId } from './types'

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
}

/** Everyone alive at the start, for "x% of the world" style readouts. */
export const WORLD_POPULATION = Object.values(POPULATION).reduce((a, b) => a + b, 0)

/**
 * A warhead does not empty a country — it takes a share of whoever is still
 * there. The band is wide enough that two identical strikes read differently,
 * which matters because the toll is the only number the player really feels.
 */
const KILL_MIN = 0.34
const KILL_MAX = 0.61

/** People killed by one warhead landing on `living` survivors. */
export function strikeToll(living: number): number {
  const share = KILL_MIN + Math.random() * (KILL_MAX - KILL_MIN)
  return Math.min(living, Math.round(living * share))
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
