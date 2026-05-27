import type { ItemData, StoreState } from '../types/GameTypes';

export class EconomySystem {
  private readonly state: StoreState;

  constructor(state: StoreState) {
    this.state = state;
  }

  recordSale(item: ItemData): void {
    this.state.money += item.sellPrice;
    this.state.soldToday += 1;
    this.state.reputation += 1;
  }

  endDay(): { rentPaid: number; nextDay: number } {
    this.state.money -= this.state.rent;
    const rentPaid = this.state.rent;
    this.state.day += 1;
    this.state.soldToday = 0;

    return {
      rentPaid,
      nextDay: this.state.day
    };
  }
}
