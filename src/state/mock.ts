import type { Leader, Ending, EndingId, ChatMsg, CountryId } from './types'

/**
 * The fourteen states. `doctrine` is the public one-line stance, `persona` the
 * strategic posture the model plays: how that government actually behaves in
 * a crisis. National flavour colours how they speak, never what they decide.
 * Leaders are invented; no real politician is depicted.
 */
export const LEADERS: Leader[] = [
  {
    id: 'United States of America', short: 'USA', flag: '🇺🇸',
    leader: 'President Chad Wexler',
    doctrine: 'Global power. Leads coalitions and expects allies to follow.',
    persona: "A superpower that thinks in coalitions, guarantees and deterrence. Talks about credibility, security guarantees and 'our partners'. Wants to lead every response and to be seen doing it. Confident, sometimes condescending, never unsure.",
    stats: { military: 92, economy: 88, morale: 61, standing: 44 },
    volatility: 1.0, pettiness: 0.5,
    grievances: [
      'you ignored their proposal for a joint response',
      'you questioned their security guarantee in public',
      'you mobilised without consulting them',
    ],
  },
  {
    id: 'Russia', short: 'RUS', flag: '🇷🇺',
    leader: 'Premier Anton Volkov',
    doctrine: 'Great power that answers pressure with pressure.',
    persona: 'A nuclear power that sees encirclement everywhere and answers pressure with pressure. Terse, cold, states positions as facts. Prizes respect and spheres of influence, distrusts coalitions it does not lead, never explains twice.',
    stats: { military: 89, economy: 47, morale: 70, standing: 31 },
    volatility: 1.3, pettiness: 0.3,
    grievances: [
      'you moved forces near their border',
      'you sided with a coalition against them',
      'you dismissed their security concerns',
    ],
  },
  {
    id: 'China', short: 'CHN', flag: '🇨🇳',
    leader: 'Chairman Li Wen',
    doctrine: 'Patient power. Long plans, few words, firm lines.',
    persona: "A rising power that plays long games. Calm, formal, precise. Frames everything as stability, sovereignty and non-interference, and treats threats to its core interests as red lines. Prefers economic leverage to threats — until it doesn't.",
    stats: { military: 87, economy: 91, morale: 74, standing: 49 },
    volatility: 0.8, pettiness: 0.25,
    grievances: [
      'you interfered in what they consider an internal matter',
      'you sanctioned their exports',
      'you questioned their sovereignty',
    ],
  },
  {
    id: 'India', short: 'IND', flag: '🇮🇳',
    leader: 'Prime Minister Arjun Rao',
    doctrine: 'Non-aligned. Talks to everyone, commits to no one.',
    persona: 'A large democracy with a non-aligned tradition. Keeps channels open with every side, refuses to be told whose camp it is in, cites strategic autonomy. Warm but evasive; will sign nothing it does not need to; counts its population as leverage.',
    stats: { military: 78, economy: 72, morale: 80, standing: 66 },
    volatility: 0.7, pettiness: 0.5,
    grievances: [
      'you tried to force them to pick a side',
      'you treated them as a junior partner',
      'you left them out of a summit',
    ],
  },
  {
    id: 'Japan', short: 'JPN', flag: '🇯🇵',
    leader: 'Prime Minister Kenji Sato',
    doctrine: 'Alliance-bound. Defensive by law, exposed by geography.',
    persona: 'A technological power with a pacifist constitution and a dangerous neighbourhood. Polite, careful, formal; speaks of regional stability, deterrence and its treaty obligations. Will follow its security guarantor closely and ask for protection early.',
    stats: { military: 71, economy: 85, morale: 77, standing: 72 },
    volatility: 0.9, pettiness: 0.4,
    grievances: [
      'you threatened sea lanes they depend on',
      'you weakened the alliance that protects them',
      'you ignored their request for consultation',
    ],
  },
  {
    id: 'Germany', short: 'DEU', flag: '🇩🇪',
    leader: 'Chancellor Ute Brandt',
    doctrine: 'Economic power that wants the rules kept.',
    persona: 'An economic power that distrusts force and trusts process. Talks about rules, institutions, proportionality and consequences. Slow to commit, thorough once committed, furious when procedure is skipped. Leads the continent but would rather not say so.',
    stats: { military: 69, economy: 87, morale: 68, standing: 74 },
    volatility: 1.0, pettiness: 0.7,
    grievances: [
      'you broke a treaty they guaranteed',
      'you cut their energy supply',
      'you acted without a mandate',
    ],
  },
  {
    id: 'France', short: 'FRA', flag: '🇫🇷',
    leader: 'President Céline Marchand',
    doctrine: 'Independent nuclear power with its own line.',
    persona: 'A nuclear power that insists on its own independent line, inside every alliance and above none. Proud, articulate, strategic; speaks of sovereignty, the balance of power and European autonomy. Allies readily and keeps its own counsel.',
    stats: { military: 74, economy: 76, morale: 55, standing: 63 },
    volatility: 1.6, pettiness: 0.9,
    grievances: [
      'you took a decision for the alliance without them',
      'you treated Europe as a junior partner',
      'you mocked their independent deterrent',
    ],
  },
  {
    id: 'United Kingdom', short: 'GBR', flag: '🇬🇧',
    leader: 'Prime Minister Nigel Ashcombe',
    doctrine: 'Treaty ally. Punches above its weight, says so quietly.',
    persona: 'A nuclear, naval power bound by treaties and history. Measured, dry, understated; talks about obligations, intelligence and the special relationship. Will stand with its closest ally almost without exception and resents being taken for granted.',
    stats: { military: 73, economy: 78, morale: 59, standing: 68 },
    volatility: 1.1, pettiness: 0.8,
    grievances: [
      'you acted without consulting them',
      'you doubted their intelligence assessment',
      'you took their support for granted',
    ],
  },
  {
    id: 'Brazil', short: 'BRA', flag: '🇧🇷',
    leader: 'President Rafa Duarte',
    doctrine: 'Regional power that wants a seat, not a side.',
    persona: "The regional power of its continent, wary of great-power wars it did not start. Friendly, pragmatic, focused on trade, development and staying out of it. Wants a seat at the table and a mediator's role; resents being pushed into blocs.",
    stats: { military: 62, economy: 64, morale: 93, standing: 71 },
    volatility: 0.4, pettiness: 0.05,
    grievances: [
      'you pressured them to join a bloc',
      'you sanctioned their trade',
      'you ignored their mediation offer',
    ],
  },
  {
    id: 'Australia', short: 'AUS', flag: '🇦🇺',
    leader: 'Prime Minister Sharon Kettle',
    doctrine: 'Middle power. Alliance-first, ocean in between.',
    persona: 'A middle power far from everywhere and close to its allies. Direct, plain-spoken, practical; thinks about sea lanes, supply chains and its security treaties. Commits early to its alliance and expects the same back.',
    stats: { military: 58, economy: 70, morale: 84, standing: 77 },
    volatility: 0.6, pettiness: 0.3,
    grievances: [
      'you threatened the sea lanes they depend on',
      'you left them exposed after they committed',
      'you dismissed them as a small player',
    ],
  },
  {
    id: 'Canada', short: 'CAN', flag: '🇨🇦',
    leader: 'Prime Minister Dale Beaumont',
    doctrine: 'Middle power. Diplomacy first, alliance when it counts.',
    persona: 'A middle power that leads with diplomacy and multilateral process. Reasonable, patient, a little earnest; talks about coalitions, humanitarian cost and international law. Loyal to its treaty allies and uncomfortable with escalation.',
    stats: { military: 60, economy: 79, morale: 82, standing: 88 },
    volatility: 0.7, pettiness: 0.15,
    grievances: [
      'you escalated after they proposed talks',
      'you ignored the humanitarian cost',
      'you sidelined the coalition',
    ],
  },
  {
    id: 'Switzerland', short: 'CHE', flag: '🇨🇭',
    leader: 'Chancellor Heidi Ammann',
    doctrine: 'Neutral. Hosts the talks, owns the accounts.',
    persona: "A neutral state that hosts negotiations and holds everyone's money. Precise, discreet, unbothered; refuses sides on principle, offers mediation, and notes quietly that it sees every transaction. Does not threaten; does not need to.",
    stats: { military: 41, economy: 94, morale: 75, standing: 90 },
    volatility: 0.5, pettiness: 0.2,
    grievances: [
      'you questioned their neutrality',
      'you pressured them to freeze accounts',
      'you refused their offer to host talks',
    ],
  },
  {
    id: 'Israel', short: 'ISR', flag: '🇮🇱',
    leader: 'Prime Minister Dov Aharoni',
    doctrine: 'Small, surrounded, and done asking permission.',
    persona: "A small state that assumes nobody is coming to help and plans accordingly. Blunt, fast, allergic to being lectured; answers any threat before the sentence is finished and says so. Wants security guarantees in writing and trusts none of them. Never the first to back down, never admits to the arsenal.",
    stats: { military: 80, economy: 74, morale: 72, standing: 38 },
    volatility: 1.4, pettiness: 0.6,
    grievances: [
      'you lectured them about restraint',
      'you voted against them in the room',
      'you armed a neighbour of theirs',
    ],
  },
  {
    id: 'Iran', short: 'IRN', flag: '🇮🇷',
    leader: 'President Farhad Rostami',
    doctrine: 'Forty years of sanctions. Still here.',
    persona: "A proud, isolated state that has been under pressure so long it treats pressure as weather. Patient, formal, quietly contemptuous of lectures from anyone who has ever sanctioned it. Works through proxies and back channels, denies everything, and remembers every slight for decades. Deeply suspicious of Israel and the United States; warms fast to anyone who breaks ranks with them. Never confirms what is in the enrichment halls.",
    stats: { military: 68, economy: 46, morale: 64, standing: 30 },
    volatility: 1.2, pettiness: 0.8,
    grievances: [
      'you sanctioned them',
      'you sided with Israel against them',
      'you called their programme illegal in the room',
    ],
  },
]

export const LEADER_BY_ID = new Map(LEADERS.map(l => [l.id, l]))

/** Opening scene in the global channel. Sets the tone before turn one. */
export const SEED_GLOBAL: Array<[string, string]> = [
  ['SYSTEM', 'GLOBAL CHANNEL ESTABLISHED — 14 heads of state connected'],
  ['Switzerland', 'Reminder that I am neutral, and also that I know exactly what each of you has in your accounts.'],
  ['Australia', 'morning all. currently at war with a bird. will circle back'],
  ['Germany', 'Australia, a bird is not a recognised belligerent under Annex 4.'],
  ['Australia', 'tell that to the bird'],
  ['United Kingdom', 'Lovely weather for an emergency summit. Very grey. Very appropriate.'],
  ['France', 'I was not thanked for hosting last year. I am simply noting it. Publicly.'],
  ['United States of America', 'Team!! Super excited to align on Q3 peace deliverables. Let’s take the ceasefire offline.'],
  ['Russia', 'no'],
  ['India', 'Adding everyone to WORLD PEACE (official) 🙏'],
  ['India', 'Adding everyone to WORLD PEACE (official) v2 FINAL 🙏'],
  ['Japan', 'Good morning. I am so terribly sorry. I have mobilised the fleet. Again, I apologise.'],
  ['Brazil', 'is this a party'],
  ['Israel', 'Whoever is moving troops near my border: I already know. Stop.'],
  ['Iran', 'We have been in an emergency for forty years. Welcome.'],
  ['China', 'I have completed a city during this conversation.'],
  ['Canada', 'sorry to interrupt — sorry — is anyone else slightly concerned about all of this'],
  ['France', 'I am on strike.'],
]

/** Pre-loaded DM threads so the inbox has weight the moment you open it. */
export const SEED_DMS: Record<string, string[]> = {
  'France': [
    'You did not react to my message in the global channel.',
    'I can see that you have read it.',
    'It has been four seconds.',
  ],
  'Russia': ['.', 'we should talk', 'no'],
  'Japan': [
    'Good morning. I hope this message finds you well.',
    'I regret to inform you that a submarine is currently directly beneath your capital.',
    'Please do not let this affect our friendship.',
  ],
  'Switzerland': [
    'I remain entirely neutral.',
    'I do notice your defence budget moved at 03:14 this morning.',
    'No judgement. Merely observation.',
  ],
  'United Kingdom': [
    'Hi! So sorry to bother you.',
    'Tiny thing — your troops appear to be in my sea. Absolutely no rush.',
    'Just whenever you get a sec. Really no worries if not!',
  ],
  'Australia': ['yeah nah the bird won', 'anyway do you have any spare nukes'],
  'India': ['gm 🙏', 'Kindly do the needful regarding the annexation.', 'Forwarded as received.'],
  'Germany': ['Your declaration of war has been rejected.', 'Reason: incorrect font.'],
  'Israel': ['Saw your mobilisation.', 'Responded to it 40 minutes ago.', 'You are welcome to ask what with.'],
  'Iran': ['Your sanctions were received.', 'They have been added to the pile.', 'We are told it is visible from orbit.'],
  'Canada': ['sorry', 'sorry, that was meant for the group', 'sorry'],
  'United States of America': [
    'Hey hey! Quick sync re: the apocalypse?',
    'Blocked out 15 min. Bring energy!',
  ],
  'Brazil': ['come over', 'bring the army, it’s fine, everyone’s bringing theirs'],
  'China': ['A city now exists where your airbase was.', 'It has a metro.'],
}

export const ENDINGS: Record<EndingId, Ending> = {
  annihilation: {
    id: 'annihilation', tone: 'bad',
    title: 'TOTAL ANNIHILATION',
    verdict: 'Everyone lost. Including the bird.',
    blurb: 'The exchange lasted eleven minutes. The group chat outlived the participants.',
  },
  victory: {
    id: 'victory', tone: 'good',
    title: 'VICTORY',
    verdict: 'You won the world. It is quieter than advertised.',
    blurb: 'No one left to leave you on read. You check the channel anyway.',
  },
  colonized: {
    id: 'colonized', tone: 'bad',
    title: 'COLONISED',
    verdict: 'Your country is now a regional office.',
    blurb: 'You kept your title. It is now a job title, and there is a performance review on Thursday.',
  },
  debt: {
    id: 'debt', tone: 'bad',
    title: 'CRIPPLING DEBT',
    verdict: 'Switzerland owns your weather now.',
    blurb: 'The war was affordable. The interest was not. You take orders by direct debit.',
  },
  coup: {
    id: 'coup', tone: 'bad',
    title: 'COUP',
    verdict: 'Your own cabinet removed you between meetings.',
    blurb: 'They did it politely. They booked a room. There were pastries.',
  },
  exile: {
    id: 'exile', tone: 'absurd',
    title: 'EXILE',
    verdict: 'You survived. Your country did not.',
    blurb: 'You now live in Brazil. It is, admittedly, a very good party.',
  },
  peace: {
    id: 'peace', tone: 'good',
    title: 'PEACE PRIZE',
    verdict: 'Every bloc intact. Nobody can believe it either.',
    blurb: 'Fourteen unstable heads of state, zero launches. Statistically this should not have happened.',
  },
  treaty: {
    id: 'treaty', tone: 'good',
    title: 'PEACE TREATY',
    verdict: 'Signed. The guns stop. The bill arrives.',
    blurb: 'Two alliances, one document, and a generation of payments. Nobody won. Everybody stopped.',
  },
  forgotten: {
    id: 'forgotten', tone: 'absurd',
    title: 'FORGOTTEN',
    verdict: 'Nothing happened. Nobody messaged you.',
    blurb: 'World war came and went. You were not added to the group. This is the worst ending.',
  },
}

let seq = 0
export const msg = (
  from: ChatMsg['from'], channel: ChatMsg['channel'], text: string,
  day: number, kind: ChatMsg['kind'] = 'said', to?: CountryId,
): ChatMsg => ({ id: `m${seq++}`, from, channel, text, kind, day, to })
