/** Stable key we use everywhere; matches `properties.name` in world-atlas topojson. */
export type CountryId = string

export type Relation = 'self' | 'ally' | 'neutral' | 'war' | 'destroyed'

/** Quarter of a country a strike is aimed at. The map has no internal borders,
    so a region is a quadrant around the centroid. */
export type Region = 'north' | 'south' | 'east' | 'west'
export const REGIONS: Region[] = ['north', 'west', 'east', 'south']

/** One warhead landing somewhere — the war's event log. */
export interface Strike {
  day: number
  from: CountryId
  to: CountryId
  region: Region
  dead: number
}

/** Chat threads: the room, a DM with one leader, intercepted traffic between two AIs, or your alliance. */
export type Channel = CountryId | 'GLOBAL' | 'INTERCEPT' | 'BLOC'

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

export type MsgKind = 'said' | 'system' | 'action' | 'choice' | 'treaty'

/** A decision put to the player inside the chat: two sides, one click. */
export interface Choice {
  options: Array<{ label: string; members: CountryId[] }>
  /** which world event this decision belongs to; routes the answer */
  tag?: string
  /** the other state(s) the event concerns */
  who?: CountryId[]
  /** index picked, once picked */
  picked?: number
}

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
  /** set on kind 'choice' */
  choice?: Choice
}

/** The incident the game opens on: one state struck another and the room split over it. */
export interface Crisis {
  aggressor: CountryId
  victim: CountryId
  region: Region
  /** the aggressor's side and the victim's side, leaders included */
  sides: [CountryId[], CountryId[]]
}

/** guide → opening (the room argues, you pick a side) → play */
export type Phase = 'guide' | 'opening' | 'play'

export type EndingId =
  | 'annihilation' | 'victory' | 'colonized' | 'debt'
  | 'coup' | 'exile' | 'peace' | 'forgotten' | 'treaty'

export interface TreatyTerms {
  payer: CountryId[]
  payee: CountryId[]
  deadByPayer: number
  deadByPayee: number
  billions: number
  oilMillionBarrels: number
  grainMillionTonnes: number
  rebuildYears: number
}

export interface Treaty {
  status: 'offered' | 'received' | 'refused' | 'signed'
  by: 'us' | 'them'
  day: number
  terms: TreatyTerms
}

export interface Ending {
  id: EndingId
  title: string
  verdict: string
  blurb: string
  tone: 'bad' | 'good' | 'absurd'
}

export type Screen = 'splash' | 'howto' | 'select' | 'game' | 'ending'

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
  /** country id -> warheads still in the silo (every playable state has some) */
  bombs: Record<CountryId, number>
  /** territory id -> the country that now holds it; absent = self-governed */
  owner: Record<CountryId, CountryId>
  /** country id -> the countries it is formally allied with (symmetric) */
  alliances: Record<CountryId, CountryId[]>
  /** every warhead fired, in order */
  strikes: Strike[]
  /** set once, the day an alliance-backed attack is answered in kind */
  worldWar: boolean
  worldWarDay: number
  /** region the next launch is aimed at */
  targetRegion: Region
  phase: Phase
  crisis: Crisis | null
  /** the side the player joined (their alliance channel members) */
  bloc: CountryId[]
  treaty: Treaty | null
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
