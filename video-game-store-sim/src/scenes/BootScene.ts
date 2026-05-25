import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem';
import { startingStoreState, type StoreState } from '../types/GameTypes';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    const loadedState = SaveSystem.load();
    const initialState = this.cloneState(loadedState ?? startingStoreState);

    this.scene.start('StoreScene', {
      initialState
    });

    this.scene.launch('UIScene');
  }

  private cloneState(state: StoreState): StoreState {
    return {
      day: state.day,
      money: state.money,
      reputation: state.reputation,
      rent: state.rent,
      soldToday: state.soldToday,
      inventory: { ...state.inventory }
    };
  }
}
