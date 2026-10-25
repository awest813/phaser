import { CHAMPIONS } from './champions.ts';
import type { Player, Role, Trait } from './types.ts';

const WEIGHTS: Record<Role, { mechanics: number; macro: number; teamwork: number; clutch: number }> = {
  slayer: { mechanics: 0.46, macro: 0.2, teamwork: 0.14, clutch: 0.2 },
  warden: { mechanics: 0.24, macro: 0.34, teamwork: 0.28, clutch: 0.14 },
  weaver: { mechanics: 0.18, macro: 0.4, teamwork: 0.3, clutch: 0.12 }
};

export function overall(player: Player): number {
  const weights = WEIGHTS[player.role];
  return Math.round(
    player.mechanics * weights.mechanics +
      player.macro * weights.macro +
      player.teamwork * weights.teamwork +
      player.clutch * weights.clutch
  );
}

export function demand(player: Player): number {
  let pay = overall(player) * 22 + player.potential * 3;
  if (player.age <= 20) pay *= 0.72;
  if (player.morale >= 75) pay *= 0.92;
  if (player.morale < 35) pay *= 1.35;
  return Math.max(450, Math.round(pay / 10) * 10);
}

export function bestMasteryId(player: Player): string {
  let best = '';
  let score = -1;
  for (const [id, value] of Object.entries(player.mastery)) {
    if (value > score) {
      best = id;
      score = value;
    }
  }
  return best;
}

export const TRAIT_COPY: Record<Trait, { name: string; text: string }> = {
  clutch: {
    name: 'Clutch',
    text: 'Plays up in the Spire Cup knockout and the playoffs.'
  },
  grinder: {
    name: 'Grinder',
    text: 'Tires slower and shrugs off injury risk.'
  },
  volatile: {
    name: 'Volatile',
    text: 'Form swings harder. Hot weeks are brilliant. Cold weeks are ugly.'
  },
  leader: {
    name: 'Leader',
    text: 'The squad plays a little taller when this player is on the rift.'
  },
  prodigy: {
    name: 'Prodigy',
    text: 'Gains more from training through age 21.'
  },
  meta: {
    name: 'Patch Reader',
    text: 'Stronger on buffed champions and lost on heavy nerfs.'
  },
  onetrick: {
    name: 'Signature',
    text: 'A real edge on their best champion, and a dip on everything else.'
  }
};

export function masteryLabel(value: number): string {
  if (value >= 90) return 'Signature';
  if (value >= 75) return 'Sharp';
  if (value >= 55) return 'Comfortable';
  if (value >= 30) return 'Learning';
  return 'Unplayed';
}

export function blankSeasonStats(): Pick<
  Player,
  'seasonGames' | 'seasonWins' | 'seasonMvps' | 'careerGames' | 'careerMvps'
> {
  return { seasonGames: 0, seasonWins: 0, seasonMvps: 0, careerGames: 0, careerMvps: 0 };
}

export function clampStat(value: number): number {
  return Math.max(1, Math.min(99, Math.round(value)));
}

export function roleChamps(role: Role): string[] {
  return CHAMPIONS.filter((champion) => champion.role === role).map((champion) => champion.id);
}
