import Phaser from 'phaser';
import type { StoreState } from '../types/GameTypes';
import { Hud } from '../ui/Hud';
import { RestockPanel } from '../ui/RestockPanel';

export class UIScene extends Phaser.Scene {
  private hud?: Hud;

  private restockPanel?: RestockPanel;

  constructor() {
    super('UIScene');
  }

  create(): void {
    this.restockPanel = new RestockPanel({
      scene: this,
      onBuy: (item) => {
        this.game.events.emit('store:buyStock', item);
      },
      onClose: () => {
        this.restockPanel?.hide();
      }
    });

    this.hud = new Hud({
      scene: this,
      onEndDay: () => {
        this.game.events.emit('store:endDay');
      },
      onRestock: () => {
        this.restockPanel?.show();
      }
    });

    this.game.events.on('store:state', this.handleState, this);
    this.game.events.on('store:message', this.showMessage, this);
    this.game.events.on('store:gameOver', this.showGameOver, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('store:state', this.handleState, this);
      this.game.events.off('store:message', this.showMessage, this);
      this.game.events.off('store:gameOver', this.showGameOver, this);
    });
  }

  private handleState(state: StoreState): void {
    this.hud?.update(state);
    this.restockPanel?.updateState(state);
  }

  private showMessage(message: string): void {
    const floating = this.add
      .text(400, 42, message, {
        color: '#fff4aa',
        fontSize: '24px',
        fontFamily: 'monospace'
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.tweens.add({
      targets: floating,
      y: 18,
      alpha: 0,
      duration: 1300,
      ease: 'Sine.easeOut',
      onComplete: () => floating.destroy()
    });
  }

  private showGameOver(): void {
    const overlay = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.85).setDepth(40);
    overlay.setInteractive();

    this.add
      .text(400, 200, 'GAME OVER', {
        color: '#ff4444',
        fontSize: '56px',
        fontFamily: 'monospace',
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(41);

    this.add
      .text(400, 278, "You couldn't make rent.", {
        color: '#cccccc',
        fontSize: '22px',
        fontFamily: 'monospace'
      })
      .setOrigin(0.5)
      .setDepth(41);

    const newGameBtn = this.add
      .rectangle(400, 360, 180, 50, 0x2e8b57)
      .setInteractive({ cursor: 'pointer' })
      .setDepth(41);

    this.add
      .text(400, 360, 'New Game', {
        color: '#ffffff',
        fontSize: '24px',
        fontFamily: 'monospace'
      })
      .setOrigin(0.5)
      .setDepth(42);

    newGameBtn.on('pointerdown', () => {
      this.game.events.emit('store:newGame');
    });
    newGameBtn.on('pointerover', () => newGameBtn.setFillStyle(0x37a66a));
    newGameBtn.on('pointerout', () => newGameBtn.setFillStyle(0x2e8b57));
  }
}
