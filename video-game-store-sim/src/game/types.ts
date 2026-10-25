export type Role = 'warden' | 'slayer' | 'weaver';
export type Mythology = 'norse' | 'egyptian' | 'greek' | 'japanese';
export type Scaling = 'early' | 'mid' | 'late';
export type Strategy = 'snowball' | 'scale' | 'protect' | 'pick' | 'chaos';
export type Training = 'mechanics' | 'macro' | 'synergy' | 'champion' | 'rest' | 'academy';
export type Trait = 'clutch' | 'grinder' | 'volatile' | 'leader' | 'prodigy' | 'meta' | 'onetrick';
export type MatchKind =
  | 'preseason'
  | 'regular'
  | 'cup'
  | 'cup-semi'
  | 'cup-final'
  | 'play-in'
  | 'playoff-semi'
  | 'playoff-final';

export type Screen =
  | 'title'
  | 'create'
  | 'office'
  | 'roster'
  | 'player'
  | 'champions'
  | 'match'
  | 'result'
  | 'league'
  | 'facility'
  | 'finances'
  | 'offseason';

export type LeagueTab = 'standings' | 'schedule' | 'cup' | 'playoffs' | 'teams';

export interface Ability {
  name: string;
  text: string;
}

export interface Champion {
  id: string;
  name: string;
  title: string;
  mythology: Mythology;
  role: Role;
  scaling: Scaling;
  difficulty: 1 | 2 | 3;
  base: number;
  tags: string[];
  fantasy: string;
  abilities: Ability[];
  synergy: string[];
  art: string;
}

export interface Player {
  id: string;
  name: string;
  nick: string;
  age: number;
  role: Role;
  portrait: string;
  mechanics: number;
  macro: number;
  teamwork: number;
  clutch: number;
  potential: number;
  morale: number;
  fatigue: number;
  form: number;
  salary: number;
  contractYears: number;
  contractStatus: 'signed' | 'expiring';
  mastery: Record<string, number>;
  trait: Trait;
  injured: number;
  seasonGames: number;
  seasonWins: number;
  seasonMvps: number;
  careerGames: number;
  careerMvps: number;
}

export interface Team {
  id: string;
  name: string;
  tag: string;
  city: string;
  color: string;
  blurb: string;
  player: boolean;
  strategy: Strategy;
  training: Training;
  trainingChamp: string;
  facility: number;
  reputation: number;
  fans: number;
  chemistry: number;
  main: string[];
  dev: string[];
  cash: number;
}

export interface Fixture {
  id: string;
  kind: MatchKind;
  series: 1 | 3 | 5;
  homeId: string;
  awayId: string;
}

export interface GameLog {
  season: number;
  kind: MatchKind;
  homeId: string;
  awayId: string;
  winnerId: string;
  homeKills: number;
  awayKills: number;
  label: string;
}

export interface Draft {
  playerIds: string[];
  champs: Record<string, string>;
  strategy: Strategy;
}

export interface GameReport {
  winnerId: string;
  homeId: string;
  awayId: string;
  homeKills: number;
  awayKills: number;
  homeGold: number;
  awayGold: number;
  homeHeart: number;
  awayHeart: number;
  time: string;
  timeline: { t: string; text: string }[];
  mvpId: string;
  mvpName: string;
}

export interface WeekReport {
  label: string;
  kind: MatchKind | 'bye';
  opponentId?: string;
  opponentName?: string;
  home: boolean;
  won?: boolean;
  scoreline?: string;
  games: GameReport[];
  mvpName?: string;
  cashDelta: number;
  fansDelta: number;
  notes: string[];
  patchNotes: string[];
  growth?: { nick: string; text: string }[];
  bountyNote?: string;
  raceLine?: string;
  nextHook?: string;
  streakAfter?: number;
}

export type BountyId = 'win' | 'prospect' | 'fresh' | 'mains' | 'rival';

export interface Bounty {
  id: BountyId;
  text: string;
  reward: number;
}

export type Stage =
  | { kind: 'preseason'; round: number }
  | { kind: 'regular'; round: number }
  | { kind: 'cup'; round: number }
  | { kind: 'cup-semi' }
  | { kind: 'cup-final' }
  | { kind: 'play-in' }
  | { kind: 'playoff-semi' }
  | { kind: 'playoff-final' }
  | { kind: 'offseason' };

export interface SeriesState {
  homeId: string;
  awayId: string;
  homeWins: number;
  awayWins: number;
  done: boolean;
}

export interface CupState {
  groups: { a: string[]; b: string[] };
  semis: SeriesState[];
  final: SeriesState | null;
  championId?: string;
}

export interface PlayoffState {
  seeds: string[];
  playIn: SeriesState[];
  semis: SeriesState[];
  final: SeriesState | null;
  championId?: string;
}

export interface NewsItem {
  id: number;
  text: string;
}

export interface LedgerEntry {
  label: string;
  note: string;
  amount: number;
  balance: number;
}

export interface Goal {
  id: string;
  text: string;
  done: boolean;
}

export interface SeasonArchive {
  year: number;
  wins: number;
  losses: number;
  cup: string;
  playoff: string;
  cash: number;
  mvp: string;
}

export interface ScrimReport {
  kind: 'house' | 'circuit';
  opponentId?: string;
  opponentName?: string;
  won?: boolean;
  scoreline?: string;
  note: string;
}

export interface TradeOffer {
  id: number;
  fromTeamId: string;
  theyGive: string;
  theyWant: string;
  cash: number;
  note: string;
}

export interface Award {
  id: 'mvp' | 'breakout';
  title: string;
  year: number;
  playerId: string;
  playerName: string;
  teamId: string;
  detail: string;
}

export interface Lineup {
  playerIds: string[];
  champs: Record<string, string>;
  ban: string;
  strategy: Strategy;
}

export interface Career {
  seed: number;
  rngState: number;
  year: number;
  stage: Stage;
  orgs: Team[];
  playerTeamId: string;
  players: Record<string, Player>;
  patch: Record<string, number>;
  patchNotes: string[];
  patchUnread: boolean;
  patchName: string;
  patchSerial: number;
  results: GameLog[];
  news: NewsItem[];
  newsSeq: number;
  ledger: LedgerEntry[];
  goals: Goal[];
  lineup: Lineup;
  cup: CupState | null;
  playoffs: PlayoffState | null;
  history: SeasonArchive[];
  lastReport: WeekReport | null;
  charityCount: number;
  freeAgents: string[];
  contractsProcessed: boolean;
  midPatchDone: boolean;
  regularRounds: [string, string][][];
  preseasonRounds: [string, string][][];
  cupResult: string;
  playoffResult: string;
  faSerial: number;
  scrimDone: boolean;
  lastScrim: ScrimReport | null;
  offers: TradeOffer[];
  offerSeq: number;
  awards: Award[];
  intel: Record<string, boolean>;
  streak: number;
  bounty: Bounty | null;
  rivalId: string;
  rivalHeat: number;
}

export interface AppState {
  version: 2;
  screen: Screen;
  returnScreen: Screen;
  career: Career | null;
  draft: { name: string; tag: string; city: string; color: string };
  notice: string;
  selectedPlayerId: string | null;
  selectedSlot: number;
  selectedChampId: string;
  leagueTab: LeagueTab;
  viewedTeamId: string | null;
  champMyth: 'all' | Mythology;
  champRole: 'all' | Role;
  confirmAbandon: boolean;
}

export type Action =
  | { type: 'goto'; screen: Screen }
  | { type: 'draft'; field: 'name' | 'tag' | 'city'; value: string }
  | { type: 'color'; color: string }
  | { type: 'begin' }
  | { type: 'abandon' }
  | { type: 'ask-abandon' }
  | { type: 'select-player'; id: string }
  | { type: 'training'; focus: Training }
  | { type: 'training-champ'; id: string }
  | { type: 'swap'; a: string; b: string }
  | { type: 'slot'; index: number }
  | { type: 'assign-player'; id: string }
  | { type: 'assign-champ'; id: string }
  | { type: 'ban'; id: string }
  | { type: 'strategy'; id: Strategy }
  | { type: 'autofill' }
  | { type: 'play' }
  | { type: 'dismiss-result' }
  | { type: 'upgrade' }
  | { type: 'dismiss-patch' }
  | { type: 'league-tab'; tab: LeagueTab }
  | { type: 'view-team'; id: string }
  | { type: 'resign'; id: string; years: number }
  | { type: 'release'; id: string }
  | { type: 'sign'; id: string; side: 'main' | 'dev'; years: number }
  | { type: 'next-season' }
  | { type: 'myth-filter'; myth: 'all' | Mythology }
  | { type: 'role-filter'; role: 'all' | Role }
  | { type: 'scrim-house' }
  | { type: 'scrim-circuit'; opponentId: string }
  | { type: 'trade-accept'; id: number }
  | { type: 'trade-decline'; id: number };
