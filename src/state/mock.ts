import type { Leader, Ending, EndingId, ChatMsg, CountryId } from './types'

/**
 * Placeholder roster. Humour is aimed strictly at government archetypes and
 * pop-culture national self-image — bureaucracy, corporate speak, politeness,
 * weather, paperwork. Never ethnicity, religion, or real conflicts.
 * Leaders are invented characters; no real politicians are depicted.
 */
export const LEADERS: Leader[] = [
  {
    id: 'United States of America', short: 'USA', flag: '🇺🇸',
    leader: 'President Chad Wexler',
    doctrine: 'Every war is brought to you by a sponsor.',
    persona: 'Runs foreign policy like a product launch. Says "circle back" during air raids.',
    stats: { military: 92, economy: 88, morale: 61, standing: 44 },
    volatility: 1.0, pettiness: 0.5,
    grievances: [
      'you did not attend their optional sync',
      'you called their initiative "fine"',
      'you replied to a thread instead of the channel',
    ],
  },
  {
    id: 'Russia', short: 'RUS', flag: '🇷🇺',
    leader: 'Premier Anton Volkov',
    doctrine: 'Answers in one word. Usually that word is no.',
    persona: 'Deadpan. Explains nothing. Sometimes just sends a full stop.',
    stats: { military: 89, economy: 47, morale: 70, standing: 31 },
    volatility: 1.3, pettiness: 0.3,
    grievances: [
      'you used too many words',
      'you asked a follow-up question',
      'you sent a thumbs up',
    ],
  },
  {
    id: 'China', short: 'CHN', flag: '🇨🇳',
    leader: 'Chairman Li Wen',
    doctrine: 'Will build a city before you finish this sentence.',
    persona: 'Answers every threat with a construction completion date.',
    stats: { military: 87, economy: 91, morale: 74, standing: 49 },
    volatility: 0.8, pettiness: 0.25,
    grievances: [
      'you were late to a groundbreaking ceremony',
      'you questioned a delivery date',
      'you have not yet used the new bridge',
    ],
  },
  {
    id: 'India', short: 'IND', flag: '🇮🇳',
    leader: 'Prime Minister Arjun Rao',
    doctrine: 'Please fill Form 27B before declaring war.',
    persona: 'Adds everyone to group chats. Forwards things. Sends "gm 🙏" mid-crisis.',
    stats: { military: 78, economy: 72, morale: 80, standing: 66 },
    volatility: 0.7, pettiness: 0.5,
    grievances: [
      'you left the group',
      'you did not reply to gm',
      'you did not do the needful',
    ],
  },
  {
    id: 'Japan', short: 'JPN', flag: '🇯🇵',
    leader: 'Prime Minister Kenji Sato',
    doctrine: 'Apologises profusely, then escalates precisely on schedule.',
    persona: 'Impeccably polite while doing something completely unforgivable.',
    stats: { military: 71, economy: 85, morale: 77, standing: 72 },
    volatility: 0.9, pettiness: 0.4,
    grievances: [
      'you arrived four minutes early',
      'you did not acknowledge the apology',
      'you rounded the numbers',
    ],
  },
  {
    id: 'Germany', short: 'DEU', flag: '🇩🇪',
    leader: 'Chancellor Ute Brandt',
    doctrine: 'That is not the correct form for a declaration of war.',
    persona: 'Cites subsections. Files complaints. Rejects invasions on procedural grounds.',
    stats: { military: 69, economy: 87, morale: 68, standing: 74 },
    volatility: 1.0, pettiness: 0.7,
    grievances: [
      'you submitted the wrong form',
      'you skipped a subsection',
      'your declaration used an unapproved font',
    ],
  },
  {
    id: 'France', short: 'FRA', flag: '🇫🇷',
    leader: 'President Céline Marchand',
    doctrine: 'On strike. Also offended.',
    persona: 'Escalates over being left on read. Leaves the conversation dramatically, returns immediately.',
    stats: { military: 74, economy: 76, morale: 55, standing: 63 },
    volatility: 1.6, pettiness: 0.9,
    grievances: [
      'you left them on read',
      'you did not thank them publicly',
      'you agreed with them insufficiently',
    ],
  },
  {
    id: 'United Kingdom', short: 'GBR', flag: '🇬🇧',
    leader: 'Prime Minister Nigel Ashcombe',
    doctrine: 'Passive aggression, but it is a nuclear deterrent.',
    persona: 'Opens with the weather. Closes with "no worries if not!" while sinking your navy.',
    stats: { military: 73, economy: 78, morale: 59, standing: 68 },
    volatility: 1.1, pettiness: 0.8,
    grievances: [
      'you did not say good morning',
      'you queued incorrectly',
      'you said "no worries" first',
    ],
  },
  {
    id: 'Brazil', short: 'BRA', flag: '🇧🇷',
    leader: 'President Rafa Duarte',
    doctrine: 'War, but make it a festival.',
    persona: 'Invites the invading army. Genuinely unbothered by anything.',
    stats: { military: 62, economy: 64, morale: 93, standing: 71 },
    volatility: 0.4, pettiness: 0.05,
    grievances: [
      'you did not come to the thing',
      'you left the thing early',
    ],
  },
  {
    id: 'Australia', short: 'AUS', flag: '🇦🇺',
    leader: 'Prime Minister Sharon Kettle',
    doctrine: 'Currently at war with a bird. Will get back to you.',
    persona: 'Chaotic neutral. Unfazed by nuclear weapons, deeply concerned about local wildlife.',
    stats: { military: 58, economy: 70, morale: 84, standing: 77 },
    volatility: 0.6, pettiness: 0.3,
    grievances: [
      'you sided with the bird',
      'you called it a small spider',
      'you have still not visited',
    ],
  },
  {
    id: 'Canada', short: 'CAN', flag: '🇨🇦',
    leader: 'Prime Minister Dale Beaumont',
    doctrine: 'Sorry in advance. Sorry again.',
    persona: 'Apologises relentlessly. Becomes extremely calm and extremely dangerous when pushed.',
    stats: { military: 60, economy: 79, morale: 82, standing: 88 },
    volatility: 0.7, pettiness: 0.15,
    grievances: [
      'you did not apologise back',
      'you held the door too long',
      'you said their name with the wrong vowel',
    ],
  },
  {
    id: 'Switzerland', short: 'CHE', flag: '🇨🇭',
    leader: 'Chancellor Heidi Ammann',
    doctrine: 'Neutral. Holds everyone’s money. Knows everything.',
    persona: 'Refuses to take a side while revealing a devastating fact about your accounts.',
    stats: { military: 41, economy: 94, morale: 75, standing: 90 },
    volatility: 0.5, pettiness: 0.2,
    grievances: [
      'you were nine seconds late to a meeting',
      'you asked what the fee was for',
      'you made a transfer at an unusual hour',
    ],
  },
]

export const LEADER_BY_ID = new Map(LEADERS.map(l => [l.id, l]))

/** Opening scene in the global channel. Sets the tone before turn one. */
export const SEED_GLOBAL: Array<[string, string]> = [
  ['SYSTEM', 'GLOBAL CHANNEL ESTABLISHED — 12 heads of state connected'],
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
    blurb: 'Twelve unstable heads of state, zero launches. Statistically this should not have happened.',
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
