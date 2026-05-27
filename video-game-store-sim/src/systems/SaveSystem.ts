import type { StoreState } from '../types/GameTypes';

const SAVE_KEY = 'videoGameStoreSave';

export class SaveSystem {
  static save(state: StoreState): void {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }

  static load(): StoreState | null {
    const raw = localStorage.getItem(SAVE_KEY);

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as StoreState;
    } catch {
      return null;
    }
  }

  static clear(): void {
    localStorage.removeItem(SAVE_KEY);
  }
}
