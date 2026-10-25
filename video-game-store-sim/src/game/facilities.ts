export interface Facility {
  id: string;
  name: string;
  cost: number;
  upkeep: number;
  training: number;
  recovery: number;
  revenue: number;
  dev: number;
  prep: number;
  scout: 0 | 1 | 2 | 3;
  scene: string;
  unlock: string;
}

export const FACILITIES: Facility[] = [
  {
    id: 'garage',
    name: 'The Garage',
    cost: 0,
    upkeep: 450,
    training: 0.55,
    recovery: 0.5,
    revenue: 1,
    dev: 0.42,
    prep: 0,
    scout: 0,
    scene: 'Oil stains, two folding tables, a space heater, and a router taped to a stud.',
    unlock: 'You have a team. The two prospects practice after midnight on the spare PCs.'
  },
  {
    id: 'spare',
    name: 'Spare Room',
    cost: 15000,
    upkeep: 700,
    training: 0.68,
    recovery: 0.62,
    revenue: 1.1,
    dev: 0.55,
    prep: 2,
    scout: 1,
    scene: 'The car is gone. Matching monitors, a whiteboard, and a door that actually locks.',
    unlock: 'Scouting reads how opponents like to play. Practice stops being a LAN party.'
  },
  {
    id: 'house',
    name: 'Practice House',
    cost: 34000,
    upkeep: 1100,
    training: 0.8,
    recovery: 0.74,
    revenue: 1.22,
    dev: 0.68,
    prep: 3,
    scout: 1,
    scene: 'A rented house, five serious setups, and a kitchen that sometimes has food in it.',
    unlock: 'Scrims get cleaner. Sponsors stop calling you an amateur clip channel.'
  },
  {
    id: 'loft',
    name: 'Bootcamp Loft',
    cost: 62000,
    upkeep: 1600,
    training: 0.92,
    recovery: 0.86,
    revenue: 1.38,
    dev: 0.8,
    prep: 4,
    scout: 2,
    scene: 'Blackout curtains, an analyst desk, and a wall of the last twenty games.',
    unlock: 'You can see opponent starters and roles before the ban. VOD is a job now.'
  },
  {
    id: 'academy',
    name: 'Academy Wing',
    cost: 98000,
    upkeep: 2300,
    training: 1.05,
    recovery: 0.98,
    revenue: 1.55,
    dev: 1.08,
    prep: 5,
    scout: 2,
    scene: 'A second scrim room with a door between the main roster and the two prospects.',
    unlock: 'Development training finally works. Prospects grow like they belong to the org.'
  },
  {
    id: 'performance',
    name: 'Performance Center',
    cost: 150000,
    upkeep: 3200,
    training: 1.18,
    recovery: 1.16,
    revenue: 1.78,
    dev: 1.22,
    prep: 7,
    scout: 3,
    scene: 'Aim lab, physio table, a chef, and a schedule that does not include pizza as policy.',
    unlock: 'Full scouting. Stars will finally take a meeting. Fatigue stops ending seasons.'
  },
  {
    id: 'campus',
    name: 'Esports Campus',
    cost: 230000,
    upkeep: 4500,
    training: 1.32,
    recovery: 1.32,
    revenue: 2.05,
    dev: 1.36,
    prep: 9,
    scout: 3,
    scene: 'A stage, a content studio, a brand wall, and parking that is not the driveway.',
    unlock: 'Match day pays like a real org. The building itself recruits fans.'
  },
  {
    id: 'hq',
    name: 'Mythic Arena HQ',
    cost: 340000,
    upkeep: 6200,
    training: 1.5,
    recovery: 1.5,
    revenue: 2.45,
    dev: 1.5,
    prep: 12,
    scout: 3,
    scene: 'A private arena, a data room, a championship hall, and a garage door nobody needs anymore.',
    unlock: 'The complete facility. Every system you started without is finished.'
  }
];

export function facilityAt(tier: number): Facility {
  return FACILITIES[Math.max(0, Math.min(FACILITIES.length - 1, tier))];
}
