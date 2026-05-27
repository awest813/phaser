import type { CustomerType } from '../types/GameTypes';

export const CUSTOMER_TYPES: CustomerType[] = [
  {
    id: 'casualParent',
    name: 'Casual Parent',
    budgetMin: 20,
    budgetMax: 80,
    preferredCategories: ['game', 'accessory'],
    patience: 10
  },
  {
    id: 'retroCollector',
    name: 'Retro Collector',
    budgetMin: 50,
    budgetMax: 150,
    preferredCategories: ['game', 'console'],
    patience: 15
  },
  {
    id: 'bargainHunter',
    name: 'Bargain Hunter',
    budgetMin: 5,
    budgetMax: 35,
    preferredCategories: ['game'],
    patience: 8
  }
];
