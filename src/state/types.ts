/** Stable key we use everywhere; matches `properties.name` in world-atlas topojson. */
export type CountryId = string

export type Relation = 'self' | 'ally' | 'neutral' | 'war' | 'destroyed'

/** Chat threads: the room, a DM with one leader, or intercepted traffic between two AIs. */
export type Channel = CountryId | 'GLOBAL' | 'INTERCEPT'

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
  /** scales every trust swing — how hard they overreact */
  volatility: number
  /** 0–1 chance per day of inventing a reason to be upset with you */
  pettiness: number
  /** the absurd things they take personally, used verbatim as grudges */
  grievances: string[]
}

export interface Stats {
  military: number
  economy: number
  morale: number
  standing: number
}

/** One thing a leader has not forgotten. Fed to the model verbatim. */
export interface Grudge {
  day: number
  note: string
}

export interface LeaderMemory {
  /** -100 (wants you gone) .. 100 (would take a bullet for you) */
  trust: number
  grudges: Grudge[]
  /** other AI leaders they have paired off with, usually against you */
  bloc: CountryId[]
  /** warheads this leader has fired */
  nukes: number
  /** day the player last messaged them; 0 = never */
  lastContact: number
}

export type MsgKind = 'said' | 'system' | 'action'

export interface ChatMsg {
  id: string
  /** country id, or 'SYSTEM' */
  from: CountryId | 'SYSTEM'
  channel: Channel
  text: string
  kind: MsgKind
  /** in-game day */
  day: number
  /** set on intercepts: who the line was actually addressed to */
  to?: CountryId
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
  /** country id -> what that leader thinks of you and remembers */
  memory: Record<CountryId, LeaderMemory>
  messages: ChatMsg[]
  /** which chat thread the right rail is showing */
  openChannel: Channel
  unread: Record<string, number>
  stats: Stats
  /** warheads the player has fired */
  nukesLaunched: number
  /** every warhead fired by anyone */
  worldNukes: number
  /** country id -> people still alive there */
  population: Record<CountryId, number>
  /** everyone killed so far, worldwide */
  deaths: number
  /** true once the player's own country is gone */
  playerDestroyed: boolean
  /** messages the player has sent, all channels — drives the Forgotten ending */
  playerMessages: number
  /** the world is resolving a turn; orders are locked */
  resolving: boolean
  /** everyone mid-reply, so the indicators survive re-renders */
  typing: Array<{ channel: string; leaderId: string }>
  ending: EndingId | null
}
