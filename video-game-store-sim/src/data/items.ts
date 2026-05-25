import type { ItemData } from '../types/GameTypes';

export const ITEMS: ItemData[] = [
  {
    id: 'pixelQuest',
    name: 'Pixel Quest',
    platform: 'GameBrick',
    category: 'game',
    buyPrice: 8,
    sellPrice: 20,
    demand: 0.7
  },
  {
    id: 'kartLegends',
    name: 'Kart Legends',
    platform: 'Super GameBrick',
    category: 'game',
    buyPrice: 12,
    sellPrice: 30,
    demand: 0.8
  },
  {
    id: 'zombieBasement',
    name: 'Zombie Basement',
    platform: 'PolyStation',
    category: 'game',
    buyPrice: 10,
    sellPrice: 25,
    demand: 0.5
  },
  {
    id: 'spaceFighter64',
    name: 'Space Fighter 64',
    platform: 'DreamCube 64',
    category: 'game',
    buyPrice: 15,
    sellPrice: 40,
    demand: 0.45
  },
  {
    id: 'football2006',
    name: 'Football 2006',
    platform: 'X-Block',
    category: 'game',
    buyPrice: 2,
    sellPrice: 8,
    demand: 0.2
  }
];

export const ITEMS_BY_ID: Record<string, ItemData> = Object.fromEntries(ITEMS.map((item) => [item.id, item]));
