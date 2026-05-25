import Phaser from 'phaser';
import type { StoreState } from '../types/GameTypes';
import { Hud } from '../ui/Hud';

export class UIScene extends Phaser.Scene {
  private hud?: Hud;

  constructor() {
    super('UIScene');
  }

  create(): void {
    this.hud = new Hud({
      scene: this,
      onEndDay: () => {
        this.game.events.emit('store:endDay');
      }
    });

    this.game.events.on('store:state', this.handleState, this);
    this.game.events.on('store:message', this.showMessage, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('store:state', this.handleState, this);
      this.game.events.off('store:message', this.showMessage, this);
    });
  }

  private handleState(state: StoreState): void {
    this.hud?.update(state);
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
}
