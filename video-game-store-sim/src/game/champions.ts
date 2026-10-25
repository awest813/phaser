import type { Champion } from './types.ts';

export const CHAMPIONS: Champion[] = [
  {
    id: 'brynhild',
    name: 'Brynhild',
    title: 'Oathwing',
    mythology: 'norse',
    role: 'warden',
    scaling: 'mid',
    difficulty: 2,
    base: 81,
    tags: ['engage', 'peel'],
    fantasy: 'A valkyrie who pins a duel in place and refuses to let her slayer fall.',
    abilities: [
      { name: 'Spearwall', text: 'Plants a line of spears that stops dashes.' },
      { name: 'Oathbind', text: 'Tethers an ally and takes part of the damage meant for them.' },
      { name: 'Chooser', text: 'Leaps into the pit and shields the next ally who takes a fight.' }
    ],
    synergy: ['skadi', 'athena'],
    art: '/champions/champ-brynhild.jpg'
  },
  {
    id: 'skadi',
    name: 'Skadi',
    title: 'Winter Hunt',
    mythology: 'norse',
    role: 'slayer',
    scaling: 'late',
    difficulty: 2,
    base: 84,
    tags: ['marksman', 'poke'],
    fantasy: 'A frost archer who turns the jungle paths into a killing field after twenty minutes.',
    abilities: [
      { name: 'Hoarfrost', text: 'A long arrow that slows whatever it touches.' },
      { name: 'Snareline', text: 'A hidden trap in the brush.' },
      { name: 'Fimbulwinter', text: 'A cone of killing ice that finishes wounded targets.' }
    ],
    synergy: ['brynhild', 'loki'],
    art: '/champions/champ-skadi.jpg'
  },
  {
    id: 'loki',
    name: 'Loki',
    title: 'The Unbound',
    mythology: 'norse',
    role: 'weaver',
    scaling: 'mid',
    difficulty: 3,
    base: 79,
    tags: ['pick', 'trick'],
    fantasy: 'A trickster who makes the enemy dash the wrong way, then laughs from their shadow.',
    abilities: [
      { name: 'Doppel', text: 'Leaves an illusion that copies the next spell.' },
      { name: 'Misrule', text: 'Curses a foe so their next dash fumbles.' },
      { name: 'Swapjoke', text: 'Trades places with an enemy and silences them for a breath.' }
    ],
    synergy: ['skadi', 'bastet'],
    art: '/champions/champ-loki.jpg'
  },
  {
    id: 'sekhmet',
    name: 'Sekhmet',
    title: 'Lioness of Plague',
    mythology: 'egyptian',
    role: 'warden',
    scaling: 'early',
    difficulty: 1,
    base: 82,
    tags: ['brawl', 'dive'],
    fantasy: 'A lioness of war who wants the game decided before the Worldheart wakes.',
    abilities: [
      { name: 'Sunscar', text: 'A dashing strike that heals her if the target is already hurt.' },
      { name: 'Desert Roar', text: 'A short fear that shoves the lane apart.' },
      { name: 'Plague of Lions', text: 'Goes berserk. Her swings cleave everyone in reach.' }
    ],
    synergy: ['bastet', 'anubis'],
    art: '/champions/champ-sekhmet.jpg'
  },
  {
    id: 'bastet',
    name: 'Bastet',
    title: 'Ninefold',
    mythology: 'egyptian',
    role: 'slayer',
    scaling: 'mid',
    difficulty: 2,
    base: 81,
    tags: ['assassin', 'reset'],
    fantasy: 'A night hunter who deletes an isolated carry and spends one of her nine lives to leave.',
    abilities: [
      { name: 'Prowl', text: 'Vanishes between brushes.' },
      { name: 'Goldclaw', text: 'A burst that hits harder on a lone target.' },
      { name: 'Nine Lives', text: 'Cheats one death in a fight and reappears behind the killer.' }
    ],
    synergy: ['sekhmet', 'loki'],
    art: '/champions/champ-bastet.jpg'
  },
  {
    id: 'anubis',
    name: 'Anubis',
    title: 'Last Rite',
    mythology: 'egyptian',
    role: 'weaver',
    scaling: 'late',
    difficulty: 3,
    base: 83,
    tags: ['control', 'zone'],
    fantasy: 'The judge of the pit. Step into his corridor and the fight is no longer yours.',
    abilities: [
      { name: 'Weigh the Heart', text: 'Marks a foe. If they drop low, they are stunned.' },
      { name: 'Embalm', text: 'A zone that grounds and punishes anyone who stays.' },
      { name: 'Jackal Gate', text: 'Opens a corridor of souls that drags enemies to the center.' }
    ],
    synergy: ['sekhmet', 'artemis'],
    art: '/champions/champ-anubis.jpg'
  },
  {
    id: 'achilles',
    name: 'Achilles',
    title: 'The Named Heel',
    mythology: 'greek',
    role: 'warden',
    scaling: 'mid',
    difficulty: 2,
    base: 82,
    tags: ['duel', 'frontline'],
    fantasy: 'An immortal duelist with one bright weakness. Lock him in and the rest of the map waits.',
    abilities: [
      { name: 'Aristeia', text: 'A short untouchable dash, followed by a frail heartbeat.' },
      { name: 'Myrmidon Line', text: 'A phalanx that slows whoever he faces.' },
      { name: 'Immortal Duel', text: 'Locks one enemy into a duel and pushes everyone else out.' }
    ],
    synergy: ['athena', 'artemis'],
    art: '/champions/champ-achilles.jpg'
  },
  {
    id: 'artemis',
    name: 'Artemis',
    title: 'Silver Chase',
    mythology: 'greek',
    role: 'slayer',
    scaling: 'late',
    difficulty: 2,
    base: 85,
    tags: ['marksman', 'pick'],
    fantasy: 'The moon hunt. Once she marks you, the whole Spire knows where you are.',
    abilities: [
      { name: 'Silver Arrow', text: 'A skillshot that marks her prey.' },
      { name: 'Caltrops', text: 'A slow field strewn across a jungle path.' },
      { name: 'Goddess Hunt', text: 'Reveals the marked prey and fires one enormous shot.' }
    ],
    synergy: ['achilles', 'anubis'],
    art: '/champions/champ-artemis.jpg'
  },
  {
    id: 'athena',
    name: 'Athena',
    title: 'Aegis',
    mythology: 'greek',
    role: 'weaver',
    scaling: 'mid',
    difficulty: 1,
    base: 80,
    tags: ['enchanter', 'vision'],
    fantasy: 'Strategy made flesh. Her owl finds the fight, and her dome decides who is allowed to shoot.',
    abilities: [
      { name: 'Owl Scout', text: 'Sends a bird that grants vision along a path.' },
      { name: 'War Counsel', text: 'Buffs an ally’s attack speed and tenacity.' },
      { name: 'Palladium', text: 'Raises a dome that blocks enemy projectiles.' }
    ],
    synergy: ['achilles', 'brynhild'],
    art: '/champions/champ-athena.jpg'
  },
  {
    id: 'raijin',
    name: 'Raijin',
    title: 'Drum of Heaven',
    mythology: 'japanese',
    role: 'warden',
    scaling: 'early',
    difficulty: 2,
    base: 81,
    tags: ['engage', 'aoe'],
    fantasy: 'Thunder with a drumline. He starts the fight whether the other team is ready or not.',
    abilities: [
      { name: 'Taiko', text: 'A slam that knocks the lane upward.' },
      { name: 'Storm Ring', text: 'Drums orbit him and punish anyone who stands close.' },
      { name: 'Raiju', text: 'Becomes a bolt and crashes down a path.' }
    ],
    synergy: ['susanoo', 'amaterasu'],
    art: '/champions/champ-raijin.jpg'
  },
  {
    id: 'susanoo',
    name: 'Susanoo',
    title: 'Storm Sword',
    mythology: 'japanese',
    role: 'slayer',
    scaling: 'mid',
    difficulty: 3,
    base: 83,
    tags: ['skirmish', 'melee'],
    fantasy: 'A storm swordsman who wins the messy fights in the river and hates a quiet map.',
    abilities: [
      { name: 'Totsuka', text: 'A three-hit blade combo.' },
      { name: 'Tempest Step', text: 'Dashes through minions and leaves a cut of wind.' },
      { name: 'Orochi Sever', text: 'A wide slash that hits harder on controlled targets.' }
    ],
    synergy: ['raijin', 'loki'],
    art: '/champions/champ-susanoo.jpg'
  },
  {
    id: 'amaterasu',
    name: 'Amaterasu',
    title: 'Dawn Mirror',
    mythology: 'japanese',
    role: 'weaver',
    scaling: 'late',
    difficulty: 2,
    base: 80,
    tags: ['protect', 'sustain'],
    fantasy: 'The rising sun. She hides an ally in light and brings them back when the fight turns.',
    abilities: [
      { name: 'Dawn Veil', text: 'A beam that heals allies standing in it.' },
      { name: 'Mirror Light', text: 'Reflects the next projectile that would hit her ally.' },
      { name: 'Heavenly Cave', text: 'Hides an ally in radiance, then returns them with a shield.' }
    ],
    synergy: ['susanoo', 'skadi'],
    art: '/champions/champ-amaterasu.jpg'
  }
];

export const CHAMPION_MAP: Record<string, Champion> = Object.fromEntries(
  CHAMPIONS.map((champion) => [champion.id, champion])
);

export const MYTH_LABEL: Record<Champion['mythology'], string> = {
  norse: 'Norse',
  egyptian: 'Egyptian',
  greek: 'Greek',
  japanese: 'Japanese'
};

export const ROLE_LABEL: Record<Champion['role'], string> = {
  warden: 'Warden',
  slayer: 'Slayer',
  weaver: 'Weaver'
};

export const ROLE_BLURB: Record<Champion['role'], string> = {
  warden: 'Holds the front of Spire Rift and starts or stops the fight.',
  slayer: 'Takes the kills. The player the other two are built around.',
  weaver: 'Vision, control, and the setup that makes a slayer look gifted.'
};

export function champName(id: string): string {
  return CHAMPION_MAP[id]?.name ?? id;
}

export function patchTier(score: number): string {
  if (score >= 90) return 'S';
  if (score >= 84) return 'A';
  if (score >= 78) return 'B';
  return 'C';
}
