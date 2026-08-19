/** Stable key we use everywhere; matches `properties.name` in world-atlas topojson. */
export type CountryId = string

export type Relation = 'self' | 'ally' | 'neutral' | 'war' | 'destroyed'

export interface Leader {
  /** topojson country name — the join key between data and map geometry */
  id: CountryId
  /** short label for HUD + chat rows */
  short: string
  flag: string
  leader: string
  /** the absurd one-liner shown on the pick screen */
  doctrine: string
  /** seeds the persona prompt later; government-archetype humour only */
  persona: string
  stats: Stats
}

export interface Stats {
  military: number
  economy: number
  morale: number
  standing: number
}

export type MsgKind = 'said' | 'system' | 'action'

export interface ChatMsg {
  id: string
  /** country id, or 'SYSTEM' */
  from: CountryId | 'SYSTEM'
  /** country id for a DM, or 'GLOBAL' */
  channel: CountryId | 'GLOBAL'
  text: string
  kind: MsgKind
  /** in-game day */
  day: number
}

export type EndingId =
  | 'annihilation' | 'victory' | 'colonized' | 'debt'
  | 'coup' | 'exile' | 'peace' | 'forgotten'

export interface Ending {
  id: EndingId
  title: string
  verdict: string
  blurb: string
  tone: 'bad' | 'good' | 'absurd'
}

export type Screen = 'splash' | 'select' | 'game' | 'ending'

export interface GameState {
  screen: Screen
  day: number
  defcon: number
  playerId: CountryId | null
  /** country id -> relation to the player */
  relations: Record<CountryId, Relation>
  messages: ChatMsg[]
  /** which chat thread the right rail is showing */
  openChannel: CountryId | 'GLOBAL'
  unread: Record<string, number>
  stats: Stats
  nukesLaunched: number
  ending: EndingId | null
}
