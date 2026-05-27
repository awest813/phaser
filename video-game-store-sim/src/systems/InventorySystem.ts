import type { StoreState } from '../types/GameTypes';

export class InventorySystem {
  private readonly state: StoreState;

  constructor(state: StoreState) {
    this.state = state;
  }

  getQuantity(itemId: string): number {
    return this.state.inventory[itemId] ?? 0;
  }

  takeOne(itemId: string): boolean {
    const current = this.getQuantity(itemId);

    if (current <= 0) {
      return false;
    }

    this.state.inventory[itemId] = current - 1;

    return true;
  }

  addOne(itemId: string): void {
    this.state.inventory[itemId] = (this.state.inventory[itemId] ?? 0) + 1;
  }

  getTotalInventory(): number {
    return Object.values(this.state.inventory).reduce((sum, count) => sum + count, 0);
  }
}
