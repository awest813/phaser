import {
  acceptTrade,
  chooseRoom,
  forceTradeOffer,
  freshGoals,
  normalizeCareer,
  playCurrentWeek,
  playerPlace,
  playerStanding,
  playerTeam,
  raceLine,
  rankTeams,
  rosterIds,
  rosterReady,
  runCircuitScrim,
  runHouseScrim,
  setPromise,
  setStudy
} from './game/career.ts';
import { apply, initialApp } from './game/actions.ts';
import { FACILITIES } from './game/facilities.ts';
import { bestChampFor, describeWeek, lineupProblems, suggestBan } from './game/match.ts';
import { CHAMPIONS } from './game/champions.ts';
import { overall } from './game/roster.ts';
import { doubleRoundRobin } from './game/schedule.ts';
import type { Career } from './game/types.ts';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function checkSchedule(): void {
  const ids = ['you', 'northhowl', 'khemri', 'aegean', 'sakura', 'iron', 'oracle', 'solstice'];
  const rounds = doubleRoundRobin(ids);
  assert(rounds.length === 14, `expected 14 rounds, got ${rounds.length}`);
  const pairCount = new Map<string, number>();
  for (const round of rounds) {
    assert(round.length === 4, 'round should have 4 games');
    const seen = new Set<string>();
    for (const [home, away] of round) {
      assert(!seen.has(home) && !seen.has(away), 'team played twice in a round');
      seen.add(home);
      seen.add(away);
      const key = [home, away].sort().join(':');
      pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
    }
    assert(seen.size === 8, 'a team missed a round');
  }
  for (const count of pairCount.values()) assert(count === 2, 'pair was not a home-and-home');
}

function assertCareer(career: Career): void {
  const you = career.orgs.find((team) => team.player);
  assert(you, 'missing player team');
  if (!you) return;
  assert(you.main.length + you.dev.length === 6, 'roster is not 4+2');
  assert(new Set([...you.main, ...you.dev]).size === you.main.length + you.dev.length, 'duplicate roster id');
  assert(Number.isFinite(you.cash), 'cash is not finite');
  for (const id of [...you.main, ...you.dev]) {
    const player = career.players[id];
    assert(player, `missing player ${id}`);
    assert(Number.isFinite(overall(player)), 'ovr nan');
    assert(player.fatigue >= 0 && player.fatigue <= 100, 'fatigue out of range');
  }
  if (career.stage.kind === 'regular' || career.stage.kind === 'preseason' || career.stage.kind === 'cup') {
    const week = describeWeek(career);
    assert(week, 'missing week');
    const appearances = new Map<string, number>();
    for (const fixture of week?.fixtures ?? []) {
      appearances.set(fixture.homeId, (appearances.get(fixture.homeId) ?? 0) + 1);
      appearances.set(fixture.awayId, (appearances.get(fixture.awayId) ?? 0) + 1);
    }
    for (const count of appearances.values()) assert(count === 1, 'team doubled in a week');
  }
}

function finishOffseason(appCareer: Career): Career {
  let career = appCareer;
  const you = career.orgs.find((team) => team.player);
  if (!you) throw new Error('no team');
  for (const id of [...you.main, ...you.dev]) {
    if (career.players[id].contractStatus === 'expiring') {
      career.players[id].contractStatus = 'signed';
      career.players[id].contractYears = 1;
      career.players[id].salary = 900;
    }
  }
  assert(rosterReady(career) === null, rosterReady(career) ?? 'roster');
  return career;
}

function run(): void {
  checkSchedule();
  assert(CHAMPIONS.length === 12, 'champ count');
  for (const myth of ['norse', 'egyptian', 'greek', 'japanese'] as const) {
    assert(CHAMPIONS.filter((champion) => champion.mythology === myth).length === 3, myth);
  }
  assert(FACILITIES.length === 8, 'facilities');
  assert(FACILITIES[0].name === 'The Garage', 'garage first');
  assert(FACILITIES[7].name === 'Mythic Arena HQ', 'hq last');
  assert(freshGoals(0).some((goal) => goal.id === 'hq'), 'goals');

  let app = apply(initialApp(), { type: 'begin' });
  if (!app.career) throw new Error('career missing');
  assert(app.career.offers.length === 1, 'opening trade call');
  assert(app.career.bounty && app.career.bounty.reward > 0, 'opening bounty');
  assert(app.career.rivalId === 'iron', 'rival');
  assert(app.career.rivalHeat >= 12, 'rival heat');
  assert(raceLine(app.career).length > 8, 'race line');
  assert(app.career.room && app.career.room.a.label.length > 2, 'opening room');
  assert(app.career.players.kite.study === 'skadi', 'kite studies skadi');
  assert(app.career.ties['boom|kite'] === -2, 'slayer friction');
  const promised = setPromise(structuredClone(app.career), 'wolf');
  assert(!promised.error && promised.career.promiseId === 'wolf', promised.error ?? 'promise');
  const broke = playCurrentWeek(autofill(promised.career));
  assert(broke.promiseId === null, 'promise spent');
  assert(broke.players.wolf.morale < 74, `broken promise morale ${broke.players.wolf.morale}`);
  assert(broke.lastReport?.notes.some((line) => line.includes('sat')), 'promise note');
  const studied = setStudy(app.career, 'kite', 'artemis');
  assert(studied.career.players.kite.study === 'artemis', 'study');
  assert(bestChampFor(studied.career, 'kite', new Set()) === 'artemis', 'study changes the auto draft');
  assert(suggestBan(studied.career, ['mina', 'kite', 'veil']) !== 'artemis', 'study is not banned by us');
  const offRole = setStudy(app.career, 'kite', 'athena');
  assert(offRole.error, 'study role');
  const answered = chooseRoom(app.career, 'a');
  assert(!answered.error && answered.career.roomSpent, answered.error ?? 'room choice');
  assert(answered.career.roomEcho.length > 8, 'room echo');
  assert(chooseRoom(answered.career, 'b').error, 'room once');
  app.career = answered.career;
  const bare = structuredClone(app.career);
  delete (bare as { offers?: unknown }).offers;
  delete (bare as { intel?: unknown }).intel;
  delete (bare as { awards?: unknown }).awards;
  delete (bare as { streak?: unknown }).streak;
  delete (bare as { bounty?: unknown }).bounty;
  delete (bare as { rivalId?: unknown }).rivalId;
  delete (bare as { ties?: unknown }).ties;
  bare.players.kite.study = '';
  normalizeCareer(bare);
  assert(Array.isArray(bare.offers) && bare.intel && Array.isArray(bare.awards), 'normalize');
  assert(bare.streak === 0 && bare.bounty === null && bare.rivalId === 'iron', 'loop defaults');
  assert(bare.ties && bare.players.kite.study === 'skadi', 'depth defaults');
  const house = runHouseScrim(app.career);
  assert(!house.error, house.error ?? 'house');
  assert(house.career.scrimDone, 'house scrim not marked');
  assert(house.career.lastScrim?.kind === 'house', 'house report');
  const blocked = runCircuitScrim(house.career, 'iron');
  assert(blocked.error, 'second scrim should be blocked');
  app.career = house.career;
  app.career = autofill(app.career);
  app.career = playCurrentWeek(app.career);
  assert(!app.career.scrimDone, 'scrim should reset after the match');
  assert(Array.isArray(app.career.lastReport?.growth), 'growth');
  assert((app.career.lastReport?.nextHook ?? '').startsWith('Next:'), 'next hook');
  assert((app.career.lastReport?.raceLine ?? '').length > 8, 'result race line');
  assert(app.career.streak === 1 || app.career.streak === -1, 'streak moved');
  assert(app.career.bounty !== null, 'bounty rerolled');
  assert((app.career.lastReport?.bountyNote ?? '').startsWith('Bounty'), 'bounty result');
  assert((app.career.lastReport?.roomNote ?? '').length > 8, 'room carried into the result');
  assert(app.career.room && !app.career.roomSpent, 'next room');
  const circuit = runCircuitScrim(app.career, 'iron');
  assert(!circuit.error, circuit.error ?? 'circuit');
  assert(circuit.career.intel.iron, 'scrim intel');
  assert(circuit.career.lastScrim?.opponentId === 'iron', 'scrim opponent');
  const offered = forceTradeOffer(circuit.career);
  assert(offered.offers.length === 1, 'forced trade');
  const wanted = offered.offers[0].theyWant;
  const incoming = offered.offers[0].theyGive;
  const traded = acceptTrade(offered, offered.offers[0].id);
  assert(!traded.error, traded.error ?? 'trade');
  const you = playerTeam(traded.career);
  assert(you.main.length === 4 && you.dev.length === 2, 'trade roster shape');
  assert(!rosterIds(you).includes(wanted), 'traded player still on the roster');
  assert(rosterIds(you).includes(incoming), 'incoming player missing');
  assert(new Set(rosterIds(you)).size === 6, 'trade duplicated a player');
  assert(Object.keys(traded.career.ties).some((key) => key.includes(incoming)), 'newcomer ties');
  app.career = traded.career;
  let guard = 0;
  let seasons = 0;
  while (app.career && seasons < 2 && guard < 90) {
    if (app.career.stage.kind === 'offseason') {
      app.career = finishOffseason(app.career);
      app = apply(app, { type: 'next-season' });
      assert(app.career, 'career lost in the offseason');
      assert(!app.notice || !app.notice.toLowerCase().includes('need'), app.notice);
      assert(app.career?.stage.kind === 'preseason', 'did not start next season');
      seasons += 1;
      continue;
    }
    app.career = autofill(app.career);
    const problems = lineupProblems(app.career);
    assert(problems.length === 0, `${app.career.stage.kind} lineup: ${problems.join('; ')}`);
    const before = app.career.stage.kind;
    app.career = playCurrentWeek(app.career);
    assertCareer(app.career);
    assert(app.career.lastReport, 'missing report');
    guard += 1;
    if (before === app.career.stage.kind && app.career.stage.kind !== 'offseason') {
      const stage = app.career.stage;
      if ('round' in stage) {
        // round should have moved, or we are stuck
      }
    }
  }
  assert(seasons === 2, `finished ${seasons} seasons in ${guard} weeks`);
  const career = app.career;
  if (!career) throw new Error('career lost');
  assert(career.history.length === 2, 'history');
  assert(career.history.every((season) => season.mvp.length > 3), 'season mvp missing');
  assert(career.awards.some((award) => award.id === 'mvp'), 'awards');
  const standing = playerStanding(career);
  console.log(
    JSON.stringify(
      {
        seasons,
        weeks: guard,
        year: career.year,
        cash: career.orgs.find((team) => team.player)?.cash,
        facility: career.orgs.find((team) => team.player)?.facility,
        place: playerPlace(career),
        record: `${standing.wins}-${standing.losses}`,
        history: career.history,
        awards: career.awards,
        ovr: ['kite', 'nyx', 'mina'].map((id) => ({ id, ovr: overall(career.players[id]), age: career.players[id].age }))
      },
      null,
      2
    )
  );
  const regularGames = career.results.filter((result) => result.kind === 'regular').length;
  assert(regularGames === 0, 'new season should have cleared results');
  const ranked = rankTeams(career);
  assert(ranked.length === 8, 'rank size');
  console.log('selftest ok');
}

function autofill(career: Career): Career {
  const { autofillLineup } = requireLineup();
  return autofillLineup(career);
}

function requireLineup(): { autofillLineup: (career: Career) => Career } {
  return { autofillLineup: (career) => apply({ ...initialApp(), career, screen: 'office' }, { type: 'autofill' }).career ?? career };
}

run();
