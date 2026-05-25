import Phaser from 'phaser';
import type { StoreState } from '../types/GameTypes';

type HudConfig = {
  scene: Phaser.Scene;
  onEndDay: () => void;
};

export class Hud {
  private readonly scene: Phaser.Scene;

  private readonly lines: Phaser.GameObjects.Text;

  private readonly endDayButtonLabel: Phaser.GameObjects.Text;

  constructor(config: HudConfig) {
    this.scene = config.scene;

    const panel = this.scene.add.rectangle(400, 560, 780, 72, 0x111111, 0.78).setOrigin(0.5);
    panel.setDepth(10);

    this.lines = this.scene.add
      .text(18, 532, '', {
        color: '#f9f4d7',
        fontSize: '20px',
        fontFamily: 'monospace'
      })
      .setDepth(11);

    const endDayButton = this.scene.add
      .rectangle(720, 560, 120, 42, 0x2e8b57)
      .setInteractive({ cursor: 'pointer' })
      .setDepth(11);

    this.endDayButtonLabel = this.scene.add
      .text(720, 560, 'End Day', {
        color: '#ffffff',
        fontSize: '20px',
        fontFamily: 'monospace'
      })
      .setOrigin(0.5)
      .setDepth(12);

    endDayButton.on('pointerdown', config.onEndDay);
    endDayButton.on('pointerover', () => endDayButton.setFillStyle(0x37a66a));
    endDayButton.on('pointerout', () => endDayButton.setFillStyle(0x2e8b57));
  }

  update(state: StoreState): void {
    const totalInventory = Object.values(state.inventory).reduce((sum, count) => sum + count, 0);

    this.lines.setText(
      `Day: ${state.day}   Money: $${state.money}   Reputation: ${state.reputation}   Inventory: ${totalInventory}   Sold Today: ${state.soldToday}`
    );

    this.endDayButtonLabel.setText('End Day');
  }
}
