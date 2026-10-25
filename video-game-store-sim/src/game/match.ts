import { CHAMPION_MAP, CHAMPIONS, champName } from './champions.ts';
import { facilityAt } from './facilities.ts';
import type { Rng } from './rng.ts';
import { bestMasteryId, overall } from './roster.ts';
import type { Career, Draft, Fixture, GameReport, MatchKind, Player, Strategy, Team } from './types.ts';

const COUNTER: Record<Strategy, Strategy> = {
  snowball: 'scale',
  scale: 'protect',
  protect: 'pick',
  pick: 'snowball',
  chaos: 'chaos'
};

export function counters(strategy: Strategy, other: Strategy): boolean {
  return strategy !== 'chaos' && COUNTER[strategy] === other;
}

export function isKnockout(kind: MatchKind): boolean {
  return kind === 'cup-semi' || kind === 'cup-final' || kind === 'play-in' || kind === 'playoff-semi' || kind === 'playoff-final';
}

export function teamById(career: Career, id: string): Team {
  const team = career.orgs.find((entry) => entry.id === id);
  if (!team) throw new Error(`Missing team ${id}`);
  return team;
}

export function playerTeam(career: Career): Team {
  return teamById(career, career.playerTeamId);
}

export function rosterIds(team: Team): string[] {
  return [...team.main, ...team.dev];
}

export function opponentOf(fixture: Fixture, teamId: string): string {
  return fixture.homeId === teamId ? fixture.awayId : fixture.homeId;
}

function healthyIds(career: Career, team: Team): string[] {
  return rosterIds(team).filter((id) => career.players[id].injured <= 0);
}

export function chooseStarterIds(career: Career, team: Team): string[] {
  const score = (player: Player, main: boolean) =>
    overall(player) - Math.max(0, player.fatigue - 22) * 0.28 + player.form * 0.35 + (main ? 1.5 : 0);

  const pool = [
    ...team.main
      .map((id) => career.players[id])
      .filter((player) => player.injured <= 0)
      .map((player) => ({ player, value: score(player, true) })),
    ...team.dev
      .map((id) => career.players[id])
      .filter((player) => player.injured <= 0)
      .map((player) => ({ player, value: score(player, false) }))
  ].sort((a, b) => b.value - a.value);

  const picked: Player[] = [];
  for (const role of ['warden', 'slayer', 'weaver'] as const) {
    const found = pool.find((entry) => entry.player.role === role && !picked.includes(entry.player));
    if (found) picked.push(found.player);
  }
  for (const entry of pool) {
    if (picked.length >= 3) break;
    if (!picked.includes(entry.player)) picked.push(entry.player);
  }
  if (picked.length < 3) {
    for (const id of rosterIds(team)) {
      if (picked.length >= 3) break;
      const player = career.players[id];
      if (!picked.includes(player)) picked.push(player);
    }
  }
  return picked.slice(0, 3).map((player) => player.id);
}

export function bestChampFor(career: Career, playerId: string, blocked: Set<string>): string | null {
  const player = career.players[playerId];
  let best: string | null = null;
  let bestScore = -Infinity;
  for (const champion of CHAMPIONS) {
    if (blocked.has(champion.id)) continue;
    const mastery = player.mastery[champion.id] ?? 8;
    const meta = champion.base + (career.patch[champion.id] ?? 0);
    const score = mastery * 0.9 + meta * 0.35 + (player.role === champion.role ? 14 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = champion.id;
    }
  }
  return best;
}

export function suggestBan(career: Career, starterIds: string[]): string {
  const loved = new Set<string>();
  for (const id of starterIds) {
    const player = career.players[id];
    for (const [champId, value] of Object.entries(player.mastery)) {
      if (value >= 70) loved.add(champId);
    }
  }
  const ranked = [...CHAMPIONS].sort(
    (a, b) => b.base + (career.patch[b.id] ?? 0) - (a.base + (career.patch[a.id] ?? 0))
  );
  return (ranked.find((champion) => !loved.has(champion.id)) ?? ranked[0]).id;
}

export function aiBan(career: Career, teamId: string, playerBan: string): string {
  const team = teamById(career, teamId);
  const starters = chooseStarterIds(career, team);
  const loved = new Set<string>();
  for (const id of starters) {
    const best = bestMasteryId(career.players[id]);
    if (best) loved.add(best);
  }
  const ranked = [...CHAMPIONS].sort(
    (a, b) => b.base + (career.patch[b.id] ?? 0) - (a.base + (career.patch[a.id] ?? 0))
  );
  const choice = ranked.find((champion) => champion.id !== playerBan && !loved.has(champion.id));
  return (choice ?? ranked.find((champion) => champion.id !== playerBan) ?? ranked[0]).id;
}

export function buildDraft(career: Career, teamId: string, banned: Set<string>, rng: Rng | null): Draft {
  const team = teamById(career, teamId);
  const playerIds = chooseStarterIds(career, team);
  const champs: Record<string, string> = {};
  const taken = new Set<string>(banned);
  const ordered = [...playerIds].sort((a, b) => overall(career.players[b]) - overall(career.players[a]));
  for (const id of ordered) {
    let best: string | null = null;
    let bestScore = -Infinity;
    const player = career.players[id];
    for (const champion of CHAMPIONS) {
      if (taken.has(champion.id)) continue;
      const mastery = player.mastery[champion.id] ?? 8;
      const meta = champion.base + (career.patch[champion.id] ?? 0);
      let score = mastery * 0.9 + meta * 0.35 + (player.role === champion.role ? 14 : 0);
      if (rng) score += rng.next() * 2;
      if (score > bestScore) {
        bestScore = score;
        best = champion.id;
      }
    }
    if (best) {
      champs[id] = best;
      taken.add(best);
    }
  }
  return { playerIds, champs, strategy: team.strategy };
}

export interface PowerRead {
  total: number;
  parts: { id: string; rating: number }[];
}

export function teamPower(
  career: Career,
  teamId: string,
  draft: Draft,
  opponentStrategy: Strategy,
  kind: MatchKind,
  home: boolean
): PowerRead {
  const team = teamById(career, teamId);
  const parts = draft.playerIds.map((id) => {
    const player = career.players[id];
    const champId = draft.champs[id];
    const champion = CHAMPION_MAP[champId];
    if (!champion) return { id, rating: 20 };
    const patch = career.patch[champion.id] ?? 0;
    const mastery = player.mastery[champion.id] ?? 12;
    let rating =
      overall(player) * 0.72 +
      (champion.base + patch) * 0.22 +
      mastery * 0.16 +
      (player.morale - 62) * 0.06 +
      player.form * 0.85 -
      Math.max(0, player.fatigue - 18) * 0.16;
    if (player.role !== champion.role) rating *= 0.84;
    if (player.trait === 'onetrick') rating += champId === bestMasteryId(player) ? 5 : -4;
    if (player.trait === 'meta') {
      if (patch >= 3) rating += 4;
      if (patch <= -3) rating -= 3;
    }
    if (player.trait === 'clutch' && isKnockout(kind)) rating += 6;
    if (player.injured > 0) rating *= 0.72;
    return { id, rating: Math.max(8, rating) };
  });

  let total = parts.reduce((sum, part) => sum + part.rating, 0);
  const roles = new Set(draft.playerIds.map((id) => CHAMPION_MAP[draft.champs[id]]?.role).filter(Boolean));
  if (roles.size === 3) total += 8;
  else if (roles.size === 1) total -= 10;
  else total -= 3;

  const champIds = draft.playerIds.map((id) => draft.champs[id]).filter(Boolean);
  const linked = new Set<string>();
  for (let i = 0; i < champIds.length; i++) {
    for (let j = i + 1; j < champIds.length; j++) {
      const a = CHAMPION_MAP[champIds[i]];
      const b = CHAMPION_MAP[champIds[j]];
      if (!a || !b) continue;
      if (a.synergy.includes(b.id) || b.synergy.includes(a.id)) linked.add([a.id, b.id].sort().join(':'));
    }
  }
  total += linked.size * 4;
  total += (team.chemistry - 50) * 0.1;
  if (counters(draft.strategy, opponentStrategy)) total += 8;
  else if (counters(opponentStrategy, draft.strategy)) total -= 6;
  if (draft.strategy === 'chaos') total -= 2;
  if (home) total += 3;
  total += facilityAt(team.facility).prep;
  if (draft.playerIds.some((id) => career.players[id].trait === 'leader')) total += 3;
  const streak = career.streak ?? 0;
  if (team.player && streak >= 3) total += streak >= 5 ? 8 : 4;
  if (team.player && streak <= -3) total -= 4;
  return { total, parts };
}

export function edgeLabel(diff: number): string {
  if (diff > 18) return 'Favored';
  if (diff > 7) return 'Slight edge';
  if (diff >= -7) return 'Even';
  if (diff >= -18) return 'Underdog';
  return 'Long shot';
}

export function coachNotes(career: Career, opponentStrategy: Strategy): string[] {
  const notes: string[] = [];
  const lineup = career.lineup;
  const roles = new Set(lineup.playerIds.map((id) => CHAMPION_MAP[lineup.champs[id]]?.role).filter(Boolean));
  if (roles.size < 3) notes.push('This comp is missing a role. Spire Rift punishes that.');
  for (const id of lineup.playerIds) {
    const player = career.players[id];
    const champId = lineup.champs[id];
    if (!champId) continue;
    const champion = CHAMPION_MAP[champId];
    const mastery = player.mastery[champId] ?? 0;
    if (player.fatigue >= 75) notes.push(`${player.nick} is running on fumes.`);
    if (champion && player.role !== champion.role) notes.push(`${player.nick} is off-role on ${champion.name}.`);
    if (mastery < 40) notes.push(`${player.nick} is still learning ${champion?.name ?? 'that champion'}.`);
    if (teamById(career, career.playerTeamId).dev.includes(id)) notes.push(`${player.nick} is a development call-up.`);
  }
  const streak = career.streak ?? 0;
  if (streak >= 3) notes.push(`${streak} straight wins. Do not get cute.`);
  if (streak <= -3) notes.push(`Skid of ${-streak}. A clean win matters more than the perfect comp.`);
  if (counters(lineup.strategy, opponentStrategy)) notes.push('Your plan matches up well with how they play.');
  else if (counters(opponentStrategy, lineup.strategy)) notes.push('Their style punishes this plan.');
  if (!notes.length) notes.push('The draft is clean. Queue it.');
  return notes.slice(0, 4);
}

function clock(minute: number, rng: Rng): string {
  return `${minute}:${rng.int(0, 59).toString().padStart(2, '0')}`;
}

function earlyScore(draft: Draft, strategy: Strategy): number {
  let score = strategy === 'snowball' ? 3 : strategy === 'scale' ? -2 : 0;
  for (const id of draft.playerIds) {
    const champion = CHAMPION_MAP[draft.champs[id]];
    if (!champion) continue;
    score += champion.scaling === 'early' ? 2 : champion.scaling === 'late' ? -1 : 0;
  }
  return score;
}

export interface SeriesResult {
  winnerId: string;
  homeWins: number;
  awayWins: number;
  games: GameReport[];
  mvpId: string;
  mvpName: string;
}

export function simulateSeries(
  career: Career,
  rng: Rng,
  fixture: Fixture,
  homeDraft: Draft,
  awayDraft: Draft,
  detailed: boolean
): SeriesResult {
  const needed = Math.floor(fixture.series / 2) + 1;
  let homeWins = 0;
  let awayWins = 0;
  const games: GameReport[] = [];
  let lastMvp = homeDraft.playerIds[0];
  while (homeWins < needed && awayWins < needed) {
    const report = simulateGame(career, rng, fixture, homeDraft, awayDraft, detailed);
    games.push(report);
    if (report.winnerId === fixture.homeId) homeWins += 1;
    else awayWins += 1;
    lastMvp = report.mvpId;
    addGameFatigue(career, homeDraft, awayDraft);
  }
  const winnerId = homeWins > awayWins ? fixture.homeId : fixture.awayId;
  const mvp = career.players[lastMvp];
  return {
    winnerId,
    homeWins,
    awayWins,
    games,
    mvpId: lastMvp,
    mvpName: mvp?.nick ?? 'MVP'
  };
}

function addGameFatigue(career: Career, homeDraft: Draft, awayDraft: Draft): void {
  for (const id of [...homeDraft.playerIds, ...awayDraft.playerIds]) {
    const player = career.players[id];
    if (!player) continue;
    let amount = 9;
    if (player.trait === 'grinder') amount *= 0.75;
    if (player.fatigue > 72) amount *= 0.45;
    player.fatigue = Math.max(0, Math.min(100, player.fatigue + amount));
  }
}

function simulateGame(
  career: Career,
  rng: Rng,
  fixture: Fixture,
  homeDraft: Draft,
  awayDraft: Draft,
  detailed: boolean
): GameReport {
  const homePower = teamPower(career, fixture.homeId, homeDraft, awayDraft.strategy, fixture.kind, true);
  const awayPower = teamPower(career, fixture.awayId, awayDraft, homeDraft.strategy, fixture.kind, false);
  let edge = homePower.total - awayPower.total;
  const variance = homeDraft.strategy === 'chaos' || awayDraft.strategy === 'chaos' ? 18 : 11;
  edge += rng.gaussian() * variance;
  const winnerId = edge >= 0 ? fixture.homeId : fixture.awayId;
  const homeWins = winnerId === fixture.homeId;
  const margin = Math.abs(homePower.total - awayPower.total);
  const blowout = margin > 22;
  const winnerKills = rng.int(14, 22);
  const loserKills = blowout ? rng.int(4, 9) : rng.int(9, 16);
  const homeKills = homeWins ? winnerKills : loserKills;
  const awayKills = homeWins ? loserKills : winnerKills;
  const winnerGold = rng.int(54000, 69000);
  const loserGold = winnerGold - rng.int(4000, 12000);
  const homeGold = homeWins ? winnerGold : loserGold;
  const awayGold = homeWins ? loserGold : winnerGold;
  const close = Math.abs(homeKills - awayKills) < 6;
  const homeHeart = homeWins ? rng.int(1, 2) : close && rng.chance(0.45) ? 1 : 0;
  const awayHeart = homeWins ? (close && rng.chance(0.45) ? 1 : 0) : rng.int(1, 2);
  const mins = homeDraft.strategy === 'scale' || awayDraft.strategy === 'scale' ? rng.int(18, 26) : rng.int(14, 22);
  const winningParts = winnerId === fixture.homeId ? homePower.parts : awayPower.parts;
  const mvp = [...winningParts].sort((a, b) => b.rating - a.rating)[0];
  const earlyHome = earlyScore(homeDraft, homeDraft.strategy) + rng.gaussian();
  const earlyAway = earlyScore(awayDraft, awayDraft.strategy);
  const earlyId = earlyHome >= earlyAway ? fixture.homeId : fixture.awayId;
  return {
    winnerId,
    homeId: fixture.homeId,
    awayId: fixture.awayId,
    homeKills,
    awayKills,
    homeGold,
    awayGold,
    homeHeart,
    awayHeart,
    time: `${mins}:${rng.int(0, 59).toString().padStart(2, '0')}`,
    timeline: detailed
      ? narrate(career, rng, fixture, homeDraft, awayDraft, winnerId, earlyId, mvp?.id ?? homeDraft.playerIds[0])
      : [],
    mvpId: mvp?.id ?? homeDraft.playerIds[0],
    mvpName: career.players[mvp?.id ?? '']?.nick ?? 'MVP'
  };
}

function narrate(
  career: Career,
  rng: Rng,
  fixture: Fixture,
  homeDraft: Draft,
  awayDraft: Draft,
  winnerId: string,
  earlyId: string,
  mvpId: string
): { t: string; text: string }[] {
  const home = teamById(career, fixture.homeId);
  const away = teamById(career, fixture.awayId);
  const comp = (draft: Draft) =>
    draft.playerIds.map((id) => champName(draft.champs[id])).filter(Boolean).join(', ');
  const mvp = career.players[mvpId];
  const mvpChamp = champName(homeDraft.champs[mvpId] ?? awayDraft.champs[mvpId] ?? '');
  const ultimate =
    CHAMPION_MAP[homeDraft.champs[mvpId] ?? awayDraft.champs[mvpId] ?? '']?.abilities.at(-1)?.name ?? 'the ultimate';
  const path = rng.pick(['Ash Path', 'Mirror Path']);
  const winner = teamById(career, winnerId);
  const early = teamById(career, earlyId);
  const comeback = earlyId !== winnerId;
  const marks = [1, rng.int(4, 6), rng.int(8, 10), rng.int(12, 14), rng.int(16, 19)].sort((a, b) => a - b);
  return [
    {
      t: clock(marks[0], rng),
      text: `${home.tag} locks ${comp(homeDraft)}. ${away.tag} answers with ${comp(awayDraft)}.`
    },
    {
      t: clock(marks[1], rng),
      text: comeback
        ? `${early.tag} draws first blood on the ${path}, but the lead looks rented.`
        : `${early.tag} spills first blood on the ${path} and keeps the river.`
    },
    {
      t: clock(marks[2], rng),
      text: `${mvp?.nick ?? 'The ace'} finds a pick with ${mvpChamp} before the Worldheart pit unlocks.`
    },
    {
      t: clock(marks[3], rng),
      text: comeback
        ? `${winner.tag} flips the Worldheart fight. ${early.tag}'s lead is gone.`
        : `${winner.tag} takes the Worldheart and resets the map with the buff still ticking.`
    },
    {
      t: clock(marks[4], rng),
      text: `${mvp?.nick ?? winner.tag} spends ${ultimate}. The ancient core shatters. ${winner.name} take the game.`
    }
  ];
}

export function autofillLineup(career: Career): Career {
  const next = structuredClone(career);
  const fixture = findPlayerFixture(next);
  const starters = chooseStarterIds(next, playerTeam(next));
  const ban = suggestBan(next, starters);
  const banned = new Set<string>([ban]);
  if (fixture) banned.add(aiBan(next, opponentOf(fixture, next.playerTeamId), ban));
  const champs: Record<string, string> = {};
  const taken = new Set<string>(banned);
  for (const id of [...starters].sort((a, b) => overall(next.players[b]) - overall(next.players[a]))) {
    const pick = bestChampFor(next, id, taken);
    if (pick) {
      champs[id] = pick;
      taken.add(pick);
    }
  }
  let strategy = next.lineup?.strategy ?? playerTeam(next).strategy;
  if (fixture) strategy = counterStrategy(teamById(next, opponentOf(fixture, next.playerTeamId)).strategy);
  next.lineup = {
    playerIds: starters,
    champs,
    ban,
    strategy
  };
  const you = playerTeam(next);
  you.strategy = strategy;
  return next;
}

export function counterStrategy(opponent: Strategy): Strategy {
  if (opponent === 'snowball') return 'pick';
  if (opponent === 'scale') return 'snowball';
  if (opponent === 'protect') return 'scale';
  if (opponent === 'pick') return 'protect';
  return 'pick';
}

export function findPlayerFixture(career: Career): Fixture | null {
  const week = describeWeek(career);
  if (!week) return null;
  return week.fixtures.find((fixture) => fixture.homeId === career.playerTeamId || fixture.awayId === career.playerTeamId) ?? null;
}

export interface WeekView {
  label: string;
  fixtures: Fixture[];
}

export function describeWeek(career: Career): WeekView | null {
  const stage = career.stage;
  if (stage.kind === 'offseason') return null;
  if (stage.kind === 'preseason') {
    return {
      label: `Preseason · Week ${stage.round + 1}`,
      fixtures: toFixtures(career.preseasonRounds[stage.round] ?? [], 'preseason', 1, `pre-${stage.round}`)
    };
  }
  if (stage.kind === 'regular') {
    return {
      label: `Regular Season · Week ${stage.round + 1}`,
      fixtures: toFixtures(career.regularRounds[stage.round] ?? [], 'regular', 1, `reg-${stage.round}`)
    };
  }
  if (stage.kind === 'cup' && career.cup) {
    const { groupRound } = groupRoundSafe();
    return {
      label: `Spire Cup · Group Week ${stage.round + 1}`,
      fixtures: toFixtures(
        [...groupRound(career.cup.groups.a, stage.round), ...groupRound(career.cup.groups.b, stage.round)],
        'cup',
        1,
        `cup-${stage.round}`
      )
    };
  }
  if (stage.kind === 'cup-semi' && career.cup) {
    return { label: 'Spire Cup · Semifinal', fixtures: seriesFixtures(career.cup.semis, 'cup-semi', 3, 'cup-semi') };
  }
  if (stage.kind === 'cup-final' && career.cup?.final) {
    return { label: 'Spire Cup · Final', fixtures: seriesFixtures([career.cup.final], 'cup-final', 3, 'cup-final') };
  }
  if (stage.kind === 'play-in' && career.playoffs) {
    return {
      label: 'Playoffs · Play-in',
      fixtures: seriesFixtures(career.playoffs.playIn, 'play-in', 3, 'play-in')
    };
  }
  if (stage.kind === 'playoff-semi' && career.playoffs) {
    return {
      label: 'Playoffs · Semifinal',
      fixtures: seriesFixtures(career.playoffs.semis, 'playoff-semi', 3, 'po-semi')
    };
  }
  if (stage.kind === 'playoff-final' && career.playoffs?.final) {
    return {
      label: 'Playoffs · Final',
      fixtures: seriesFixtures([career.playoffs.final], 'playoff-final', 5, 'po-final')
    };
  }
  return null;
}

function groupRoundSafe(): { groupRound: (ids: string[], round: number) => [string, string][] } {
  return {
    groupRound: (ids, round) => {
      const [a, b, c, d] = ids;
      const rounds: [string, string][][] = [
        [
          [a, b],
          [c, d]
        ],
        [
          [a, c],
          [b, d]
        ],
        [
          [a, d],
          [b, c]
        ]
      ];
      return rounds[round] ?? [];
    }
  };
}

function toFixtures(pairs: [string, string][], kind: MatchKind, series: 1 | 3 | 5, prefix: string): Fixture[] {
  return pairs.map(([homeId, awayId], index) => ({
    id: `${prefix}-${index}`,
    kind,
    series,
    homeId,
    awayId
  }));
}

function seriesFixtures(seriesList: { homeId: string; awayId: string }[], kind: MatchKind, series: 1 | 3 | 5, prefix: string): Fixture[] {
  return seriesList.map((slot, index) => ({
    id: `${prefix}-${index}`,
    kind,
    series,
    homeId: slot.homeId,
    awayId: slot.awayId
  }));
}

export function lineupProblems(career: Career): string[] {
  const fixture = findPlayerFixture(career);
  if (career.stage.kind === 'offseason') return ['The season is over.'];
  if (!fixture) return ['There is no match on the schedule.'];
  const ids = career.lineup.playerIds;
  const problems: string[] = [];
  if (ids.length !== 3 || new Set(ids).size !== 3) problems.push('Queue exactly three different players.');
  const roster = new Set(rosterIds(playerTeam(career)));
  for (const id of ids) {
    const player = career.players[id];
    if (!player || !roster.has(id)) problems.push('The lineup has a player who is not on the roster.');
    else if (player.injured > 0) problems.push(`${player.nick} is injured.`);
  }
  if (!career.lineup.ban) problems.push('Ban a champion.');
  const ai = aiBan(career, opponentOf(fixture, career.playerTeamId), career.lineup.ban);
  const banned = new Set([career.lineup.ban, ai]);
  const champs = ids.map((id) => career.lineup.champs[id]);
  if (champs.some((id) => !id)) problems.push('Every queued player needs a champion.');
  if (new Set(champs.filter(Boolean)).size !== champs.filter(Boolean).length) problems.push('Two players cannot lock the same champion.');
  for (const champId of champs) {
    if (champId && banned.has(champId)) problems.push(`${champName(champId)} is banned.`);
  }
  if (!career.lineup.strategy) problems.push('Pick a strategy.');
  return [...new Set(problems)];
}

export function healthyCount(career: Career): number {
  return healthyIds(career, playerTeam(career)).length;
}
