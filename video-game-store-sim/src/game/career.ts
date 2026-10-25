import { CHAMPIONS, champName } from './champions.ts';
import { FACILITIES, facilityAt } from './facilities.ts';
import {
  aiBan,
  autofillLineup,
  buildDraft,
  chooseStarterIds,
  describeWeek,
  findPlayerFixture,
  lineupProblems,
  opponentOf,
  playerTeam,
  rosterIds,
  simulateSeries,
  teamById
} from './match.ts';
import { Rng } from './rng.ts';
import { bestMasteryId, blankSeasonStats, demand, overall, roleChamps } from './roster.ts';
import { doubleRoundRobin, singleRoundRobin } from './schedule.ts';
import type {
  Award,
  Bounty,
  Career,
  CupState,
  Draft,
  Fixture,
  GameLog,
  Goal,
  Lineup,
  MatchKind,
  Player,
  PlayoffState,
  Role,
  RoomEvent,
  WeekPlan,
  ScrimReport,
  SeriesState,
  Strategy,
  Team,
  TradeOffer,
  Training,
  Trait,
  WeekReport
} from './types.ts';

export interface OrgInput {
  name: string;
  tag: string;
  city: string;
  color: string;
}

export interface Standing {
  teamId: string;
  wins: number;
  losses: number;
  diff: number;
}

const TRAITS: Trait[] = ['clutch', 'grinder', 'volatile', 'leader', 'prodigy', 'meta', 'onetrick'];

const FIRST = ['Aiko', 'Noah', 'Leila', 'Mateo', 'Hana', 'Omar', 'Ines', 'Jonas', 'Priya', 'Eli', 'Soren', 'Amira', 'Theo', 'Yuna', 'Idris', 'Clara', 'Rafi', 'Nia', 'Hugo', 'Mei', 'Andre', 'Sofia', 'Kenan', 'Aya', 'Lars', 'Noemi', 'Darius', 'Hye', 'Pavel', 'Lina', 'Samir', 'Ivy', 'Nico', 'Farah', 'Owen', 'Zola', 'Emile', 'Rin', 'Tariq', 'Bea', 'Hugo', 'Sable', 'Quinn', 'Ada'];
const LAST = ['Varga', 'Okada', 'Diallo', 'Moreau', 'Silva', 'Nguyen', 'Keller', 'Rahman', 'Ito', 'Berg', 'Costa', 'Haddad', 'Novak', 'Park', 'Rossi', 'Adeyemi', 'Lind', 'Cho', 'Ferreira', 'Sato', 'Klein', 'Duval', 'Navarro', 'Horvat', 'Mensah', 'Bauer', 'Almeida', 'Khoury', 'Petrov', 'Walsh', 'Kimura', 'Santos', 'Erdal', 'Bloom', 'Carter', 'Nasser', 'Vogel', 'Ibanez', 'Frost', 'Malik'];
const NICKS = ['ACE', 'JUNO', 'PIX', 'ORCA', 'NERO', 'VIV', 'BOLT', 'MICA', 'ECHO', 'RIOT', 'LARK', 'ZERO', 'KIN', 'DUST', 'PEARL', 'AXE', 'NOVA', 'GHOST', 'BYTE', 'LUMEN', 'KITE', 'MARU', 'FANG', 'IO', 'TRUE', 'PINK', 'HALO', 'DRIFT', 'ONYX', 'SUNA', 'WISP', 'CORVO', 'JADE', 'MOON', 'REDS', 'QUILL', 'BRIAR', 'NORTH', 'SHIRO', 'VEGA', 'PLUM', 'OTTO', 'NIX', 'ARGO'];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function dollars(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

function placeName(place: number): string {
  const mod = place % 10;
  const suffix = place % 100 >= 11 && place % 100 <= 13 ? 'th' : mod === 1 ? 'st' : mod === 2 ? 'nd' : mod === 3 ? 'rd' : 'th';
  return `${place}${suffix}`;
}

export function freshGoals(facility: number): Goal[] {
  return [
    { id: 'win', text: 'Win a match this season', done: false },
    { id: 'garage', text: 'Move the team out of the garage', done: facility > 0 },
    { id: 'cup', text: 'Reach the Spire Cup knockout', done: false },
    { id: 'playoffs', text: 'Qualify for the playoffs', done: false },
    { id: 'title', text: 'Win the Pantheon Circuit', done: false },
    { id: 'hq', text: 'Open the Mythic Arena HQ', done: facility >= 7 }
  ];
}

function markGoal(career: Career, id: string): void {
  const goal = career.goals.find((entry) => entry.id === id);
  if (!goal || goal.done) return;
  goal.done = true;
  pushNews(career, `Goal cleared: ${goal.text}.`);
}

function pushNews(career: Career, text: string): void {
  career.newsSeq += 1;
  career.news.unshift({ id: career.newsSeq, text });
  career.news = career.news.slice(0, 24);
}

function book(career: Career, label: string, note: string, amount: number): void {
  const team = playerTeam(career);
  team.cash = Math.round(team.cash + amount);
  career.ledger.unshift({
    label,
    note,
    amount: Math.round(amount),
    balance: team.cash
  });
  career.ledger = career.ledger.slice(0, 40);
}

function scheduleFor(ids: string[], year: number): { regular: [string, string][][]; preseason: [string, string][][] } {
  const rot = (year - 1) % ids.length;
  const order = [...ids.slice(rot), ...ids.slice(0, rot)];
  const preOrder = [...order.slice(3), ...order.slice(0, 3)];
  return {
    regular: doubleRoundRobin(order),
    preseason: singleRoundRobin(preOrder).slice(0, 4)
  };
}

function tune(role: Role, ovr: number, rng: Rng): Pick<Player, 'mechanics' | 'macro' | 'teamwork' | 'clutch'> {
  const weights =
    role === 'slayer'
      ? { mechanics: 0.46, macro: 0.2, teamwork: 0.14, clutch: 0.2 }
      : role === 'warden'
        ? { mechanics: 0.24, macro: 0.34, teamwork: 0.28, clutch: 0.14 }
        : { mechanics: 0.18, macro: 0.4, teamwork: 0.3, clutch: 0.12 };
  const stats = { mechanics: ovr, macro: ovr, teamwork: ovr, clutch: ovr };
  if (role === 'slayer') {
    stats.mechanics += 6;
    stats.macro -= 3;
    stats.teamwork -= 2;
  } else if (role === 'warden') {
    stats.macro += 4;
    stats.teamwork += 4;
    stats.mechanics -= 5;
  } else {
    stats.macro += 5;
    stats.teamwork += 4;
    stats.mechanics -= 6;
  }
  stats.mechanics += rng.int(-1, 1);
  stats.macro += rng.int(-1, 1);
  stats.teamwork += rng.int(-1, 1);
  stats.clutch += rng.int(-1, 1);
  const score = () =>
    Math.round(
      stats.mechanics * weights.mechanics +
        stats.macro * weights.macro +
        stats.teamwork * weights.teamwork +
        stats.clutch * weights.clutch
    );
  const primary = role === 'slayer' ? 'mechanics' : 'macro';
  for (let i = 0; i < 16; i++) {
    const diff = ovr - score();
    if (diff === 0) break;
    stats[primary] += Math.sign(diff);
  }
  return {
    mechanics: clamp(stats.mechanics, 35, 96),
    macro: clamp(stats.macro, 35, 96),
    teamwork: clamp(stats.teamwork, 35, 96),
    clutch: clamp(stats.clutch, 35, 96)
  };
}

function assignMastery(rng: Rng, role: Role, ovr: number): Record<string, number> {
  const same = CHAMPIONS.filter((champion) => champion.role === role);
  const first = rng.pick(same);
  const secondPool = same.filter((champion) => champion.id !== first.id);
  const second = rng.pick(secondPool.length ? secondPool : CHAMPIONS.filter((champion) => champion.id !== first.id));
  const third = rng.pick(CHAMPIONS.filter((champion) => champion.id !== first.id && champion.id !== second.id));
  const high = clamp(68 + Math.round((ovr - 70) * 0.85) + rng.int(0, 6), 60, 96);
  return {
    [first.id]: high,
    [second.id]: rng.int(52, 74),
    [third.id]: rng.int(34, 58)
  };
}

function makeGeneratedPlayer(rng: Rng, id: string, role: Role, ovr: number, potential: number, age: number, portrait: string): Player {
  const stats = tune(role, ovr, rng);
  const nick = uniqueNick(rng);
  const player: Player = {
    id,
    name: `${rng.pick(FIRST)} ${rng.pick(LAST)}`,
    nick,
    age,
    role,
    portrait,
    ...stats,
    potential: Math.max(potential, ovr + 3),
    morale: rng.int(58, 78),
    fatigue: rng.int(6, 24),
    form: rng.int(-1, 2),
    salary: 1000,
    contractYears: rng.int(1, 3),
    contractStatus: 'signed',
    mastery: assignMastery(rng, role, ovr),
    trait: rng.pick(TRAITS),
    injured: 0,
    study: '',
    sat: 0,
    ...blankSeasonStats()
  };
  player.study = bestMasteryId(player) || 'brynhild';
  player.salary = demand(player);
  return player;
}

const usedNicks = new Set<string>(['MINA', 'KITE', 'VEIL', 'BOOM', 'NYX', 'WOLF']);

function uniqueNick(rng: Rng): string {
  for (let i = 0; i < 60; i++) {
    const nick = rng.pick(NICKS);
    if (!usedNicks.has(nick)) {
      usedNicks.add(nick);
      return nick;
    }
  }
  for (let i = 0; i < 40; i++) {
    const nick = `${rng.pick(NICKS)}${rng.int(2, 9)}`;
    if (!usedNicks.has(nick)) {
      usedNicks.add(nick);
      return nick;
    }
  }
  const nick = `P${usedNicks.size}`;
  usedNicks.add(nick);
  return nick;
}

function dealPortraits(): string[][] {
  const pool = Array.from({ length: 18 }, (_, index) => `/portraits/port-${String(index + 7).padStart(2, '0')}.jpg`);
  const counts = Array(18).fill(0);
  const teams: string[][] = [];
  for (let team = 0; team < 7; team++) {
    const row: string[] = [];
    let cursor = team * 3;
    let guard = 0;
    while (row.length < 6 && guard < 90) {
      const index = cursor % 18;
      cursor += 1;
      guard += 1;
      if (row.includes(pool[index]) || counts[index] >= 3) continue;
      row.push(pool[index]);
      counts[index] += 1;
    }
    for (let index = 0; index < 18 && row.length < 6; index++) {
      if (!row.includes(pool[index])) row.push(pool[index]);
    }
    teams.push(row.slice(0, 6));
  }
  return teams;
}

function handPlayer(
  partial: Omit<Player, 'seasonGames' | 'seasonWins' | 'seasonMvps' | 'careerGames' | 'careerMvps' | 'study' | 'sat'>
): Player {
  const player: Player = { ...partial, ...blankSeasonStats(), study: '', sat: 0 };
  player.study = bestMasteryId(player) || 'brynhild';
  return player;
}

function favoriteChamp(career: Career, team: Team): string {
  const totals = new Map<string, number>();
  for (const id of rosterIds(team)) {
    const player = career.players[id];
    for (const [champId, value] of Object.entries(player.mastery)) {
      const meta = 1 + Math.max(0, career.patch[champId] ?? 0) / 20;
      totals.set(champId, (totals.get(champId) ?? 0) + value * meta);
    }
  }
  let best = 'skadi';
  let score = -1;
  for (const [id, value] of totals) {
    if (value > score) {
      best = id;
      score = value;
    }
  }
  return best;
}

function rollPatch(career: Career, rng: Rng): string[] {
  const deltas: Record<string, number> = {};
  for (const champion of CHAMPIONS) deltas[champion.id] = rng.int(-1, 1);
  const order = rng.shuffle(CHAMPIONS.map((champion) => champion.id));
  for (const id of order.slice(0, 3)) deltas[id] += rng.int(3, 6);
  for (const id of order.slice(3, 6)) deltas[id] -= rng.int(3, 6);
  const notes: string[] = [];
  for (const champion of CHAMPIONS) {
    const before = career.patch[champion.id] ?? 0;
    const next = clamp(before + (deltas[champion.id] ?? 0), -10, 10);
    career.patch[champion.id] = next;
    const diff = next - before;
    if (Math.abs(diff) >= 3) {
      notes.push(`${champion.name} ${diff > 0 ? 'comes online' : 'is grounded'} (${diff > 0 ? '+' : ''}${diff}).`);
    }
  }
  career.patchSerial += 1;
  career.patchName = `${career.year}.${career.patchSerial}`;
  career.patchNotes = notes;
  career.patchUnread = true;
  for (const team of career.orgs) {
    if (!team.player) team.trainingChamp = favoriteChamp(career, team);
  }
  return notes;
}

export function createCareer(input: OrgInput, seed: number): Career {
  usedNicks.clear();
  for (const nick of ['MINA', 'KITE', 'VEIL', 'BOOM', 'NYX', 'WOLF']) usedNicks.add(nick);
  const rng = new Rng(seed);
  const portraits = dealPortraits();
  const players: Record<string, Player> = {
    mina: handPlayer({
      id: 'mina',
      name: 'Mina Solberg',
      nick: 'MINA',
      age: 20,
      role: 'warden',
      portrait: '/portraits/port-01.jpg',
      mechanics: 62,
      macro: 73,
      teamwork: 75,
      clutch: 64,
      potential: 86,
      morale: 72,
      fatigue: 12,
      form: 1,
      salary: 800,
      contractYears: 2,
      contractStatus: 'signed',
      mastery: { brynhild: 84, sekhmet: 70, raijin: 48 },
      trait: 'leader',
      injured: 0
    }),
    kite: handPlayer({
      id: 'kite',
      name: 'Kenji Arai',
      nick: 'KITE',
      age: 22,
      role: 'slayer',
      portrait: '/portraits/port-02.jpg',
      mechanics: 82,
      macro: 66,
      teamwork: 64,
      clutch: 76,
      potential: 88,
      morale: 66,
      fatigue: 16,
      form: 2,
      salary: 1100,
      contractYears: 2,
      contractStatus: 'signed',
      mastery: { skadi: 88, artemis: 74, susanoo: 40 },
      trait: 'onetrick',
      injured: 0
    }),
    veil: handPlayer({
      id: 'veil',
      name: 'Noor Hassan',
      nick: 'VEIL',
      age: 21,
      role: 'weaver',
      portrait: '/portraits/port-03.jpg',
      mechanics: 60,
      macro: 78,
      teamwork: 76,
      clutch: 66,
      potential: 86,
      morale: 74,
      fatigue: 10,
      form: 0,
      salary: 950,
      contractYears: 2,
      contractStatus: 'signed',
      mastery: { athena: 84, anubis: 68, amaterasu: 55 },
      trait: 'meta',
      injured: 0
    }),
    boom: handPlayer({
      id: 'boom',
      name: 'Luca Ferreira',
      nick: 'BOOM',
      age: 23,
      role: 'slayer',
      portrait: '/portraits/port-04.jpg',
      mechanics: 74,
      macro: 62,
      teamwork: 60,
      clutch: 70,
      potential: 78,
      morale: 62,
      fatigue: 20,
      form: -1,
      salary: 850,
      contractYears: 1,
      contractStatus: 'signed',
      mastery: { bastet: 82, susanoo: 66, skadi: 36 },
      trait: 'volatile',
      injured: 0
    }),
    nyx: handPlayer({
      id: 'nyx',
      name: 'Sable Okonkwo',
      nick: 'NYX',
      age: 18,
      role: 'weaver',
      portrait: '/portraits/port-05.jpg',
      mechanics: 52,
      macro: 66,
      teamwork: 64,
      clutch: 54,
      potential: 91,
      morale: 78,
      fatigue: 6,
      form: 0,
      salary: 400,
      contractYears: 3,
      contractStatus: 'signed',
      mastery: { amaterasu: 66, loki: 62, athena: 34 },
      trait: 'prodigy',
      injured: 0
    }),
    wolf: handPlayer({
      id: 'wolf',
      name: 'Erik Nilsen',
      nick: 'WOLF',
      age: 18,
      role: 'warden',
      portrait: '/portraits/port-06.jpg',
      mechanics: 56,
      macro: 64,
      teamwork: 66,
      clutch: 52,
      potential: 87,
      morale: 76,
      fatigue: 8,
      form: 1,
      salary: 420,
      contractYears: 3,
      contractStatus: 'signed',
      mastery: { raijin: 68, achilles: 58, brynhild: 32 },
      trait: 'grinder',
      injured: 0
    })
  };

  const specs: {
    id: string;
    name: string;
    tag: string;
    city: string;
    color: string;
    blurb: string;
    strategy: Strategy;
    training: Training;
    facility: number;
    reputation: number;
    fans: number;
    chemistry: number;
    mainOvr: number[];
    devOvr: number[];
    mainRoles: Role[];
    devRoles: Role[];
    mainPot: number[];
    devPot: number[];
  }[] = [
    {
      id: 'northhowl',
      name: 'Northhowl',
      tag: 'NHL',
      city: 'Reykjavík',
      color: '#79b7ff',
      blurb: 'Snowball the early path and howl before the Worldheart wakes.',
      strategy: 'snowball',
      training: 'mechanics',
      facility: 3,
      reputation: 46,
      fans: 7400,
      chemistry: 58,
      mainOvr: [73, 71, 69, 66],
      devOvr: [61, 58],
      mainRoles: ['warden', 'slayer', 'weaver', 'slayer'],
      devRoles: ['warden', 'weaver'],
      mainPot: [84, 82, 80, 78],
      devPot: [86, 84]
    },
    {
      id: 'khemri',
      name: 'Khemri Kings',
      tag: 'KHE',
      city: 'Cairo',
      color: '#e2b15a',
      blurb: 'Patient, golden, and cruel once the map starts to scale.',
      strategy: 'scale',
      training: 'champion',
      facility: 4,
      reputation: 58,
      fans: 11200,
      chemistry: 64,
      mainOvr: [76, 74, 72, 69],
      devOvr: [63, 60],
      mainRoles: ['warden', 'slayer', 'weaver', 'warden'],
      devRoles: ['slayer', 'weaver'],
      mainPot: [86, 84, 82, 80],
      devPot: [84, 86]
    },
    {
      id: 'aegean',
      name: 'Aegean Crown',
      tag: 'AEG',
      city: 'Athens',
      color: '#d9c7a2',
      blurb: 'A private performance center and a public dynasty. The team you are chasing.',
      strategy: 'protect',
      training: 'synergy',
      facility: 5,
      reputation: 74,
      fans: 22000,
      chemistry: 76,
      mainOvr: [79, 77, 75, 72],
      devOvr: [67, 64],
      mainRoles: ['warden', 'slayer', 'weaver', 'slayer'],
      devRoles: ['weaver', 'warden'],
      mainPot: [90, 88, 86, 84],
      devPot: [88, 86]
    },
    {
      id: 'sakura',
      name: 'Sakura Voltage',
      tag: 'SKV',
      city: 'Osaka',
      color: '#f2a3c0',
      blurb: 'Picks in the brush. Someone on the other side always dies first.',
      strategy: 'pick',
      training: 'macro',
      facility: 4,
      reputation: 61,
      fans: 13600,
      chemistry: 66,
      mainOvr: [77, 75, 73, 70],
      devOvr: [64, 61],
      mainRoles: ['slayer', 'weaver', 'warden', 'slayer'],
      devRoles: ['weaver', 'warden'],
      mainPot: [87, 85, 83, 80],
      devPot: [88, 84]
    },
    {
      id: 'iron',
      name: 'Iron Spire',
      tag: 'IRN',
      city: 'Detroit',
      color: '#e07a45',
      blurb: 'The other spare room. They want the spot you are trying to climb into.',
      strategy: 'chaos',
      training: 'mechanics',
      facility: 1,
      reputation: 28,
      fans: 2100,
      chemistry: 48,
      mainOvr: [69, 67, 66, 63],
      devOvr: [59, 57],
      mainRoles: ['warden', 'slayer', 'weaver', 'warden'],
      devRoles: ['slayer', 'weaver'],
      mainPot: [80, 78, 76, 74],
      devPot: [84, 82]
    },
    {
      id: 'oracle',
      name: 'Midnight Oracle',
      tag: 'MOR',
      city: 'Lisbon',
      color: '#b79bff',
      blurb: 'Late-game control and a library of film. They will wait you out.',
      strategy: 'scale',
      training: 'macro',
      facility: 3,
      reputation: 44,
      fans: 6800,
      chemistry: 60,
      mainOvr: [73, 72, 70, 67],
      devOvr: [62, 59],
      mainRoles: ['weaver', 'slayer', 'warden', 'weaver'],
      devRoles: ['slayer', 'warden'],
      mainPot: [84, 82, 80, 78],
      devPot: [86, 83]
    },
    {
      id: 'solstice',
      name: 'Solstice',
      tag: 'SOL',
      city: 'Mexico City',
      color: '#f0d56c',
      blurb: 'Fast hands, a loud crowd, and no patience for a scaling comp.',
      strategy: 'snowball',
      training: 'synergy',
      facility: 4,
      reputation: 52,
      fans: 9800,
      chemistry: 63,
      mainOvr: [75, 73, 71, 68],
      devOvr: [62, 60],
      mainRoles: ['slayer', 'warden', 'weaver', 'slayer'],
      devRoles: ['warden', 'weaver'],
      mainPot: [86, 83, 81, 79],
      devPot: [85, 84]
    }
  ];

  const orgs: Team[] = [
    {
      id: 'you',
      name: input.name,
      tag: input.tag,
      city: input.city,
      color: input.color,
      blurb: 'A garage lease, six players, and a router that drops once a scrim.',
      player: true,
      strategy: 'scale',
      training: 'synergy',
      trainingChamp: 'skadi',
      facility: 0,
      reputation: 12,
      fans: 640,
      chemistry: 44,
      main: ['mina', 'kite', 'veil', 'boom'],
      dev: ['nyx', 'wolf'],
      cash: 36000
    }
  ];

  specs.forEach((spec, index) => {
    const arts = portraits[index] ?? portraits[0];
    const main: string[] = [];
    const dev: string[] = [];
    spec.mainRoles.forEach((role, slot) => {
      const id = `${spec.id}-m${slot}`;
      players[id] = makeGeneratedPlayer(rng, id, role, spec.mainOvr[slot], spec.mainPot[slot], rng.int(20, 26), arts[slot]);
      main.push(id);
    });
    spec.devRoles.forEach((role, slot) => {
      const id = `${spec.id}-d${slot}`;
      players[id] = makeGeneratedPlayer(rng, id, role, spec.devOvr[slot], spec.devPot[slot], rng.int(18, 19), arts[slot + 4]);
      dev.push(id);
    });
    orgs.push({
      id: spec.id,
      name: spec.name,
      tag: spec.tag,
      city: spec.city,
      color: spec.color,
      blurb: spec.blurb,
      player: false,
      strategy: spec.strategy,
      training: spec.training,
      trainingChamp: 'skadi',
      facility: spec.facility,
      reputation: spec.reputation,
      fans: spec.fans,
      chemistry: spec.chemistry,
      main,
      dev,
      cash: 0
    });
  });

  const ids = orgs.map((team) => team.id);
  const rounds = scheduleFor(ids, 1);
  const career: Career = {
    seed,
    rngState: rng.state,
    year: 1,
    stage: { kind: 'preseason', round: 0 },
    orgs,
    playerTeamId: 'you',
    players,
    patch: Object.fromEntries(CHAMPIONS.map((champion) => [champion.id, 0])),
    patchNotes: [],
    patchUnread: false,
    patchName: '1.0',
    patchSerial: 0,
    results: [],
    news: [],
    newsSeq: 0,
    ledger: [],
    goals: freshGoals(0),
    lineup: { playerIds: [], champs: {}, ban: 'artemis', strategy: 'scale' },
    cup: null,
    playoffs: null,
    history: [],
    lastReport: null,
    charityCount: 0,
    freeAgents: [],
    contractsProcessed: false,
    midPatchDone: false,
    regularRounds: rounds.regular,
    preseasonRounds: rounds.preseason,
    cupResult: 'Not started',
    playoffResult: 'Not started',
    faSerial: 1,
    scrimDone: false,
    lastScrim: null,
    offers: [],
    offerSeq: 1,
    awards: [],
    intel: {},
    streak: 0,
    bounty: null,
    rivalId: 'iron',
    rivalHeat: 28,
    ties: {},
    promiseId: null,
    room: null,
    roomSpent: false,
    roomEcho: '',
    plan: null,
    planNote: ''
  };
  const notes = rollPatch(career, rng);
  refreshOffers(career, rng, true);
  career.bounty = rollBounty(career, rng);
  seedTies(career, rng);
  career.room = rollRoom(career, rng);
  career.rngState = rng.state;
  pushNews(career, `${input.name} open a season in a garage in ${input.city}. The Pantheon Circuit does not care yet.`);
  pushNews(career, `Opening patch ${career.patchName}: ${notes.slice(0, 2).join(' ') || 'The rift barely moves.'}`);
  const filled = autofillLineup(career);
  career.lineup = filled.lineup;
  return career;
}

export function standingsFor(career: Career, kind: 'regular' | 'cup'): Standing[] {
  const rows = new Map<string, Standing>();
  for (const team of career.orgs) rows.set(team.id, { teamId: team.id, wins: 0, losses: 0, diff: 0 });
  for (const log of career.results) {
    if (log.season !== career.year || log.kind !== kind) continue;
    const home = rows.get(log.homeId);
    const away = rows.get(log.awayId);
    if (!home || !away) continue;
    const diff = log.homeKills - log.awayKills;
    home.diff += diff;
    away.diff -= diff;
    if (log.winnerId === log.homeId) {
      home.wins += 1;
      away.losses += 1;
    } else {
      away.wins += 1;
      home.losses += 1;
    }
  }
  return [...rows.values()];
}

function headToHead(career: Career, a: string, b: string, kind: 'regular' | 'cup'): number {
  let score = 0;
  for (const log of career.results) {
    if (log.season !== career.year || log.kind !== kind) continue;
    if (![log.homeId, log.awayId].includes(a) || ![log.homeId, log.awayId].includes(b)) continue;
    if (log.winnerId === a) score += 1;
    if (log.winnerId === b) score -= 1;
  }
  return score;
}

export function rankTeams(career: Career, kind: 'regular' | 'cup' = 'regular'): string[] {
  const map = Object.fromEntries(standingsFor(career, kind).map((row) => [row.teamId, row]));
  return career.orgs
    .map((team) => team.id)
    .sort((a, b) => {
      const left = map[a];
      const right = map[b];
      if (right.wins !== left.wins) return right.wins - left.wins;
      const face = headToHead(career, a, b, kind);
      if (face !== 0) return -face;
      if (right.diff !== left.diff) return right.diff - left.diff;
      return teamById(career, a).name.localeCompare(teamById(career, b).name);
    });
}

export function rankGroup(career: Career, ids: string[]): string[] {
  const ranked = rankTeams(career, 'cup').filter((id) => ids.includes(id));
  for (const id of ids) if (!ranked.includes(id)) ranked.push(id);
  return ranked;
}

export function playerStanding(career: Career): Standing {
  return standingsFor(career, 'regular').find((row) => row.teamId === career.playerTeamId) ?? {
    teamId: career.playerTeamId,
    wins: 0,
    losses: 0,
    diff: 0
  };
}

export function playerPlace(career: Career): number {
  const rank = rankTeams(career, 'regular');
  return rank.indexOf(career.playerTeamId) + 1;
}

function prizeFor(kind: MatchKind, won: boolean): number {
  if (kind === 'preseason') return won ? 900 : 250;
  if (kind === 'regular') return won ? 500 : 0;
  if (kind === 'cup') return won ? 2500 : 600;
  if (kind === 'cup-semi') return won ? 12000 : 6000;
  if (kind === 'cup-final') return won ? 40000 : 16000;
  if (kind === 'play-in') return won ? 8000 : 4000;
  if (kind === 'playoff-semi') return won ? 14000 : 8000;
  return won ? 75000 : 22000;
}

function fanSwing(kind: MatchKind, won: boolean, upset: boolean): number {
  if (kind === 'preseason') return won ? 25 : -5;
  if (kind === 'regular') return (won ? 70 : -20) + (won && upset ? 80 : 0);
  if (kind === 'cup') return won ? 90 : -10;
  if (kind === 'cup-semi') return won ? 180 : 40;
  if (kind === 'cup-final') return won ? 600 : 200;
  if (kind === 'play-in') return won ? 140 : 30;
  if (kind === 'playoff-semi') return won ? 220 : 60;
  return won ? 1500 : 350;
}

function tryGain(rng: Rng, player: Player, key: 'mechanics' | 'macro' | 'teamwork' | 'clutch', chance: number): void {
  if (player[key] >= player.potential + 1) return;
  if (rng.chance(chance)) player[key] = Math.min(99, player[key] + 1);
}

function bumpMastery(player: Player, champId: string, amount: number): void {
  if (!champId || amount <= 0) return;
  player.mastery[champId] = clamp((player.mastery[champId] ?? 8) + amount, 0, 99);
}

function trainAll(career: Career, rng: Rng, played: Set<string>): void {
  for (const team of career.orgs) {
    const facility = facilityAt(team.facility);
    let injuredOnTeam = rosterIds(team).filter((id) => career.players[id].injured > 0).length;
    for (const id of rosterIds(team)) {
      const player = career.players[id];
      if (played.has(id) && player.injured <= 0 && player.fatigue >= 78) {
        const chance = player.trait === 'grinder' ? 0.1 : player.fatigue >= 92 ? 0.38 : 0.2;
        if (injuredOnTeam < 2 && rng.chance(chance)) {
          player.injured = player.fatigue >= 92 ? 2 : 1;
          injuredOnTeam += 1;
          if (team.player) pushNews(career, `${player.nick} is hurt and will miss ${player.injured === 1 ? 'the next match' : 'the next two matches'}.`);
        }
      }
    }
    for (const id of rosterIds(team)) {
      const player = career.players[id];
      const onDev = team.dev.includes(id);
      const prodigy = player.trait === 'prodigy' && player.age <= 21 ? 1.3 : 1;
      const mult = facility.training * (onDev ? facility.dev : 1) * prodigy;
      const planned = team.player && !!career.plan;
      if (planned) {
        // The week's plan already paid out before the draft.
      } else if (team.training === 'rest') {
        player.fatigue -= 14;
        player.morale = clamp(player.morale + 3, 5, 100);
      } else if (team.training === 'academy') {
        if (onDev) {
          tryGain(rng, player, 'mechanics', 0.55 * mult);
          tryGain(rng, player, 'macro', 0.45 * mult);
          const best = Object.entries(player.mastery).sort((a, b) => b[1] - a[1])[0]?.[0];
          if (best) bumpMastery(player, best, Math.max(1, Math.round(2 * mult)));
          player.fatigue += 4;
        } else player.fatigue -= 8;
      } else if (team.training === 'mechanics') {
        tryGain(rng, player, 'mechanics', 0.42 * mult);
        player.fatigue += 3;
      } else if (team.training === 'macro') {
        tryGain(rng, player, 'macro', 0.42 * mult);
        player.fatigue += 2;
      } else if (team.training === 'synergy') {
        tryGain(rng, player, 'teamwork', 0.4 * mult);
        player.fatigue += 3;
      } else if (team.training === 'champion') {
        const gain = (team.main.includes(id) ? 3 : 2) * facility.training * (onDev ? facility.dev : 1);
        bumpMastery(player, team.trainingChamp, Math.max(1, Math.round(gain)));
        if (team.trainingChamp === player.study) bumpMastery(player, team.trainingChamp, 1);
        player.fatigue += 3;
      }
      player.fatigue = clamp(player.fatigue - 14 * facility.recovery, 0, 100);
      player.morale = clamp(player.morale + (68 - player.morale) * 0.08, 5, 100);
      player.form = clamp(player.form * 0.84, -10, 10);
    }
    if (team.training === 'synergy' && !(team.player && career.plan)) team.chemistry = clamp(team.chemistry + 2, 15, 100);
  }
}

function applyOutcome(career: Career, teamId: string, draft: Draft, won: boolean, games: number, mvpId: string): void {
  const team = teamById(career, teamId);
  for (const id of rosterIds(team)) {
    const player = career.players[id];
    const started = draft.playerIds.includes(id);
    const swing = player.trait === 'volatile' ? 1.8 : 1;
    if (started) {
      player.seasonGames += games;
      player.careerGames += games;
      if (won) player.seasonWins += 1;
      player.form = clamp(player.form + (won ? 2 : -2) * swing, -10, 10);
      player.morale = clamp(player.morale + (won ? 5 : -3), 5, 100);
      const champId = draft.champs[id];
      if (champId) bumpMastery(player, champId, team.dev.includes(id) ? 2 : 1);
      if (champId && champId === player.study) bumpMastery(player, champId, 2);
      if (id === mvpId) {
        player.seasonMvps += 1;
        player.careerMvps += 1;
        player.morale = clamp(player.morale + 4, 5, 100);
      }
    } else if (team.main.includes(id) && team.training !== 'rest' && team.training !== 'academy') {
      player.morale = clamp(player.morale - 2, 5, 100);
    }
  }
  if (draft.playerIds.every((id) => team.main.includes(id))) team.chemistry = clamp(team.chemistry + 1, 15, 100);
}

interface Resolved {
  winnerId: string;
  homeWins: number;
  awayWins: number;
  games: WeekReport['games'];
  mvpId: string;
  mvpName: string;
  homeDraft: Draft;
  awayDraft: Draft;
}

function resolveFixture(career: Career, rng: Rng, fixture: Fixture, lineup: Lineup | null): Resolved {
  const you = career.playerTeamId;
  const playerIn = fixture.homeId === you || fixture.awayId === you;
  let homeDraft: Draft;
  let awayDraft: Draft;
  if (playerIn && lineup) {
    const foe = opponentOf(fixture, you);
    const banned = new Set<string>([lineup.ban, aiBan(career, foe, lineup.ban)]);
    const cpu = buildDraft(career, foe, banned, rng);
    const yours: Draft = { playerIds: [...lineup.playerIds], champs: { ...lineup.champs }, strategy: lineup.strategy };
    if (fixture.homeId === you) {
      homeDraft = yours;
      awayDraft = cpu;
    } else {
      homeDraft = cpu;
      awayDraft = yours;
    }
  } else {
    homeDraft = buildDraft(career, fixture.homeId, new Set(), rng);
    awayDraft = buildDraft(career, fixture.awayId, new Set(), rng);
  }
  const series = simulateSeries(career, rng, fixture, homeDraft, awayDraft, playerIn);
  return { ...series, homeDraft, awayDraft };
}

function logSeries(career: Career, fixture: Fixture, resolved: Resolved, label: string): void {
  for (const game of resolved.games) {
    const entry: GameLog = {
      season: career.year,
      kind: fixture.kind,
      homeId: fixture.homeId,
      awayId: fixture.awayId,
      winnerId: game.winnerId,
      homeKills: game.homeKills,
      awayKills: game.awayKills,
      label
    };
    career.results.push(entry);
  }
  const slots = seriesSlots(career, fixture.kind);
  const slot = slots?.find((entry) => entry.homeId === fixture.homeId && entry.awayId === fixture.awayId);
  if (slot) {
    slot.homeWins = resolved.homeWins;
    slot.awayWins = resolved.awayWins;
    slot.done = true;
  }
  if (fixture.kind === 'cup-final' && career.cup) career.cup.championId = resolved.winnerId;
  if (fixture.kind === 'playoff-final' && career.playoffs) career.playoffs.championId = resolved.winnerId;
}

function seriesSlots(career: Career, kind: MatchKind): SeriesState[] | null {
  if (kind === 'cup-semi') return career.cup?.semis ?? null;
  if (kind === 'cup-final' && career.cup?.final) return [career.cup.final];
  if (kind === 'play-in') return career.playoffs?.playIn ?? null;
  if (kind === 'playoff-semi') return career.playoffs?.semis ?? null;
  if (kind === 'playoff-final' && career.playoffs?.final) return [career.playoffs.final];
  return null;
}

function injuredAtStart(career: Career): Set<string> {
  const ids = new Set<string>();
  for (const team of career.orgs) {
    for (const id of rosterIds(team)) if (career.players[id].injured > 0) ids.add(id);
  }
  return ids;
}

function healStartedInjuries(career: Career, started: Set<string>): void {
  for (const id of started) {
    const player = career.players[id];
    if (player) player.injured = Math.max(0, player.injured - 1);
  }
}

function tieKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function readTie(career: Career, a: string, b: string): number {
  if (!a || !b || a === b) return 0;
  return career.ties?.[tieKey(a, b)] ?? 0;
}

function shiftTie(career: Career, a: string, b: string, delta: number): void {
  if (!a || !b || a === b || !delta) return;
  const key = tieKey(a, b);
  const value = clamp((career.ties[key] ?? 0) + delta, -3, 3);
  if (value === 0) delete career.ties[key];
  else career.ties[key] = value;
}

function clearTies(career: Career, id: string): void {
  for (const key of Object.keys(career.ties ?? {})) {
    if (key.split('|').includes(id)) delete career.ties[key];
  }
  if (career.promiseId === id) career.promiseId = null;
}

function seedTies(career: Career, rng: Rng): void {
  career.ties = {};
  shiftTie(career, 'mina', 'veil', 2);
  shiftTie(career, 'kite', 'boom', -2);
  shiftTie(career, 'nyx', 'veil', 2);
  shiftTie(career, 'wolf', 'mina', 1);
  shiftTie(career, 'kite', 'mina', 1);
  for (const team of career.orgs) {
    if (team.player) continue;
    const ids = rng.shuffle(rosterIds(team));
    if (ids.length >= 2) shiftTie(career, ids[0], ids[1], 2);
    if (ids.length >= 4) shiftTie(career, ids[2], ids[3], -2);
  }
}

function retieNewcomer(career: Career, team: Team, id: string, rng: Rng): void {
  clearTies(career, id);
  const mates = rosterIds(team).filter((other) => other !== id);
  if (!mates.length) return;
  const friend = rng.pick(mates);
  shiftTie(career, id, friend, 1);
  const cold = mates.find((other) => other !== friend);
  if (cold) shiftTie(career, id, cold, -1);
}

function shareRoom(career: Career, rng: Rng, roster: Player[]): RoomEvent {
  const ids = roster.map((player) => player.id);
  let leftId = ids[0];
  let rightId = ids[1] ?? ids[0];
  let found = false;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      if (readTie(career, ids[i], ids[j]) <= -1) {
        leftId = ids[i];
        rightId = ids[j];
        found = true;
      }
    }
  }
  if (!found) {
    const shuffled = rng.shuffle(ids);
    leftId = shuffled[0];
    rightId = shuffled[1] ?? shuffled[0];
  }
  const left = career.players[leftId];
  const right = career.players[rightId];
  return {
    kind: 'share',
    ids: [leftId, rightId],
    text: `${left.nick} and ${right.nick} both want the same practice block. The one you pass over will hear it.`,
    a: { label: `Side with ${left.nick}`, detail: `${left.nick} rises. ${right.nick} takes it personally.` },
    b: { label: 'Split the block', detail: 'Both stay. Both tire a little. The friction eases.' }
  };
}

function promiseRoom(career: Career, player: Player): RoomEvent {
  const team = playerTeam(career);
  const from = player.sat >= 2 ? 'Two weeks on the bench made it a demand.' : team.dev.includes(player.id) ? 'The ask comes from development.' : 'They want the rift, not the comms chair.';
  return {
    kind: 'promise',
    ids: [player.id],
    text: `${player.nick} wants this series. ${from}`,
    a: { label: `Promise ${player.nick} the start`, detail: 'Queue them or the room hears the break.' },
    b: { label: 'Keep the board yours', detail: `${player.nick} loses the argument and a little trust.` }
  };
}

function restRoom(player: Player): RoomEvent {
  return {
    kind: 'rest',
    ids: [player.id],
    text: `${player.nick} is at ${Math.round(player.fatigue)} fatigue. Another hard series and the wrist goes.`,
    a: { label: `Give ${player.nick} the block off`, detail: 'Fatigue drops. A start promise on top of a rest would be noise.' },
    b: { label: 'Push through', detail: 'Morale holds. The fatigue comes into the match.' }
  };
}

function studyRoom(career: Career, rng: Rng, roster: Player[]): RoomEvent {
  const player = rng.pick(roster);
  const options = roleChamps(player.role).filter((id) => id !== player.study);
  const champId = [...options].sort((a, b) => (career.patch[b] ?? 0) - (career.patch[a] ?? 0))[0] ?? player.study;
  return {
    kind: 'study',
    ids: [player.id],
    champId,
    text: `${player.nick} wants the week on ${champName(champId)}. That champion becomes what they queue until you change it.`,
    a: { label: `Let ${player.nick} study ${champName(champId)}`, detail: 'Mastery jumps now. Auto draft leans on it.' },
    b: { label: 'Stay on the current pool', detail: `${player.nick} keeps ${champName(player.study)} and loses the argument.` }
  };
}

function filmRoom(player: Player): RoomEvent {
  return {
    kind: 'film',
    ids: [player.id],
    text: `${player.nick} wants to stream the garage. The router can take it. The neighbors already know the schedule.`,
    a: { label: 'Open the stream', detail: 'Fans show up. The extra hour costs fatigue.' },
    b: { label: 'Keep the house closed', detail: 'Chemistry over content. No extra eyes this week.' }
  };
}

function rollRoom(career: Career, rng: Rng): RoomEvent | null {
  if (career.stage.kind === 'offseason' || !findPlayerFixture(career)) return null;
  const team = playerTeam(career);
  const roster = rosterIds(team).map((id) => career.players[id]).filter(Boolean);
  if (roster.length < 2) return null;
  const sat = roster.filter((player) => team.main.includes(player.id) && player.sat >= 2 && player.injured <= 0);
  const tired = [...roster].filter((player) => player.injured <= 0).sort((a, b) => b.fatigue - a.fatigue);
  const dev = roster.filter((player) => team.dev.includes(player.id) && player.injured <= 0);
  if (sat[0] && rng.chance(0.75)) return promiseRoom(career, sat[0]);
  if (tired[0] && tired[0].fatigue >= 40 && rng.chance(0.6)) return restRoom(tired[0]);
  const kind = rng.pick(['share', 'promise', 'study', 'film'] as const);
  if (kind === 'share') return shareRoom(career, rng, roster);
  if (kind === 'promise') return promiseRoom(career, rng.pick(dev.length ? dev : roster));
  if (kind === 'study') return studyRoom(career, rng, roster);
  return filmRoom(rng.pick(roster));
}

function applyRoom(career: Career, side: 'a' | 'b'): void {
  const room = career.room;
  if (!room) return;
  const team = playerTeam(career);
  const first = career.players[room.ids[0]];
  const second = room.ids[1] ? career.players[room.ids[1]] : undefined;
  if (room.kind === 'share' && first && second) {
    if (side === 'a') {
      first.morale = clamp(first.morale + 6, 5, 100);
      second.morale = clamp(second.morale - 5, 5, 100);
      shiftTie(career, first.id, second.id, -1);
      career.roomEcho = `${first.nick} got the block. ${second.nick} will remember it.`;
    } else {
      first.morale = clamp(first.morale + 3, 5, 100);
      second.morale = clamp(second.morale + 3, 5, 100);
      first.fatigue = clamp(first.fatigue + 3, 0, 100);
      second.fatigue = clamp(second.fatigue + 3, 0, 100);
      shiftTie(career, first.id, second.id, 1);
      career.roomEcho = `${first.nick} and ${second.nick} split the block. The edge between them softens.`;
    }
  } else if (room.kind === 'promise' && first) {
    if (side === 'a') {
      if (career.promiseId && career.promiseId !== first.id) {
        const prev = career.players[career.promiseId];
        if (prev) prev.morale = clamp(prev.morale - 4, 5, 100);
      }
      career.promiseId = first.id;
      first.morale = clamp(first.morale + 3, 5, 100);
      career.roomEcho = `${first.nick} has this series if you queue them.`;
    } else {
      first.morale = clamp(first.morale - 4, 5, 100);
      const leader = rosterIds(team).find((id) => career.players[id].trait === 'leader' && id !== first.id);
      if (leader) shiftTie(career, first.id, leader, -1);
      career.roomEcho = `${first.nick} asked for the series and heard no.`;
    }
  } else if (room.kind === 'rest' && first) {
    if (side === 'a') {
      first.fatigue = clamp(first.fatigue - 16, 0, 100);
      first.morale = clamp(first.morale + 2, 5, 100);
      if (career.promiseId === first.id) career.promiseId = null;
      career.roomEcho = `${first.nick} spends the block off the PC.`;
    } else {
      first.fatigue = clamp(first.fatigue + 5, 0, 100);
      first.morale = clamp(first.morale + 3, 5, 100);
      career.roomEcho = `${first.nick} pushes through the fatigue.`;
    }
  } else if (room.kind === 'study' && first && room.champId) {
    if (side === 'a') {
      first.study = room.champId;
      bumpMastery(first, room.champId, 4);
      first.morale = clamp(first.morale + 3, 5, 100);
      career.roomEcho = `${first.nick} spends the week on ${champName(room.champId)}.`;
    } else {
      first.morale = clamp(first.morale - 3, 5, 100);
      first.form = clamp(first.form - 1, -10, 10);
      career.roomEcho = `${first.nick} stays on ${champName(first.study)}.`;
    }
  } else if (room.kind === 'film' && first) {
    if (side === 'a') {
      team.fans += 60;
      first.fatigue = clamp(first.fatigue + 8, 0, 100);
      first.morale = clamp(first.morale + 4, 5, 100);
      career.roomEcho = `${first.nick} streams the garage. A few more people know the tag.`;
    } else {
      team.chemistry = clamp(team.chemistry + 2, 15, 100);
      first.morale = clamp(first.morale + 2, 5, 100);
      career.roomEcho = 'The stream stays off. The house gets the hour.';
    }
  }
  if (career.roomEcho) pushNews(career, career.roomEcho);
}

export function chooseRoom(career: Career, side: 'a' | 'b'): { career: Career; error?: string } {
  if (!career.room) return { career, error: 'The room is quiet.' };
  if (career.roomSpent) return { career, error: 'That conversation already happened.' };
  const next = structuredClone(career);
  applyRoom(next, side);
  next.roomSpent = true;
  return { career: next };
}

export function setPromise(career: Career, id: string): { career: Career; error?: string } {
  if (career.stage.kind === 'offseason') return { career, error: 'Promises wait until there is a match.' };
  const next = structuredClone(career);
  const team = playerTeam(next);
  if (!rosterIds(team).includes(id)) return { career: next, error: 'That player is not in the building.' };
  const player = next.players[id];
  if (player.injured > 0) return { career: next, error: `${player.nick} is hurt.` };
  if (next.promiseId === id) {
    next.promiseId = null;
    player.morale = clamp(player.morale - 3, 5, 100);
    pushNews(next, `The promise to ${player.nick} is pulled.`);
    return { career: next };
  }
  if (next.promiseId && next.promiseId !== id) {
    const prev = next.players[next.promiseId];
    if (prev) prev.morale = clamp(prev.morale - 4, 5, 100);
  }
  next.promiseId = id;
  player.morale = clamp(player.morale + 2, 5, 100);
  pushNews(next, `${player.nick} is promised this series.`);
  return { career: next };
}

export function setStudy(career: Career, id: string, champId: string): { career: Career; error?: string } {
  const next = structuredClone(career);
  const player = next.players[id];
  const team = playerTeam(next);
  if (!player || !rosterIds(team).includes(id)) return { career: next, error: 'That player is not on the roster.' };
  if (!roleChamps(player.role).includes(champId)) return { career: next, error: 'Study stays inside the role.' };
  player.study = champId;
  return { career: next };
}

function settleMinutes(career: Career, queued: string[], won: boolean, report: WeekReport, rng: Rng): void {
  const team = playerTeam(career);
  const started = new Set(queued);
  if (career.promiseId) {
    const player = career.players[career.promiseId];
    if (player && rosterIds(team).includes(player.id) && player.injured <= 0) {
      if (started.has(player.id)) {
        player.morale = clamp(player.morale + 5, 5, 100);
        player.form = clamp(player.form + 1, -10, 10);
        report.notes.push(`${player.nick} was promised the series, and you kept it.`);
      } else {
        player.morale = clamp(player.morale - 12, 5, 100);
        team.chemistry = clamp(team.chemistry - 4, 15, 100);
        const leader = rosterIds(team).find((id) => career.players[id].trait === 'leader' && id !== player.id);
        if (leader) shiftTie(career, player.id, leader, -1);
        report.notes.push(`${player.nick} was promised the series and sat. The room heard it.`);
      }
    }
    career.promiseId = null;
  }
  for (const id of rosterIds(team)) {
    const player = career.players[id];
    if (team.main.includes(id) && player.injured <= 0 && !started.has(id)) player.sat += 1;
    else player.sat = 0;
    if (player.sat === 2) {
      player.morale = clamp(player.morale - 6, 5, 100);
      report.notes.push(`${player.nick} has sat two weeks running. Minutes are the conversation now.`);
    }
    if (player.sat >= 3) team.chemistry = clamp(team.chemistry - 1, 15, 100);
  }
  const live = queued.filter((id) => career.players[id]);
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const current = readTie(career, live[i], live[j]);
      if (won && current < 3 && rng.chance(0.35)) shiftTie(career, live[i], live[j], 1);
      if (!won && current > -3 && current < 0 && rng.chance(0.35)) shiftTie(career, live[i], live[j], -1);
    }
  }
}

export function raceLine(career: Career): string {
  const stage = career.stage.kind;
  if (stage === 'offseason') return 'The season is in the books. The market is the next match.';
  if (stage === 'preseason') return 'Exhibition. Wins here do not move the table, but a streak can.';
  if (stage === 'cup' || stage === 'cup-semi' || stage === 'cup-final') return 'Spire Cup week. The regular table waits, the building does not.';
  if (stage === 'play-in' || stage === 'playoff-semi' || stage === 'playoff-final') return 'The bracket is live. One series changes the year.';
  const rank = rankTeams(career);
  const place = rank.indexOf(career.playerTeamId) + 1;
  const rows = standingsFor(career, 'regular');
  const mine = rows.find((row) => row.teamId === career.playerTeamId);
  const second = rows.find((row) => row.teamId === rank[1]);
  const sixth = rows.find((row) => row.teamId === rank[5]);
  if (!mine || place < 1) return 'The table is still blank.';
  if (mine.wins + mine.losses === 0) return 'Everyone is 0-0. The first win is the whole story.';
  if (place <= 2) return `${placeName(place)}. A first-round bye is in the building.`;
  if (place <= 6) {
    const gap = Math.max(0, (second?.wins ?? mine.wins) - mine.wins);
    return gap === 0
      ? `${placeName(place)}, tied for a bye. The cut is under you.`
      : `${placeName(place)}, ${gap} win${gap === 1 ? '' : 's'} off a bye. The cut is under you.`;
  }
  const need = Math.max(1, (sixth?.wins ?? 0) - mine.wins + 1);
  return `${placeName(place)}, outside the cut. ${need} more win${need === 1 ? '' : 's'} and the picture changes.`;
}

function rollBounty(career: Career, rng: Rng): Bounty | null {
  if (career.stage.kind === 'offseason' || !findPlayerFixture(career)) return null;
  const fixture = findPlayerFixture(career);
  const foeId = fixture ? opponentOf(fixture, career.playerTeamId) : '';
  const pool: Bounty[] = [
    { id: 'win', text: 'Take the series.', reward: 1400 },
    { id: 'prospect', text: 'Start a development player.', reward: 1100 },
    { id: 'fresh', text: 'Queue three players under 45 fatigue.', reward: 900 },
    { id: 'mains', text: 'Start three players from the main roster.', reward: 800 }
  ];
  if (foeId && foeId === career.rivalId) {
    pool.push({ id: 'rival', text: `Beat ${teamById(career, foeId).name}.`, reward: 2200 });
  }
  return rng.pick(pool);
}

function bumpStreak(career: Career, won: boolean): void {
  const before = career.streak ?? 0;
  career.streak = won ? (before > 0 ? before + 1 : 1) : before < 0 ? before - 1 : -1;
  const team = playerTeam(career);
  if (won && career.streak >= 3) team.fans += 20 * Math.min(career.streak, 6);
  if (career.streak === 3) pushNews(career, 'Three straight wins. The building is loud.');
  if (career.streak === 5) pushNews(career, 'Five straight. The rest of the circuit is watching.');
  if (career.streak === -3) pushNews(career, 'Three straight losses. Someone has to answer it.');
}

interface GrowthSnap {
  ovr: number;
  mechanics: number;
  macro: number;
  teamwork: number;
  clutch: number;
  mastery: Record<string, number>;
}

function growthSnapshot(career: Career): Map<string, GrowthSnap> {
  const snap = new Map<string, GrowthSnap>();
  for (const id of rosterIds(playerTeam(career))) {
    const player = career.players[id];
    snap.set(id, {
      ovr: overall(player),
      mechanics: player.mechanics,
      macro: player.macro,
      teamwork: player.teamwork,
      clutch: player.clutch,
      mastery: { ...player.mastery }
    });
  }
  return snap;
}

function growthDiff(career: Career, before: Map<string, GrowthSnap>): { nick: string; text: string }[] {
  const notes: { nick: string; text: string }[] = [];
  for (const id of rosterIds(playerTeam(career))) {
    const player = career.players[id];
    const was = before.get(id);
    if (!was) continue;
    const bits: string[] = [];
    const ovr = overall(player);
    if (ovr > was.ovr) bits.push(`OVR ${was.ovr}→${ovr}`);
    for (const key of ['mechanics', 'macro', 'teamwork', 'clutch'] as const) {
      if (player[key] > was[key]) bits.push(`${key} ${was[key]}→${player[key]}`);
    }
    for (const [champ, value] of Object.entries(player.mastery)) {
      const prev = was.mastery[champ] ?? 0;
      if (value >= prev + 2) bits.push(`${champName(champ)} ${prev}→${value}`);
    }
    if (bits.length) notes.push({ nick: player.nick, text: bits.slice(0, 3).join(' · ') });
  }
  return notes.slice(0, 4);
}

function nextHook(career: Career): string {
  if (career.stage.kind === 'offseason') return 'The market is open. Re-sign, or the next season does not start.';
  const fixture = findPlayerFixture(career);
  if (!fixture) return career.bounty ? `Bounty: ${career.bounty.text}` : 'The week is open.';
  const foe = teamById(career, opponentOf(fixture, career.playerTeamId));
  const where = fixture.homeId === career.playerTeamId ? 'Home' : 'Away';
  const bounty = career.bounty ? ` Bounty: ${career.bounty.text}` : '';
  const rival = foe.id === career.rivalId ? ' Rivalry week.' : '';
  return `Next: ${where} against ${foe.name}.${rival}${bounty}`;
}

export function playCurrentWeek(career: Career): Career {
  const problems = lineupProblems(career);
  if (problems.length) throw new Error(problems[0]);
  const week = describeWeek(career);
  if (!week) throw new Error('No week to play.');
  const next = structuredClone(career);
  const rng = new Rng(next.rngState);
  const fixtureList = week.fixtures;
  const you = next.playerTeamId;
  const yours = playerTeam(next);
  const startedHurt = injuredAtStart(next);
  const played = new Set<string>();
  const report: WeekReport = {
    label: week.label,
    kind: fixtureList.find((fixture) => fixture.homeId === you || fixture.awayId === you)?.kind ?? 'bye',
    home: false,
    won: false,
    games: [],
    cashDelta: 0,
    fansDelta: 0,
    notes: [],
    patchNotes: []
  };
  const cashBefore = yours.cash;
  const fansBefore = yours.fans;
  const queued = [...next.lineup.playerIds];
  const freshQueue = queued.length === 3 && queued.every((id) => (next.players[id]?.fatigue ?? 100) < 45);
  const prospectStart = queued.some((id) => yours.dev.includes(id));
  const mainsStart = queued.length === 3 && queued.every((id) => yours.main.includes(id));
  const also: string[] = [];
  let playerPrize = 0;
  let playerPlayed = false;
  if (next.room && !next.roomSpent) {
    const ignored = next.players[next.room.ids[0]];
    if (ignored) ignored.morale = clamp(ignored.morale - 4, 5, 100);
    next.roomEcho = ignored ? `${ignored.nick} wanted a word before the match. You walked past them.` : 'The room was left alone.';
    next.roomSpent = true;
    pushNews(next, next.roomEcho);
  }

  for (const fixture of fixtureList) {
    const isYou = fixture.homeId === you || fixture.awayId === you;
    const resolved = resolveFixture(next, rng, fixture, isYou ? next.lineup : null);
    logSeries(next, fixture, resolved, week.label);
    applyOutcome(next, fixture.homeId, resolved.homeDraft, resolved.winnerId === fixture.homeId, resolved.games.length, resolved.mvpId);
    applyOutcome(next, fixture.awayId, resolved.awayDraft, resolved.winnerId === fixture.awayId, resolved.games.length, resolved.mvpId);
    for (const id of [...resolved.homeDraft.playerIds, ...resolved.awayDraft.playerIds]) played.add(id);
    if (isYou) {
      playerPlayed = true;
      const foeId = opponentOf(fixture, you);
      const foe = teamById(next, foeId);
      const playerWins = fixture.homeId === you ? resolved.homeWins : resolved.awayWins;
      const foeWins = fixture.homeId === you ? resolved.awayWins : resolved.homeWins;
      report.opponentId = foeId;
      report.opponentName = foe.name;
      report.home = fixture.homeId === you;
      report.won = resolved.winnerId === you;
      report.scoreline = `${playerWins}–${foeWins}`;
      report.games = resolved.games;
      report.mvpName = resolved.mvpName;
      report.kind = fixture.kind;
      playerPrize = prizeFor(fixture.kind, report.won === true);
      const upset = foe.fans > yours.fans * 1.5;
      yours.fans = Math.max(200, yours.fans + fanSwing(fixture.kind, report.won === true, upset));
      if (foeId === next.rivalId) {
        next.rivalHeat = clamp(next.rivalHeat + (report.won ? 14 : 7), 0, 100);
        if (report.won) {
          yours.fans += 30 + Math.round(next.rivalHeat * 0.6);
          yours.reputation = clamp(yours.reputation + 1, 0, 100);
          report.notes.push('Rivalry series. The building wanted this one.');
        } else report.notes.push('Rivalry series. They get to talk until you meet again.');
      }
      if (report.won && fixture.kind === 'regular') yours.reputation = clamp(yours.reputation + 1, 0, 100);
      if (report.won && fixture.kind === 'cup') yours.reputation = clamp(yours.reputation + 1, 0, 100);
      if (report.won && fixture.kind === 'play-in') yours.reputation = clamp(yours.reputation + 2, 0, 100);
      if (report.won && fixture.kind === 'playoff-semi') yours.reputation = clamp(yours.reputation + 3, 0, 100);
      if (report.won) markGoal(next, 'win');
      pushNews(next, `${yours.tag} ${report.scoreline} ${foe.tag}. ${report.won ? 'Win' : 'Loss'}${report.mvpName ? `, ${report.mvpName} MVP` : ''}.`);
    } else {
      const home = teamById(next, fixture.homeId);
      const away = teamById(next, fixture.awayId);
      also.push(`${home.tag} ${resolved.homeWins}–${resolved.awayWins} ${away.tag}`);
    }
  }
  if (also.length) report.notes.push(`Also this week: ${also.join(', ')}.`);
  if (playerPlayed) settleMinutes(next, queued, report.won === true, report, rng);
  if (next.lastScrim && next.scrimDone) report.notes.unshift(next.lastScrim.note);
  next.offers = [];
  healStartedInjuries(next, startedHurt);
  const beforeGrowth = growthSnapshot(next);
  trainAll(next, rng, played);
  report.growth = growthDiff(next, beforeGrowth);
  if (playerPlayed) bumpStreak(next, report.won === true);
  report.streakAfter = next.streak;
  report.raceLine = raceLine(next);

  const facility = facilityAt(yours.facility);
  const payroll = rosterIds(yours).reduce((sum, id) => sum + next.players[id].salary, 0);
  const sponsor = Math.round((1500 + yours.reputation * 55) * facility.revenue);
  let matchDay = 0;
  if (playerPlayed) {
    const base = report.won ? 3400 : 1600;
    const fanCut = fansBefore * (report.won ? 0.85 : 0.3);
    matchDay = Math.round((base + fanCut) * facility.revenue);
  }
  const content = yours.facility >= 6 ? Math.round(400 * facility.revenue) : 0;
  book(next, week.label, 'Sponsorship', sponsor);
  if (matchDay) book(next, week.label, report.won ? 'Match day' : 'Match day, loss', matchDay);
  if (playerPrize) book(next, week.label, 'Prize money', playerPrize);
  const bounty = next.bounty;
  const bountyCleared =
    !!bounty &&
    playerPlayed &&
    ((bounty.id === 'win' && report.won === true) ||
      (bounty.id === 'prospect' && prospectStart) ||
      (bounty.id === 'fresh' && freshQueue) ||
      (bounty.id === 'mains' && mainsStart) ||
      (bounty.id === 'rival' && report.opponentId === next.rivalId && report.won === true));
  if (bounty && bountyCleared) {
    book(next, week.label, 'Bounty', bounty.reward);
    for (const id of queued) {
      const player = next.players[id];
      if (player) player.morale = clamp(player.morale + 2, 5, 100);
    }
    pushNews(next, `Bounty cleared: ${bounty.text}`);
    report.bountyNote = `Bounty cleared: ${bounty.text} ${dollars(bounty.reward)}.`;
  } else if (bounty && playerPlayed) {
    report.bountyNote = `Bounty missed: ${bounty.text}`;
  }
  if (content) book(next, week.label, 'Campus content', content);
  book(next, week.label, 'Salaries', -payroll);
  book(next, week.label, `${facility.name} upkeep`, -facility.upkeep);

  if (yours.cash < 0) {
    const before = yours.cash;
    yours.cash = 500;
    next.charityCount += 1;
    yours.reputation = clamp(yours.reputation - 2, 0, 100);
    yours.fans += 120;
    for (const id of rosterIds(yours)) next.players[id].morale = clamp(next.players[id].morale - 6, 5, 100);
    next.ledger.unshift({
      label: week.label,
      note: 'Charity stream',
      amount: 500 - before,
      balance: yours.cash
    });
    pushNews(next, 'A charity stream keeps the power on. The roster is embarrassed, and a little grateful.');
    report.notes.push('Cash went under. A charity stream covered the hole.');
  }

  advance(next, rng, report);
  if (next.planNote) report.planNote = next.planNote;
  next.plan = null;
  next.planNote = '';
  next.scrimDone = false;
  if (next.roomEcho) report.roomNote = next.roomEcho;
  next.roomEcho = '';
  next.room = next.stage.kind === 'offseason' ? null : rollRoom(next, rng);
  next.roomSpent = false;
  next.bounty = next.stage.kind === 'offseason' ? null : rollBounty(next, rng);
  report.nextHook = nextHook(next);
  if (next.stage.kind !== 'offseason') refreshOffers(next, rng, false);
  report.cashDelta = yours.cash - cashBefore;
  report.fansDelta = yours.fans - fansBefore;
  next.lastReport = report;
  next.rngState = rng.state;
  return next;
}

function advance(career: Career, rng: Rng, report: WeekReport): void {
  const stage = career.stage;
  if (stage.kind === 'preseason') {
    career.stage = stage.round < 3 ? { kind: 'preseason', round: stage.round + 1 } : { kind: 'regular', round: 0 };
    if (career.stage.kind === 'regular') pushNews(career, 'Preseason is over. Regular season games start counting.');
    return;
  }
  if (stage.kind === 'regular') {
    if (stage.round === 5) {
      seedCup(career);
      career.stage = { kind: 'cup', round: 0 };
      career.cupResult = 'Group stage';
      pushNews(career, 'Spire Cup groups are locked. Three group games, then a knockout.');
      return;
    }
    if (stage.round < 13) {
      career.stage = { kind: 'regular', round: stage.round + 1 };
      return;
    }
    const ranking = rankTeams(career, 'regular');
    const place = ranking.indexOf(career.playerTeamId) + 1;
    career.playoffs = bracketFromRanking(ranking);
    if (place > 6) {
      simPlayoffRemainder(career, rng);
      career.playoffResult = 'Missed playoffs';
      const champion = teamById(career, career.playoffs.championId ?? ranking[0]);
      pushNews(career, `${champion.name} win the Pantheon Circuit. You finish ${placeName(place)} and watch.`);
      report.notes.push(`Regular season ends in ${placeName(place)}. The playoff cut is the top six.`);
      enterOffseason(career, rng);
      return;
    }
    markGoal(career, 'playoffs');
    if (place <= 2) {
      simListed(
        career,
        rng,
        career.playoffs.playIn.map((series, index) => ({
          id: `bye-play-in-${index}`,
          kind: 'play-in',
          series: 3,
          homeId: series.homeId,
          awayId: series.awayId
        })),
        'Playoffs · Play-in'
      );
      ensurePlayoffSemis(career);
      career.playoffResult = 'Semifinal';
      career.stage = { kind: 'playoff-semi' };
      pushNews(career, `You finish ${placeName(place)} and take a bye into the semifinals.`);
      report.notes.push(`First-round bye as the ${placeName(place)} seed.`);
      return;
    }
    career.playoffResult = 'Play-in';
    career.stage = { kind: 'play-in' };
    pushNews(career, `You finish ${placeName(place)} and drop into the play-in.`);
    return;
  }
  if (stage.kind === 'cup' && career.cup) {
    if (stage.round < 2) {
      career.stage = { kind: 'cup', round: stage.round + 1 };
      return;
    }
    career.cup.semis = seedCupSemis(career);
    const involved = career.cup.semis.some((series) => series.homeId === career.playerTeamId || series.awayId === career.playerTeamId);
    if (!involved) {
      simCupRemainder(career, rng);
      career.cupResult = 'Group stage';
      const winner = teamById(career, career.cup.championId ?? career.cup.groups.a[0]);
      report.notes.push(`${winner.name} win the Spire Cup. Your group run ends here.`);
      pushNews(career, `${winner.name} lift the Spire Cup.`);
      startSecondHalf(career, rng, report);
      return;
    }
    career.cupResult = 'Semifinal';
    markGoal(career, 'cup');
    career.stage = { kind: 'cup-semi' };
    pushNews(career, 'The Spire Cup semifinal is yours.');
    return;
  }
  if (stage.kind === 'cup-semi' && career.cup) {
    const semi = career.cup.semis.find((series) => series.homeId === career.playerTeamId || series.awayId === career.playerTeamId);
    const won = seriesWinner(semi) === career.playerTeamId;
    if (!won) {
      simCupRemainder(career, rng);
      career.cupResult = 'Semifinal';
      const winner = teamById(career, career.cup.championId ?? career.playerTeamId);
      report.notes.push(`Semifinal loss. ${winner.name} win the Spire Cup.`);
      pushNews(career, `${winner.name} win the Spire Cup.`);
      startSecondHalf(career, rng, report);
      return;
    }
    career.cup.final = finalFromSemis(career, career.cup.semis, 'cup');
    career.cupResult = 'Final';
    career.stage = { kind: 'cup-final' };
    pushNews(career, 'Spire Cup final. One series for the in-season trophy.');
    return;
  }
  if (stage.kind === 'cup-final' && career.cup) {
    const won = career.cup.championId === career.playerTeamId;
    career.cupResult = won ? 'Champion' : 'Runner-up';
    if (won) {
      playerTeam(career).reputation = clamp(playerTeam(career).reputation + 6, 0, 100);
      pushNews(career, `${playerTeam(career).name} win the Spire Cup.`);
    } else if (career.cup.championId) {
      pushNews(career, `${teamById(career, career.cup.championId).name} win the Spire Cup.`);
    }
    startSecondHalf(career, rng, report);
    return;
  }
  if (stage.kind === 'play-in' && career.playoffs) {
    const series = career.playoffs.playIn.find((entry) => entry.homeId === career.playerTeamId || entry.awayId === career.playerTeamId);
    const won = seriesWinner(series) === career.playerTeamId;
    if (!won) {
      simPlayoffRemainder(career, rng);
      career.playoffResult = 'Play-in';
      const winner = teamById(career, career.playoffs.championId ?? career.playerTeamId);
      report.notes.push(`Play-in loss. ${winner.name} eventually win the Circuit.`);
      pushNews(career, `${winner.name} win the Pantheon Circuit.`);
      enterOffseason(career, rng);
      return;
    }
    ensurePlayoffSemis(career);
    career.playoffResult = 'Semifinal';
    career.stage = { kind: 'playoff-semi' };
    pushNews(career, 'Play-in won. The semifinal is next.');
    return;
  }
  if (stage.kind === 'playoff-semi' && career.playoffs) {
    const semi = career.playoffs.semis.find((series) => series.homeId === career.playerTeamId || series.awayId === career.playerTeamId);
    const won = seriesWinner(semi) === career.playerTeamId;
    if (!won) {
      simPlayoffRemainder(career, rng);
      career.playoffResult = 'Semifinal';
      const winner = teamById(career, career.playoffs.championId ?? career.playerTeamId);
      report.notes.push(`Season over in the semifinal. ${winner.name} win the Circuit.`);
      pushNews(career, `${winner.name} win the Pantheon Circuit.`);
      enterOffseason(career, rng);
      return;
    }
    career.playoffs.final = finalFromSemis(career, career.playoffs.semis, 'regular');
    career.playoffResult = 'Final';
    career.stage = { kind: 'playoff-final' };
    pushNews(career, 'Playoff final. Best of five for the Pantheon Circuit.');
    return;
  }
  if (stage.kind === 'playoff-final' && career.playoffs) {
    const won = career.playoffs.championId === career.playerTeamId;
    career.playoffResult = won ? 'Champion' : 'Runner-up';
    if (won) {
      playerTeam(career).reputation = clamp(playerTeam(career).reputation + 10, 0, 100);
      playerTeam(career).fans += 400;
      markGoal(career, 'title');
      pushNews(career, `${playerTeam(career).name} are champions of the Pantheon Circuit.`);
      report.notes.push('You won the season.');
    } else if (career.playoffs.championId) {
      pushNews(career, `${teamById(career, career.playoffs.championId).name} win the Pantheon Circuit.`);
      report.notes.push('Runner-up. The garage still remembers who reached the last series.');
    }
    enterOffseason(career, rng);
  }
}

function seriesWinner(series: SeriesState | undefined): string {
  if (!series) return '';
  return series.homeWins >= series.awayWins ? series.homeId : series.awayId;
}

function seedCup(career: Career): void {
  const ranking = rankTeams(career, 'regular');
  const cup: CupState = {
    groups: {
      a: [ranking[0], ranking[3], ranking[4], ranking[7]],
      b: [ranking[1], ranking[2], ranking[5], ranking[6]]
    },
    semis: [],
    final: null
  };
  career.cup = cup;
}

function seedCupSemis(career: Career): SeriesState[] {
  if (!career.cup) return [];
  const groupA = rankGroup(career, career.cup.groups.a);
  const groupB = rankGroup(career, career.cup.groups.b);
  return [
    { homeId: groupA[0], awayId: groupB[1], homeWins: 0, awayWins: 0, done: false },
    { homeId: groupB[0], awayId: groupA[1], homeWins: 0, awayWins: 0, done: false }
  ];
}

function finalFromSemis(career: Career, semis: SeriesState[], tiebreak: 'cup' | 'regular'): SeriesState {
  const left = seriesWinner(semis[0]);
  const right = seriesWinner(semis[1]);
  const rank = rankTeams(career, tiebreak);
  const home = rank.indexOf(left) <= rank.indexOf(right) ? left : right;
  const away = home === left ? right : left;
  return { homeId: home, awayId: away, homeWins: 0, awayWins: 0, done: false };
}

function simListed(career: Career, rng: Rng, fixtures: Fixture[], label: string): void {
  for (const fixture of fixtures) {
    const slots = seriesSlots(career, fixture.kind);
    const existing = slots?.find((slot) => slot.homeId === fixture.homeId && slot.awayId === fixture.awayId);
    if (existing?.done) continue;
    const resolved = resolveFixture(career, rng, fixture, null);
    logSeries(career, fixture, resolved, label);
    applyOutcome(career, fixture.homeId, resolved.homeDraft, resolved.winnerId === fixture.homeId, resolved.games.length, resolved.mvpId);
    applyOutcome(career, fixture.awayId, resolved.awayDraft, resolved.winnerId === fixture.awayId, resolved.games.length, resolved.mvpId);
  }
}

function simCupRemainder(career: Career, rng: Rng): void {
  if (!career.cup) return;
  if (!career.cup.semis.length) career.cup.semis = seedCupSemis(career);
  simListed(
    career,
    rng,
    career.cup.semis.map((series, index) => ({
      id: `auto-cup-semi-${index}`,
      kind: 'cup-semi',
      series: 3,
      homeId: series.homeId,
      awayId: series.awayId
    })),
    'Spire Cup · Semifinal'
  );
  if (!career.cup.final) career.cup.final = finalFromSemis(career, career.cup.semis, 'cup');
  simListed(
    career,
    rng,
    [
      {
        id: 'auto-cup-final',
        kind: 'cup-final',
        series: 3,
        homeId: career.cup.final.homeId,
        awayId: career.cup.final.awayId
      }
    ],
    'Spire Cup · Final'
  );
}

function bracketFromRanking(ranking: string[]): PlayoffState {
  const seeds = ranking.slice(0, 6);
  return {
    seeds,
    playIn: [
      { homeId: seeds[2], awayId: seeds[5], homeWins: 0, awayWins: 0, done: false },
      { homeId: seeds[3], awayId: seeds[4], homeWins: 0, awayWins: 0, done: false }
    ],
    semis: [],
    final: null
  };
}

function ensurePlayoffSemis(career: Career): void {
  const playoffs = career.playoffs;
  if (!playoffs || playoffs.semis.length || playoffs.playIn.some((series) => !series.done)) return;
  const winnerLow = seriesWinner(playoffs.playIn[0]);
  const winnerHigh = seriesWinner(playoffs.playIn[1]);
  playoffs.semis = [
    { homeId: playoffs.seeds[0], awayId: winnerHigh, homeWins: 0, awayWins: 0, done: false },
    { homeId: playoffs.seeds[1], awayId: winnerLow, homeWins: 0, awayWins: 0, done: false }
  ];
}

function simPlayoffRemainder(career: Career, rng: Rng): void {
  if (!career.playoffs) return;
  simListed(
    career,
    rng,
    career.playoffs.playIn.map((series, index) => ({
      id: `auto-play-in-${index}`,
      kind: 'play-in',
      series: 3,
      homeId: series.homeId,
      awayId: series.awayId
    })),
    'Playoffs · Play-in'
  );
  ensurePlayoffSemis(career);
  simListed(
    career,
    rng,
    career.playoffs.semis.map((series, index) => ({
      id: `auto-po-semi-${index}`,
      kind: 'playoff-semi',
      series: 3,
      homeId: series.homeId,
      awayId: series.awayId
    })),
    'Playoffs · Semifinal'
  );
  if (!career.playoffs.final) career.playoffs.final = finalFromSemis(career, career.playoffs.semis, 'regular');
  simListed(
    career,
    rng,
    [
      {
        id: 'auto-po-final',
        kind: 'playoff-final',
        series: 5,
        homeId: career.playoffs.final.homeId,
        awayId: career.playoffs.final.awayId
      }
    ],
    'Playoffs · Final'
  );
}

function startSecondHalf(career: Career, rng: Rng, report: WeekReport): void {
  if (!career.midPatchDone) {
    const notes = rollPatch(career, rng);
    career.midPatchDone = true;
    report.patchNotes = notes;
    pushNews(career, `Mid-season patch ${career.patchName} lands before the second half.`);
  }
  career.stage = { kind: 'regular', round: 6 };
}

function enterOffseason(career: Career, rng: Rng): void {
  career.stage = { kind: 'offseason' };
  career.offers = [];
  career.scrimDone = false;
  if (!career.awards.length || career.awards[0]?.year !== career.year) crownAwards(career);
  if (career.contractsProcessed) return;
  for (const team of career.orgs) {
    for (const id of rosterIds(team)) {
      const player = career.players[id];
      player.age += 1;
      player.fatigue = 0;
      player.form = 0;
      player.injured = 0;
      player.morale = clamp(player.morale + 6, 40, 92);
      if (player.age <= 23 && overall(player) < player.potential) {
        const keys = ['mechanics', 'macro', 'teamwork', 'clutch'] as const;
        const lowest = [...keys].sort((a, b) => player[a] - player[b])[0];
        player[lowest] = Math.min(99, player[lowest] + (player.trait === 'prodigy' ? 2 : 1));
      }
      if (player.age >= 30) player.mechanics = Math.max(40, player.mechanics - 1);
      if (team.player) {
        player.contractYears -= 1;
        if (player.contractYears <= 0) {
          player.contractYears = 0;
          player.contractStatus = 'expiring';
        }
      }
    }
    if (team.player) {
      team.fans = Math.max(300, Math.round(team.fans * 0.94));
      team.chemistry = clamp(team.chemistry + 2, 15, 100);
    }
  }
  generateFreeAgents(career, rng);
  career.contractsProcessed = true;
  pushNews(career, `Season ${career.year} is in the books. Contracts, the market, then next year.`);
}

function generateFreeAgents(career: Career, rng: Rng): void {
  for (const player of Object.values(career.players)) usedNicks.add(player.nick);
  const keep = new Set(career.orgs.flatMap((team) => rosterIds(team)));
  for (const id of career.freeAgents) {
    if (!keep.has(id)) delete career.players[id];
  }
  career.freeAgents = [];
  const team = playerTeam(career);
  const portraits = Array.from({ length: 18 }, (_, index) => `/portraits/port-${String(index + 7).padStart(2, '0')}.jpg`);
  const roles: Role[] = ['warden', 'slayer', 'weaver'];
  for (let i = 0; i < 8; i++) {
    const role = roles[i % 3];
    let ovr = clamp(62 + Math.floor(team.reputation / 8) + team.facility * 2 + rng.int(-4, 6), 58, 88);
    if (team.facility < 5) ovr = Math.min(ovr, 79);
    const id = `fa-${career.year}-${career.faSerial++}`;
    const player = makeGeneratedPlayer(rng, id, role, ovr, ovr + rng.int(6, 14), rng.int(18, 27), rng.pick(portraits));
    player.salary = demand(player);
    player.contractYears = 0;
    player.contractStatus = 'expiring';
    player.fatigue = 0;
    career.players[id] = player;
    career.freeAgents.push(id);
  }
}

export function upgradeFacility(career: Career): { career: Career; error?: string } {
  const next = structuredClone(career);
  const team = playerTeam(next);
  if (team.facility >= FACILITIES.length - 1) return { career: next, error: 'The facility is already complete.' };
  const target = FACILITIES[team.facility + 1];
  if (team.cash < target.cost) return { career: next, error: `Need ${dollars(target.cost - team.cash)} more.` };
  book(next, 'Facility', `Upgrade to ${target.name}`, -target.cost);
  team.facility += 1;
  pushNews(next, `${team.name} leave ${FACILITIES[team.facility - 1].name.toLowerCase()} for the ${target.name}.`);
  if (team.facility === 1) markGoal(next, 'garage');
  if (team.facility >= 7) markGoal(next, 'hq');
  return { career: next };
}

export function releasePlayer(career: Career, id: string): { career: Career; error?: string } {
  if (career.stage.kind !== 'offseason') return { career, error: 'Roster moves wait for the offseason.' };
  const next = structuredClone(career);
  const team = playerTeam(next);
  const player = next.players[id];
  if (!player || !rosterIds(team).includes(id)) return { career: next, error: 'That player is not on the roster.' };
  const cost = player.contractStatus === 'expiring' || player.contractYears <= 0 ? 0 : player.salary * 4 * player.contractYears;
  if (team.cash < cost) return { career: next, error: `Severance is ${dollars(cost)}.` };
  if (cost) book(next, 'Offseason', `Severance for ${player.nick}`, -cost);
  team.main = team.main.filter((entry) => entry !== id);
  team.dev = team.dev.filter((entry) => entry !== id);
  clearTies(next, id);
  if (!next.freeAgents.includes(id)) next.freeAgents.push(id);
  team.chemistry = clamp(team.chemistry - 6, 15, 100);
  next.lineup.playerIds = next.lineup.playerIds.filter((entry) => entry !== id);
  delete next.lineup.champs[id];
  pushNews(next, `${player.name} is released${cost ? ` with ${dollars(cost)} severance` : ''}.`);
  return { career: next };
}

export function resignPlayer(career: Career, id: string, years: number): { career: Career; error?: string } {
  if (career.stage.kind !== 'offseason') return { career, error: 'Deals are negotiated in the offseason.' };
  const next = structuredClone(career);
  const player = next.players[id];
  const team = playerTeam(next);
  if (!player || !rosterIds(team).includes(id)) return { career: next, error: 'That player is not on the roster.' };
  if (player.contractStatus !== 'expiring') return { career: next, error: `${player.nick} is already under contract.` };
  const safeYears = clamp(years, 1, 3);
  player.salary = demand(player);
  player.contractYears = safeYears;
  player.contractStatus = 'signed';
  pushNews(next, `${player.nick} re-signs for ${safeYears} season${safeYears === 1 ? '' : 's'} at ${dollars(player.salary)} a week.`);
  return { career: next };
}

export function signFreeAgent(career: Career, id: string, side: 'main' | 'dev', years: number): { career: Career; error?: string } {
  if (career.stage.kind !== 'offseason') return { career, error: 'Free agency opens in the offseason.' };
  const next = structuredClone(career);
  const team = playerTeam(next);
  const player = next.players[id];
  if (!player || !next.freeAgents.includes(id)) return { career: next, error: 'That free agent is gone.' };
  if (side === 'main' && team.main.length >= 4) return { career: next, error: 'The main roster is full. Release someone first.' };
  if (side === 'dev' && team.dev.length >= 2) return { career: next, error: 'The development team is full.' };
  if (overall(player) >= 80 && team.facility < 5) {
    return { career: next, error: `${player.nick} will not join before you have a performance center.` };
  }
  const bonus = player.salary * 2;
  if (team.cash < bonus) return { career: next, error: `Signing bonus is ${dollars(bonus)}.` };
  book(next, 'Offseason', `Signing bonus for ${player.nick}`, -bonus);
  next.freeAgents = next.freeAgents.filter((entry) => entry !== id);
  player.contractYears = clamp(years, 1, 3);
  player.contractStatus = 'signed';
  player.salary = demand(player);
  if (side === 'main') team.main.push(id);
  else team.dev.push(id);
  team.chemistry = clamp(team.chemistry - 6, 15, 100);
  pushNews(next, `${player.name} joins the ${side === 'main' ? 'main roster' : 'development team'}.`);
  return { career: next };
}

export function rosterReady(career: Career): string | null {
  const team = playerTeam(career);
  if (team.main.length !== 4 || team.dev.length !== 2) return 'You need 4 main roster players and 2 development players.';
  const open = rosterIds(team).filter((id) => career.players[id].contractStatus === 'expiring');
  if (open.length) return `${career.players[open[0]].nick} still needs a new contract or a release.`;
  return null;
}

export function beginNextSeason(career: Career): { career: Career; error?: string } {
  if (career.stage.kind !== 'offseason') return { career, error: 'The season is still being played.' };
  const problem = rosterReady(career);
  if (problem) return { career, error: problem };
  const next = structuredClone(career);
  const team = playerTeam(next);
  const standing = playerStanding(next);
  const mvp = next.awards.find((award) => award.id === 'mvp' && award.year === next.year);
  next.history.unshift({
    year: next.year,
    wins: standing.wins,
    losses: standing.losses,
    cup: next.cupResult,
    playoff: next.playoffResult,
    cash: team.cash,
    mvp: mvp ? `${mvp.playerName} (${teamById(next, mvp.teamId).tag})` : 'Unawarded'
  });
  next.year += 1;
  next.results = [];
  next.cup = null;
  next.playoffs = null;
  next.cupResult = 'Not started';
  next.playoffResult = 'Not started';
  next.contractsProcessed = false;
  next.midPatchDone = false;
  next.patchSerial = 0;
  next.charityCount = 0;
  next.stage = { kind: 'preseason', round: 0 };
  next.goals = freshGoals(team.facility);
  const rounds = scheduleFor(next.orgs.map((entry) => entry.id), next.year);
  next.regularRounds = rounds.regular;
  next.preseasonRounds = rounds.preseason;
  for (const id of Object.keys(next.players)) {
    const onRoster = next.orgs.some((entry) => rosterIds(entry).includes(id));
    if (!onRoster) {
      delete next.players[id];
      continue;
    }
    next.players[id].seasonGames = 0;
    next.players[id].seasonWins = 0;
    next.players[id].seasonMvps = 0;
    next.players[id].sat = 0;
  }
  next.freeAgents = [];
  next.scrimDone = false;
  next.lastScrim = null;
  next.offers = [];
  next.intel = {};
  next.streak = 0;
  next.rivalHeat = clamp((next.rivalHeat ?? 20) - 8, 12, 100);
  for (const champion of CHAMPIONS) next.patch[champion.id] = 0;
  const rng = new Rng(next.rngState);
  const notes = rollPatch(next, rng);
  next.promiseId = null;
  next.plan = null;
  next.planNote = '';
  next.roomEcho = '';
  next.bounty = rollBounty(next, rng);
  next.room = rollRoom(next, rng);
  next.roomSpent = false;
  next.rngState = rng.state;
  pushNews(next, `Season ${next.year} opens. Patch ${next.patchName}: ${notes[0] ?? 'A quiet rift.'}`);
  const filled = autofillLineup(next);
  next.lineup = filled.lineup;
  return { career: next };
}

export function payroll(career: Career): number {
  return rosterIds(playerTeam(career)).reduce((sum, id) => sum + career.players[id].salary, 0);
}

export function swapRoster(career: Career, a: string, b: string): Career {
  const next = structuredClone(career);
  const team = playerTeam(next);
  const aMain = team.main.indexOf(a);
  const bMain = team.main.indexOf(b);
  const aDev = team.dev.indexOf(a);
  const bDev = team.dev.indexOf(b);
  if (aMain >= 0 && bDev >= 0) {
    team.main[aMain] = b;
    team.dev[bDev] = a;
  } else if (bMain >= 0 && aDev >= 0) {
    team.main[bMain] = a;
    team.dev[aDev] = b;
  }
  return next;
}

export function setTraining(career: Career, focus: Training): Career {
  const next = structuredClone(career);
  playerTeam(next).training = focus;
  return next;
}

export function setTrainingChamp(career: Career, champId: string): Career {
  const next = structuredClone(career);
  if (CHAMPIONS.some((champion) => champion.id === champId)) playerTeam(next).trainingChamp = champId;
  return next;
}

export function normalizeCareer(career: Career): Career {
  career.scrimDone ??= false;
  career.lastScrim ??= null;
  career.offers ??= [];
  career.offerSeq ??= 1;
  career.awards ??= [];
  career.intel ??= {};
  career.streak ??= 0;
  career.bounty ??= null;
  career.rivalId ??= 'iron';
  career.rivalHeat ??= 28;
  career.ties ??= {};
  career.promiseId ??= null;
  career.room ??= null;
  career.roomSpent ??= false;
  career.roomEcho ??= '';
  career.plan ??= null;
  career.planNote ??= '';
  for (const player of Object.values(career.players)) {
    player.sat ??= 0;
    if (!player.study) player.study = bestMasteryId(player) || 'brynhild';
  }
  for (const season of career.history) season.mvp ??= 'Unawarded';
  return career;
}

function weekOpen(career: Career): string | null {
  if (career.stage.kind === 'offseason') return 'The building is dark until next season.';
  if (!describeWeek(career)) return 'There is no match to practice for.';
  if (career.scrimDone) return 'The practice block is already spent this week.';
  return null;
}

function finishScrim(career: Career, rng: Rng, report: ScrimReport): Career {
  career.scrimDone = true;
  career.lastScrim = report;
  career.rngState = rng.state;
  pushNews(career, report.note);
  return career;
}

export function lockPlan(career: Career, plan: WeekPlan): { career: Career; error?: string } {
  if (career.stage.kind === 'offseason' || !findPlayerFixture(career)) return { career, error: 'There is no match to plan for.' };
  if (career.plan || career.scrimDone) return { career, error: 'The plan is already locked.' };
  if (plan === 'house' || plan === 'scrim') {
    const fixture = findPlayerFixture(career);
    const foeId = fixture ? opponentOf(fixture, career.playerTeamId) : '';
    const result = plan === 'house' ? runHouseScrim(career) : runCircuitScrim(career, foeId);
    if (result.error) return result;
    result.career.plan = plan;
    result.career.planNote = result.career.lastScrim?.note ?? 'The plan is locked.';
    return result;
  }
  const next = structuredClone(career);
  const team = playerTeam(next);
  const facility = facilityAt(team.facility);
  if (plan === 'study') {
    const bits: string[] = [];
    for (const id of rosterIds(team)) {
      const player = next.players[id];
      if (player.injured > 0) continue;
      const before = player.mastery[player.study] ?? 0;
      const gain = Math.max(2, Math.round((team.main.includes(id) ? 4 : 3) * facility.training));
      bumpMastery(player, player.study, gain);
      player.fatigue = clamp(player.fatigue + 5, 0, 100);
      if (bits.length < 3) bits.push(`${player.nick} ${champName(player.study)} ${before}→${player.mastery[player.study]}`);
    }
    next.planNote = `Study block. ${bits.join(' · ')}.`;
  } else {
    let dropped = 0;
    for (const id of rosterIds(team)) {
      const player = next.players[id];
      const before = player.fatigue;
      player.fatigue = clamp(player.fatigue - 18, 0, 100);
      player.morale = clamp(player.morale + 3, 5, 100);
      dropped += before - player.fatigue;
    }
    next.planNote = `Rest day. ${Math.round(dropped)} fatigue came off the roster before the draft.`;
  }
  next.plan = plan;
  next.scrimDone = true;
  pushNews(next, next.planNote);
  return { career: next };
}

export function runHouseScrim(career: Career): { career: Career; error?: string } {
  const blocked = weekOpen(career);
  if (blocked) return { career, error: blocked };
  const next = structuredClone(career);
  const team = playerTeam(next);
  const healthy = rosterIds(team).filter((id) => next.players[id].injured <= 0);
  if (healthy.length < 4) return { career, error: 'The house block needs four healthy players.' };
  const starters = chooseStarterIds(next, team).filter((id) => healthy.includes(id));
  const prospects = healthy.filter((id) => !starters.includes(id));
  if (starters.length < 3 || prospects.length < 1) return { career, error: 'Not enough healthy players to split the block.' };
  const facility = facilityAt(team.facility);
  const rng = new Rng(next.rngState);
  const fatigue = Math.max(4, 9 - Math.round(facility.recovery * 3));
  for (const id of healthy) {
    const player = next.players[id];
    player.fatigue = clamp(player.fatigue + fatigue, 0, 100);
    player.form = clamp(player.form + 0.6, -10, 10);
    player.morale = clamp(player.morale + 1, 5, 100);
  }
  for (const id of prospects) {
    if (!team.dev.includes(id)) continue;
    const player = next.players[id];
    bumpMastery(player, bestMasteryId(player), facility.dev >= 1 ? 2 : 1);
    tryGain(rng, player, player.role === 'slayer' ? 'mechanics' : 'macro', 0.35 * facility.dev);
  }
  team.chemistry = clamp(team.chemistry + 2 + (facility.prep >= 5 ? 1 : 0), 15, 100);
  const names = (ids: string[]) => ids.map((id) => next.players[id].nick).join(', ');
  const note = `House block: ${names(starters)} ran sets against ${names(prospects)}. Chemistry is up, and so is the fatigue.`;
  return { career: finishScrim(next, rng, { kind: 'house', note }) };
}

export function runCircuitScrim(career: Career, opponentId: string): { career: Career; error?: string } {
  const blocked = weekOpen(career);
  if (blocked) return { career, error: blocked };
  const foe = career.orgs.find((team) => team.id === opponentId && !team.player);
  if (!foe) return { career, error: 'Pick another organization to scrim.' };
  const next = structuredClone(career);
  const team = playerTeam(next);
  const yoursHealthy = rosterIds(team).filter((id) => next.players[id].injured <= 0);
  if (yoursHealthy.length < 3) return { career, error: 'You need three healthy players to scrim.' };
  const rng = new Rng(next.rngState);
  const useLineup = lineupProblems(next).length === 0;
  const yours: Draft = useLineup
    ? { playerIds: [...next.lineup.playerIds], champs: { ...next.lineup.champs }, strategy: next.lineup.strategy }
    : buildDraft(next, team.id, new Set(), rng);
  const banned = new Set<string>();
  if (useLineup && next.lineup.ban) banned.add(next.lineup.ban);
  const theirs = buildDraft(next, foe.id, banned, rng);
  const fixture: Fixture = {
    id: `scrim-${next.year}-${opponentId}`,
    kind: 'preseason',
    series: 1,
    homeId: team.id,
    awayId: foe.id
  };
  const series = simulateSeries(next, rng, fixture, yours, theirs, false);
  const won = series.winnerId === team.id;
  const facility = facilityAt(team.facility);
  const purse = Math.round((won ? 700 : 220) * facility.revenue);
  book(next, 'Scrim', `${foe.tag} practice`, purse);
  for (const id of yours.playerIds) {
    const player = next.players[id];
    player.form = clamp(player.form + (won ? 1.2 : -0.4), -10, 10);
    player.morale = clamp(player.morale + (won ? 2 : -1), 5, 100);
    if (yours.champs[id]) bumpMastery(player, yours.champs[id], 1);
  }
  if (won) team.chemistry = clamp(team.chemistry + 1, 15, 100);
  next.intel[foe.id] = true;
  const week = findPlayerFixture(next);
  const sameWeek = week ? opponentOf(week, team.id) === foe.id : false;
  const scoreline = `${series.homeWins}–${series.awayWins}`;
  const note = `${won ? 'Won' : 'Lost'} the circuit scrim ${scoreline} against ${foe.name}. Their ${foe.strategy} habit is on the whiteboard.${sameWeek ? ' Their starters will feel the extra fatigue before the real series. So will yours.' : ''}`;
  return {
    career: finishScrim(next, rng, {
      kind: 'circuit',
      opponentId: foe.id,
      opponentName: foe.name,
      won,
      scoreline,
      note
    })
  };
}

function offerPairs(career: Career, gapLimit: number): { them: Team; mine: Player; theirs: Player; gap: number }[] {
  const you = playerTeam(career);
  const pairs: { them: Team; mine: Player; theirs: Player; gap: number }[] = [];
  for (const them of career.orgs) {
    if (them.player) continue;
    for (const mineId of rosterIds(you)) {
      const mine = career.players[mineId];
      for (const theirId of rosterIds(them)) {
        const theirs = career.players[theirId];
        if (mine.role !== theirs.role) continue;
        const gap = overall(mine) - overall(theirs);
        if (Math.abs(gap) > gapLimit) continue;
        pairs.push({ them, mine, theirs, gap });
      }
    }
  }
  return pairs.sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap));
}

function refreshOffers(career: Career, rng: Rng, force: boolean): void {
  if (career.stage.kind === 'offseason') {
    career.offers = [];
    return;
  }
  if (!force && !rng.chance(0.34)) return;
  const you = playerTeam(career);
  const pairs = offerPairs(career, force ? 12 : 8).slice(0, 8);
  if (!pairs.length) return;
  const pair = rng.pick(pairs);
  let cash = Math.round((pair.gap * 850) / 50) * 50;
  if (cash < 0 && you.cash < -cash) cash = 0;
  const yoursSide = you.main.includes(pair.mine.id) ? 'main roster' : 'development';
  const theirSide = pair.them.main.includes(pair.theirs.id) ? 'main roster' : 'development';
  const money =
    cash > 0 ? ` They will add ${dollars(cash)}.` : cash < 0 ? ` The seat costs ${dollars(-cash)}.` : '';
  const note = `${pair.them.name} want ${pair.mine.nick} (${overall(pair.mine)} ${pair.mine.role}, ${yoursSide}). They offer ${pair.theirs.nick} (${overall(pair.theirs)} ${pair.theirs.role}, pot ${pair.theirs.potential}, age ${pair.theirs.age}, ${theirSide}).${money}`;
  const offer: TradeOffer = {
    id: career.offerSeq++,
    fromTeamId: pair.them.id,
    theyGive: pair.theirs.id,
    theyWant: pair.mine.id,
    cash,
    note
  };
  career.offers = [offer];
  pushNews(career, `${pair.them.tag} called about ${pair.mine.nick}.`);
}

export function forceTradeOffer(career: Career): Career {
  const next = structuredClone(career);
  const rng = new Rng(next.rngState);
  next.offers = [];
  refreshOffers(next, rng, true);
  next.rngState = rng.state;
  return next;
}

function placeOnRoster(team: Team, outId: string, inId: string): void {
  const mainIndex = team.main.indexOf(outId);
  if (mainIndex >= 0) team.main[mainIndex] = inId;
  else team.dev[team.dev.indexOf(outId)] = inId;
}

export function acceptTrade(career: Career, offerId: number): { career: Career; error?: string } {
  const offer = career.offers.find((entry) => entry.id === offerId);
  if (!offer) return { career, error: 'That call has already gone cold.' };
  const next = structuredClone(career);
  const you = playerTeam(next);
  const them = next.orgs.find((team) => team.id === offer.fromTeamId);
  const live = next.offers.find((entry) => entry.id === offerId);
  if (!them || !live) return { career, error: 'That call has already gone cold.' };
  if (!rosterIds(you).includes(live.theyWant) || !rosterIds(them).includes(live.theyGive)) {
    return { career: next, error: 'The players in that offer are no longer on those rosters.' };
  }
  if (live.cash < 0 && you.cash < -live.cash) return { career: next, error: `You need ${dollars(-live.cash)} to make that deal.` };
  const incoming = next.players[live.theyGive];
  const outgoing = next.players[live.theyWant];
  placeOnRoster(you, live.theyWant, live.theyGive);
  placeOnRoster(them, live.theyGive, live.theyWant);
  if (live.cash) book(next, 'Trade', `${them.tag} for ${incoming.nick}`, live.cash);
  incoming.morale = clamp(incoming.morale - 4, 5, 100);
  outgoing.morale = clamp(outgoing.morale - 6, 5, 100);
  you.chemistry = clamp(you.chemistry - 7, 15, 100);
  them.chemistry = clamp(them.chemistry - 4, 15, 100);
  next.lineup.playerIds = next.lineup.playerIds.filter((id) => id !== live.theyWant);
  delete next.lineup.champs[live.theyWant];
  const dealRng = new Rng(next.rngState);
  retieNewcomer(next, you, incoming.id, dealRng);
  retieNewcomer(next, them, outgoing.id, dealRng);
  next.rngState = dealRng.state;
  next.offers = [];
  pushNews(next, `${outgoing.nick} goes to ${them.name}. ${incoming.nick} joins ${you.tag}.`);
  return { career: next };
}

export function declineTrade(career: Career, offerId: number): { career: Career; error?: string } {
  if (!career.offers.some((entry) => entry.id === offerId)) return { career, error: 'That call has already gone cold.' };
  const next = structuredClone(career);
  const offer = next.offers.find((entry) => entry.id === offerId);
  next.offers = next.offers.filter((entry) => entry.id !== offerId);
  if (offer) {
    const them = teamById(next, offer.fromTeamId);
    pushNews(next, `${playerTeam(next).tag} pass on ${them.tag}'s call.`);
  }
  return { career: next };
}

function crownAwards(career: Career): void {
  const pool = career.orgs.flatMap((team) => rosterIds(team).map((id) => ({ id, team })));
  const ranked = [...pool].sort((a, b) => {
    const left = career.players[b.id];
    const right = career.players[a.id];
    return (
      left.seasonMvps - right.seasonMvps ||
      left.seasonWins - right.seasonWins ||
      overall(left) - overall(right)
    );
  });
  const awards: Award[] = [];
  const mvp = ranked[0];
  if (mvp && career.players[mvp.id].seasonMvps > 0) {
    const player = career.players[mvp.id];
    awards.push({
      id: 'mvp',
      title: 'Circuit MVP',
      year: career.year,
      playerId: player.id,
      playerName: player.nick,
      teamId: mvp.team.id,
      detail: `${player.seasonMvps} series MVPs, ${player.seasonWins} series wins`
    });
  }
  const breakout = pool
    .filter((entry) => career.players[entry.id].age <= 21 && career.players[entry.id].seasonGames >= 4)
    .sort(
      (a, b) =>
        career.players[b.id].seasonWins - career.players[a.id].seasonWins ||
        career.players[b.id].seasonGames - career.players[a.id].seasonGames ||
        overall(career.players[b.id]) - overall(career.players[a.id])
    )[0];
  if (breakout) {
    const player = career.players[breakout.id];
    awards.push({
      id: 'breakout',
      title: 'Breakout',
      year: career.year,
      playerId: player.id,
      playerName: player.nick,
      teamId: breakout.team.id,
      detail: `Age ${player.age}, ${overall(player)} overall, ${player.seasonGames} games`
    });
  }
  career.awards = awards;
  const headline = awards.find((award) => award.id === 'mvp');
  if (headline) pushNews(career, `${headline.playerName} is Circuit MVP. ${headline.detail}.`);
}

export { chooseStarterIds, describeWeek, findPlayerFixture, lineupProblems, playerTeam, rosterIds, teamById };
