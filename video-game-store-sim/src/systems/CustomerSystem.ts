import Phaser from 'phaser';
import { CUSTOMER_TYPES } from '../data/customers';
import { ITEMS_BY_ID } from '../data/items';
import type { CustomerPhase, ItemData, ShelfData, StoreState } from '../types/GameTypes';
import { EconomySystem } from './EconomySystem';
import { InventorySystem } from './InventorySystem';

type CustomerAgent = {
  sprite: Phaser.GameObjects.Rectangle;
  state: CustomerPhase;
  shelf: ShelfData;
  budget: number;
  browseUntil: number;
  speed: number;
};

type CustomerSystemConfig = {
  scene: Phaser.Scene;
  storeState: StoreState;
  shelves: ShelfData[];
  inventorySystem: InventorySystem;
  economySystem: EconomySystem;
  doorPosition: Phaser.Math.Vector2;
  exitPosition: Phaser.Math.Vector2;
  onSale: (item: ItemData, x: number, y: number) => void;
};

export class CustomerSystem {
  private readonly scene: Phaser.Scene;

  private readonly storeState: StoreState;

  private readonly shelves: ShelfData[];

  private readonly inventorySystem: InventorySystem;

  private readonly economySystem: EconomySystem;

  private readonly doorPosition: Phaser.Math.Vector2;

  private readonly exitPosition: Phaser.Math.Vector2;

  private readonly onSale: (item: ItemData, x: number, y: number) => void;

  private customers: CustomerAgent[] = [];

  private maxCustomers = 3;

  constructor(config: CustomerSystemConfig) {
    this.scene = config.scene;
    this.storeState = config.storeState;
    this.shelves = config.shelves;
    this.inventorySystem = config.inventorySystem;
    this.economySystem = config.economySystem;
    this.doorPosition = config.doorPosition;
    this.exitPosition = config.exitPosition;
    this.onSale = config.onSale;
  }

  setMaxCustomers(maxCustomers: number): void {
    this.maxCustomers = maxCustomers;
  }

  spawnCustomer(): void {
    if (this.customers.length >= this.maxCustomers) {
      return;
    }

    const type = Phaser.Utils.Array.GetRandom(CUSTOMER_TYPES);
    const budget = Phaser.Math.Between(type.budgetMin, type.budgetMax);
    const shelf = Phaser.Utils.Array.GetRandom(this.shelves);

    const sprite = this.scene.add.rectangle(this.doorPosition.x, this.doorPosition.y, 18, 24, 0x2f6bff);

    this.customers.push({
      sprite,
      state: 'ENTERING',
      shelf,
      budget,
      browseUntil: 0,
      speed: Phaser.Math.FloatBetween(70, 95)
    });
  }

  update(time: number, delta: number): void {
    for (let i = this.customers.length - 1; i >= 0; i -= 1) {
      const customer = this.customers[i];

      if (customer.state === 'ENTERING') {
        const reachedShelf = this.moveTowards(customer.sprite, customer.shelf.x, customer.shelf.y + 36, customer.speed, delta);

        if (reachedShelf) {
          customer.state = 'BROWSING';
          customer.browseUntil = time + Phaser.Math.Between(1000, 2000);
        }

        continue;
      }

      if (customer.state === 'BROWSING') {
        if (time >= customer.browseUntil) {
          customer.state = 'BUYING';
        }

        continue;
      }

      if (customer.state === 'BUYING') {
        this.trySale(customer);
        customer.state = 'LEAVING';
        continue;
      }

      const reachedExit = this.moveTowards(
        customer.sprite,
        this.exitPosition.x,
        this.exitPosition.y,
        customer.speed,
        delta
      );

      if (reachedExit) {
        customer.sprite.destroy();
        this.customers.splice(i, 1);
      }
    }
  }

  private moveTowards(
    sprite: Phaser.GameObjects.Rectangle,
    targetX: number,
    targetY: number,
    speed: number,
    delta: number
  ): boolean {
    const distanceX = targetX - sprite.x;
    const distanceY = targetY - sprite.y;
    const distance = Math.hypot(distanceX, distanceY);

    if (distance < 1) {
      sprite.setPosition(targetX, targetY);
      return true;
    }

    const step = (speed * delta) / 1000;

    if (step >= distance) {
      sprite.setPosition(targetX, targetY);
      return true;
    }

    sprite.x += (distanceX / distance) * step;
    sprite.y += (distanceY / distance) * step;

    return false;
  }

  private trySale(customer: CustomerAgent): void {
    const possibleItems = customer.shelf.itemIds
      .map((itemId) => ITEMS_BY_ID[itemId])
      .filter((item) => item !== undefined)
      .filter((item) => this.inventorySystem.getQuantity(item.id) > 0)
      .filter((item) => item.sellPrice <= customer.budget);

    if (possibleItems.length === 0) {
      return;
    }

    const pickedItem = Phaser.Utils.Array.GetRandom(possibleItems);

    if (!this.inventorySystem.takeOne(pickedItem.id)) {
      return;
    }

    this.economySystem.recordSale(pickedItem);
    this.onSale(pickedItem, customer.sprite.x, customer.sprite.y - 20);

    this.storeState.reputation += 0;
  }
}
