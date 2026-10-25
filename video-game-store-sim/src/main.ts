import { apply, initialApp, isTraining } from './game/actions.ts';
import { normalizeCareer } from './game/career.ts';
import type { Action, AppState, LeagueTab, Mythology, Role, Screen, Strategy } from './game/types.ts';
import { render } from './ui/render.ts';
import './style.css';

const KEY = 'pantheon-circuit-v1';
const found = document.querySelector<HTMLElement>('#app');
if (!found) throw new Error('Missing #app');
const root: HTMLElement = found;

let state = load() ?? initialApp();

function draw(): void {
  root.innerHTML = render(state);
}

function persist(): void {
  const saved: AppState = { ...state, notice: '' };
  localStorage.setItem(KEY, JSON.stringify(saved));
}

function load(): AppState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Omit<AppState, 'version'> & { version: number };
    if (parsed.version !== 1 && parsed.version !== 2) return null;
    if (parsed.career) normalizeCareer(parsed.career);
    return { ...initialApp(), ...parsed, version: 2, notice: '' };
  } catch {
    return null;
  }
}

function dispatch(action: Action): void {
  state = apply(state, action);
  persist();
  draw();
}

root.addEventListener('click', (event) => {
  const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-act]');
  if (!target) return;
  const act = target.dataset.act;
  if (act === 'goto' && target.dataset.screen) dispatch({ type: 'goto', screen: target.dataset.screen as Screen });
  else if (act === 'begin') dispatch({ type: 'begin' });
  else if (act === 'color' && target.dataset.color) dispatch({ type: 'color', color: target.dataset.color });
  else if (act === 'ask-abandon') dispatch({ type: 'ask-abandon' });
  else if (act === 'abandon') dispatch({ type: 'abandon' });
  else if (act === 'select-player' && target.dataset.id) dispatch({ type: 'select-player', id: target.dataset.id });
  else if (act === 'select-champ' && target.dataset.id) {
    state = { ...state, selectedChampId: target.dataset.id, screen: 'champions', notice: '' };
    persist();
    draw();
  } else if (act === 'training' && target.dataset.focus && isTraining(target.dataset.focus)) {
    dispatch({ type: 'training', focus: target.dataset.focus });
  } else if (act === 'swap' && target.dataset.a && target.dataset.b) dispatch({ type: 'swap', a: target.dataset.a, b: target.dataset.b });
  else if (act === 'slot' && target.dataset.index) dispatch({ type: 'slot', index: Number(target.dataset.index) });
  else if (act === 'assign-player' && target.dataset.id) dispatch({ type: 'assign-player', id: target.dataset.id });
  else if (act === 'assign-champ' && target.dataset.id) dispatch({ type: 'assign-champ', id: target.dataset.id });
  else if (act === 'ban' && target.dataset.id) dispatch({ type: 'ban', id: target.dataset.id });
  else if (act === 'strategy' && target.dataset.strategy) dispatch({ type: 'strategy', id: target.dataset.strategy as Strategy });
  else if (act === 'autofill') dispatch({ type: 'autofill' });
  else if (act === 'play') dispatch({ type: 'play' });
  else if (act === 'dismiss-result') dispatch({ type: 'dismiss-result' });
  else if (act === 'upgrade') dispatch({ type: 'upgrade' });
  else if (act === 'dismiss-patch') dispatch({ type: 'dismiss-patch' });
  else if (act === 'league-tab' && target.dataset.tab) dispatch({ type: 'league-tab', tab: target.dataset.tab as LeagueTab });
  else if (act === 'view-team' && target.dataset.id) dispatch({ type: 'view-team', id: target.dataset.id });
  else if (act === 'myth-filter' && target.dataset.myth) dispatch({ type: 'myth-filter', myth: target.dataset.myth as 'all' | Mythology });
  else if (act === 'role-filter' && target.dataset.role) dispatch({ type: 'role-filter', role: target.dataset.role as 'all' | Role });
  else if (act === 'resign' && target.dataset.id) dispatch({ type: 'resign', id: target.dataset.id, years: Number(target.dataset.years) });
  else if (act === 'release' && target.dataset.id) dispatch({ type: 'release', id: target.dataset.id });
  else if (act === 'sign' && target.dataset.id && (target.dataset.side === 'main' || target.dataset.side === 'dev')) {
    dispatch({ type: 'sign', id: target.dataset.id, side: target.dataset.side, years: Number(target.dataset.years) });
  }   else if (act === 'next-season') dispatch({ type: 'next-season' });
  else if (act === 'scrim-house') dispatch({ type: 'scrim-house' });
  else if (act === 'scrim-circuit' && target.dataset.id) dispatch({ type: 'scrim-circuit', opponentId: target.dataset.id });
  else if (act === 'trade-accept' && target.dataset.id) dispatch({ type: 'trade-accept', id: Number(target.dataset.id) });
  else if (act === 'trade-decline' && target.dataset.id) dispatch({ type: 'trade-decline', id: Number(target.dataset.id) });
});

root.addEventListener('input', (event) => {
  const target = event.target as HTMLInputElement | null;
  if (!target?.dataset.field) return;
  const field = target.dataset.field;
  if (field !== 'name' && field !== 'tag' && field !== 'city') return;
  state = apply(state, { type: 'draft', field, value: target.value });
  persist();
});

root.addEventListener('change', (event) => {
  const target = event.target as HTMLSelectElement | null;
  if (target?.dataset.act === 'training-champ') dispatch({ type: 'training-champ', id: target.value });
});

draw();
