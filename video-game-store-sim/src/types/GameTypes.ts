export type ItemCategory = 'game' | 'console' | 'accessory';

export type StoreState = {
  day: number;
  money: number;
  reputation: number;
  rent: number;
  inventory: Record<string, number>;
  soldToday: number;
};

export const startingStoreState: StoreState = {
  day: 1,
  money: 500,
  reputation: 0,
  rent: 75,
  inventory: {
    pixelQuest: 5,
    kartLegends: 3,
    zombieBasement: 2
  },
  soldToday: 0
};

export type ItemData = {
  id: string;
  name: string;
  platform: string;
  category: ItemCategory;
  buyPrice: number;
  sellPrice: number;
  demand: number;
};

export type ShelfData = {
  x: number;
  y: number;
  itemIds: string[];
};

export type CustomerType = {
  id: string;
  name: string;
  budgetMin: number;
  budgetMax: number;
  preferredCategories: ItemCategory[];
  patience: number;
};

export type CustomerPhase = 'ENTERING' | 'BROWSING' | 'BUYING' | 'LEAVING';
