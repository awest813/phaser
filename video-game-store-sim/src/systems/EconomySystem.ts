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

  buyStock(item: ItemData): boolean {
    if (this.state.money < item.buyPrice) {
      return false;
    }

    this.state.money -= item.buyPrice;
    return true;
  }

  endDay(): { rentPaid: number; nextDay: number; newRent: number; gameOver: boolean } {
    this.state.money -= this.state.rent;
    const rentPaid = this.state.rent;

    if (this.state.money < 0) {
      return { rentPaid, nextDay: this.state.day, newRent: this.state.rent + 5, gameOver: true };
    }

    this.state.rent += 5;
    this.state.day += 1;
    this.state.soldToday = 0;

    return { rentPaid, nextDay: this.state.day, newRent: this.state.rent, gameOver: false };
  }
}
