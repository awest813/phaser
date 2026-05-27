import Phaser from 'phaser';
import { ITEMS_BY_ID } from '../data/items';
import { SHELVES } from '../data/shelves';
import { startingStoreState, type ItemData, type StoreState } from '../types/GameTypes';
import { CustomerSystem } from '../systems/CustomerSystem';
import { EconomySystem } from '../systems/EconomySystem';
import { InventorySystem } from '../systems/InventorySystem';
import { SaveSystem } from '../systems/SaveSystem';

type StoreSceneData = {
  initialState?: StoreState;
};

export class StoreScene extends Phaser.Scene {
  private storeState!: StoreState;

  private inventorySystem!: InventorySystem;

  private economySystem!: EconomySystem;

  private customerSystem!: CustomerSystem;

  constructor() {
    super('StoreScene');
  }

  create(data: StoreSceneData): void {
    this.storeState = this.cloneState(data.initialState ?? startingStoreState);

    this.drawStore();

    this.inventorySystem = new InventorySystem(this.storeState);
    this.economySystem = new EconomySystem(this.storeState);

    const doorPosition = new Phaser.Math.Vector2(400, 68);
    const exitPosition = new Phaser.Math.Vector2(400, 68);

    this.customerSystem = new CustomerSystem({
      scene: this,
      shelves: SHELVES,
      inventorySystem: this.inventorySystem,
      economySystem: this.economySystem,
      doorPosition,
      exitPosition,
      onSale: (item, x, y) => {
        this.showSaleText(item.name, item.sellPrice, x, y);
        this.emitState();
      }
    });

    this.time.addEvent({
      delay: 2500,
      loop: true,
      callback: () => {
        this.customerSystem.spawnCustomer();
      }
    });

    this.game.events.on('store:endDay', this.endDay, this);
    this.game.events.on('store:buyStock', this.buyStock, this);
    this.game.events.on('store:newGame', this.newGame, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('store:endDay', this.endDay, this);
      this.game.events.off('store:buyStock', this.buyStock, this);
      this.game.events.off('store:newGame', this.newGame, this);
    });

    this.emitState();
  }

  update(time: number, delta: number): void {
    this.customerSystem.update(time, delta);
  }

  private drawStore(): void {
    this.cameras.main.setBackgroundColor(0xede0bf);

    const grid = this.add.graphics();
    grid.lineStyle(1, 0xd7c7a6, 0.9);

    for (let x = 0; x <= 800; x += 40) {
      grid.lineBetween(x, 0, x, 600);
    }

    for (let y = 0; y <= 600; y += 40) {
      grid.lineBetween(0, y, 800, y);
    }

    this.add.rectangle(400, 50, 90, 36, 0x40a85a);
    this.add.text(368, 40, 'DOOR', { color: '#ffffff', fontSize: '14px', fontFamily: 'monospace' });

    for (const shelf of SHELVES) {
      this.add.rectangle(shelf.x, shelf.y, 120, 44, 0x8b5a2b);
      this.add.text(shelf.x - 52, shelf.y - 9, 'Shelf', {
        color: '#fff7e6',
        fontSize: '14px',
        fontFamily: 'monospace'
      });
    }

    this.add.rectangle(400, 470, 270, 56, 0x7a7a7a);
    this.add.text(343, 460, 'COUNTER', { color: '#f5f5f5', fontSize: '16px', fontFamily: 'monospace' });
  }

  private showSaleText(itemName: string, amount: number, x: number, y: number): void {
    const saleText = this.add
      .text(x, y, `+ $${amount} ${itemName}`, {
        color: '#88ff88',
        fontSize: '14px',
        fontFamily: 'monospace'
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: saleText,
      y: y - 30,
      alpha: 0,
      duration: 900,
      ease: 'Sine.easeOut',
      onComplete: () => saleText.destroy()
    });
  }

  private endDay(): void {
    const result = this.economySystem.endDay();
    this.customerSystem.setMaxCustomers(Math.min(3 + (this.storeState.day - 1), 6));

    if (result.gameOver) {
      SaveSystem.clear();
      this.game.events.emit('store:gameOver');
      return;
    }

    SaveSystem.save(this.storeState);

    this.game.events.emit(
      'store:message',
      `Rent Paid: -$${result.rentPaid}  •  Next Rent: $${result.newRent}  •  Day ${result.nextDay} begins`
    );
    this.emitState();
  }

  private buyStock(item: ItemData): void {
    if (this.economySystem.buyStock(item)) {
      this.inventorySystem.addOne(item.id);
      this.emitState();
    }
  }

  private newGame(): void {
    SaveSystem.clear();
    this.scene.stop('UIScene');
    this.scene.start('BootScene');
  }

  private emitState(): void {
    this.game.events.emit('store:state', this.cloneState(this.storeState));
  }

  private cloneState(state: StoreState): StoreState {
    const cleanedInventory: Record<string, number> = {};

    for (const [itemId, count] of Object.entries(state.inventory)) {
      if (ITEMS_BY_ID[itemId] !== undefined) {
        cleanedInventory[itemId] = count;
      }
    }

    return {
      day: state.day,
      money: state.money,
      reputation: state.reputation,
      rent: state.rent,
      inventory: cleanedInventory,
      soldToday: state.soldToday
    };
  }
}
