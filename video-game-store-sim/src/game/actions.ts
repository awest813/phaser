import {
  beginNextSeason,
  createCareer,
  lineupProblems,
  playCurrentWeek,
  releasePlayer,
  resignPlayer,
  setTraining,
  setTrainingChamp,
  signFreeAgent,
  swapRoster,
  upgradeFacility
} from './career.ts';
import { autofillLineup } from './match.ts';
import type { Action, AppState, Screen, Training } from './types.ts';

const CAREER_SCREENS: Screen[] = [
  'office',
  'roster',
  'player',
  'champions',
  'match',
  'result',
  'league',
  'facility',
  'finances',
  'offseason'
];

export const ORG_COLORS = [
  { name: 'Signal Teal', hex: '#2ec4b6' },
  { name: 'Leaf Gold', hex: '#e4c27a' },
  { name: 'Core Crimson', hex: '#e23d4a' },
  { name: 'Night Violet', hex: '#8b6cff' },
  { name: 'Rime Blue', hex: '#7ec8ff' },
  { name: 'Sakura', hex: '#f2a3c0' },
  { name: 'Acid Lime', hex: '#b6e36a' },
  { name: 'Ember', hex: '#e07a45' }
];

const RESERVED_TAGS = new Set(['NHL', 'KHE', 'AEG', 'SKV', 'IRN', 'MOR', 'SOL']);

export function initialApp(): AppState {
  return {
    version: 1,
    screen: 'title',
    returnScreen: 'office',
    career: null,
    draft: { name: 'Garage Myths', tag: 'GMY', city: 'Cleveland', color: '#2ec4b6' },
    notice: '',
    selectedPlayerId: null,
    selectedSlot: 0,
    selectedChampId: 'skadi',
    leagueTab: 'standings',
    viewedTeamId: null,
    champMyth: 'all',
    champRole: 'all',
    confirmAbandon: false
  };
}

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function apply(app: AppState, action: Action): AppState {
  const next: AppState = { ...app, notice: '', confirmAbandon: action.type === 'ask-abandon' ? true : false };
  const career = next.career;
  if (action.type === 'draft') {
    next.draft = { ...next.draft, [action.field]: action.value };
    return next;
  }
  if (action.type === 'color') {
    next.draft = { ...next.draft, color: action.color };
    return next;
  }
  if (action.type === 'goto') {
    if (action.screen === 'title') {
      if (career && CAREER_SCREENS.includes(next.screen)) next.returnScreen = next.screen;
      next.screen = 'title';
      return next;
    }
    if (!career && action.screen !== 'create') return app;
    if (action.screen === 'match' && career) next.career = autofillIfEmpty(career);
    if (action.screen === 'offseason' && career?.stage.kind !== 'offseason') {
      next.notice = 'The offseason opens when the season ends.';
      return next;
    }
    next.screen = action.screen;
    return next;
  }
  if (action.type === 'begin') {
    const name = clean(next.draft.name);
    const city = clean(next.draft.city);
    const tag = clean(next.draft.tag).toUpperCase();
    if (!/^[\p{L}\p{N} .'-]{2,24}$/u.test(name)) {
      next.notice = 'Org name needs 2–24 letters.';
      next.screen = 'create';
      return next;
    }
    if (!/^[A-Z]{3}$/.test(tag) || RESERVED_TAGS.has(tag)) {
      next.notice = 'Tag must be three letters and not already taken in the league.';
      next.screen = 'create';
      return next;
    }
    if (!/^[\p{L}\p{N} .'-]{2,20}$/u.test(city)) {
      next.notice = 'City needs 2–20 letters.';
      next.screen = 'create';
      return next;
    }
    next.career = createCareer({ name, tag, city, color: next.draft.color }, (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
    next.screen = 'office';
    next.returnScreen = 'office';
    next.selectedPlayerId = 'kite';
    next.notice = 'The garage door is up. Season 1 starts with preseason.';
    return next;
  }
  if (action.type === 'ask-abandon') return next;
  if (action.type === 'abandon') {
    const fresh = initialApp();
    fresh.notice = 'Career abandoned.';
    return fresh;
  }
  if (!career) return next;

  if (action.type === 'select-player') {
    next.selectedPlayerId = action.id;
    next.screen = 'player';
    return next;
  }
  if (action.type === 'training') {
    next.career = setTraining(career, action.focus);
    return next;
  }
  if (action.type === 'training-champ') {
    next.career = setTrainingChamp(career, action.id);
    return next;
  }
  if (action.type === 'swap') {
    next.career = swapRoster(career, action.a, action.b);
    return next;
  }
  if (action.type === 'slot') {
    next.selectedSlot = action.index;
    next.screen = 'match';
    return next;
  }
  if (action.type === 'assign-player') {
    const lineup = { ...career.lineup, playerIds: [...career.lineup.playerIds], champs: { ...career.lineup.champs } };
    while (lineup.playerIds.length < 3) lineup.playerIds.push('');
    const existing = lineup.playerIds.indexOf(action.id);
    if (existing >= 0 && existing !== next.selectedSlot) {
      const displaced = lineup.playerIds[next.selectedSlot];
      lineup.playerIds[existing] = displaced;
    }
    lineup.playerIds[next.selectedSlot] = action.id;
    lineup.playerIds = lineup.playerIds.filter(Boolean).slice(0, 3);
    next.career = { ...career, lineup };
    return next;
  }
  if (action.type === 'assign-champ') {
    const playerId = career.lineup.playerIds[next.selectedSlot];
    if (!playerId) {
      next.notice = 'Choose a player slot first.';
      return next;
    }
    const champs = { ...career.lineup.champs };
    for (const [id, champ] of Object.entries(champs)) {
      if (champ === action.id && id !== playerId) delete champs[id];
    }
    champs[playerId] = action.id;
    next.career = { ...career, lineup: { ...career.lineup, champs } };
    return next;
  }
  if (action.type === 'ban') {
    const champs = { ...career.lineup.champs };
    for (const [id, champ] of Object.entries(champs)) if (champ === action.id) delete champs[id];
    next.career = { ...career, lineup: { ...career.lineup, ban: action.id, champs } };
    return next;
  }
  if (action.type === 'strategy') {
    const teamIndex = career.orgs.findIndex((team) => team.id === career.playerTeamId);
    const orgs = career.orgs.map((team, index) => (index === teamIndex ? { ...team, strategy: action.id } : team));
    next.career = { ...career, orgs, lineup: { ...career.lineup, strategy: action.id } };
    return next;
  }
  if (action.type === 'autofill') {
    next.career = autofillLineup(career);
    next.notice = 'Draft filled from fatigue, roles, and the current patch.';
    next.screen = 'match';
    return next;
  }
  if (action.type === 'play') {
    const problems = lineupProblems(career);
    if (problems.length) {
      next.notice = problems[0];
      next.screen = 'match';
      return next;
    }
    next.career = playCurrentWeek(career);
    next.screen = 'result';
    return next;
  }
  if (action.type === 'dismiss-result') {
    next.screen = career.stage.kind === 'offseason' ? 'offseason' : 'office';
    return next;
  }
  if (action.type === 'upgrade') {
    const result = upgradeFacility(career);
    next.career = result.career;
    next.notice = result.error ?? `${result.career.orgs.find((team) => team.player)?.name} upgraded.`;
    next.screen = 'facility';
    return next;
  }
  if (action.type === 'dismiss-patch') {
    next.career = { ...career, patchUnread: false };
    return next;
  }
  if (action.type === 'league-tab') {
    next.leagueTab = action.tab;
    next.screen = 'league';
    return next;
  }
  if (action.type === 'view-team') {
    next.viewedTeamId = action.id;
    next.leagueTab = 'teams';
    next.screen = 'league';
    return next;
  }
  if (action.type === 'myth-filter') {
    next.champMyth = action.myth;
    next.screen = 'champions';
    return next;
  }
  if (action.type === 'role-filter') {
    next.champRole = action.role;
    next.screen = 'champions';
    return next;
  }
  if (action.type === 'resign') {
    const result = resignPlayer(career, action.id, action.years);
    next.career = result.career;
    next.notice = result.error ?? 'Contract signed.';
    next.screen = 'offseason';
    return next;
  }
  if (action.type === 'release') {
    const result = releasePlayer(career, action.id);
    next.career = result.career;
    next.notice = result.error ?? 'Player released.';
    next.screen = 'offseason';
    return next;
  }
  if (action.type === 'sign') {
    const result = signFreeAgent(career, action.id, action.side, action.years);
    next.career = result.career;
    next.notice = result.error ?? 'Player signed.';
    next.screen = 'offseason';
    return next;
  }
  if (action.type === 'next-season') {
    const result = beginNextSeason(career);
    next.career = result.career;
    next.notice = result.error ?? `Season ${result.career.year} begins in the building you have.`;
    next.screen = result.error ? 'offseason' : 'office';
    return next;
  }
  return next;
}

function autofillIfEmpty(career: AppState['career']): AppState['career'] {
  if (!career) return career;
  if (career.lineup.playerIds.filter(Boolean).length === 3 && career.lineup.ban) return career;
  return autofillLineup(career);
}

export function isTraining(value: string): value is Training {
  return ['mechanics', 'macro', 'synergy', 'champion', 'rest', 'academy'].includes(value);
}
