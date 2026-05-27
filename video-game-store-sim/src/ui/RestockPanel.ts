import Phaser from 'phaser';
import { ITEMS } from '../data/items';
import type { ItemData, StoreState } from '../types/GameTypes';

type RestockPanelConfig = {
  scene: Phaser.Scene;
  onBuy: (item: ItemData) => void;
  onClose: () => void;
};

const PANEL_CX = 400;
const PANEL_CY = 262;
const PANEL_W = 560;
const PANEL_H = 336;

export class RestockPanel {
  private readonly container: Phaser.GameObjects.Container;

  private readonly buyButtons: Map<string, Phaser.GameObjects.Rectangle> = new Map();

  private readonly qtyLabels: Map<string, Phaser.GameObjects.Text> = new Map();

  private currentMoney = 0;

  constructor(config: RestockPanelConfig) {
    const { scene } = config;

    this.container = scene.add.container(0, 0).setDepth(30).setVisible(false);

    const overlay = scene.add.rectangle(400, 300, 800, 600, 0x000000, 0.72);
    overlay.setInteractive();
    this.container.add(overlay);

    const borderRect = scene.add.rectangle(PANEL_CX, PANEL_CY, PANEL_W + 4, PANEL_H + 4, 0x4444aa);
    this.container.add(borderRect);

    const panelRect = scene.add.rectangle(PANEL_CX, PANEL_CY, PANEL_W, PANEL_H, 0x12122a);
    this.container.add(panelRect);

    const panelTop = PANEL_CY - PANEL_H / 2;

    this.container.add(
      scene.add
        .text(PANEL_CX, panelTop + 22, 'BUY STOCK', {
          color: '#ffe566',
          fontSize: '22px',
          fontFamily: 'monospace',
          fontStyle: 'bold'
        })
        .setOrigin(0.5)
    );

    const headerY = panelTop + 56;

    this.container.add(
      scene.add.text(148, headerY, 'Item', { color: '#8888cc', fontSize: '12px', fontFamily: 'monospace' })
    );
    this.container.add(
      scene.add.text(310, headerY, 'Platform', { color: '#8888cc', fontSize: '12px', fontFamily: 'monospace' })
    );
    this.container.add(
      scene.add.text(450, headerY, 'Buy $', { color: '#8888cc', fontSize: '12px', fontFamily: 'monospace' })
    );
    this.container.add(
      scene.add.text(512, headerY, 'In Stock', { color: '#8888cc', fontSize: '12px', fontFamily: 'monospace' })
    );

    ITEMS.forEach((item, idx) => {
      const rowY = panelTop + 80 + idx * 34;

      this.container.add(
        scene.add.text(148, rowY, item.name, { color: '#f0f0f0', fontSize: '14px', fontFamily: 'monospace' })
      );
      this.container.add(
        scene.add.text(310, rowY, item.platform, { color: '#aaaaaa', fontSize: '12px', fontFamily: 'monospace' })
      );
      this.container.add(
        scene.add.text(450, rowY, `$${item.buyPrice}`, { color: '#88dd88', fontSize: '14px', fontFamily: 'monospace' })
      );

      const qtyLabel = scene.add
        .text(536, rowY, '0', { color: '#ffffff', fontSize: '14px', fontFamily: 'monospace' })
        .setOrigin(0.5, 0);
      this.qtyLabels.set(item.id, qtyLabel);
      this.container.add(qtyLabel);

      const btn = scene.add.rectangle(615, rowY + 9, 68, 24, 0x2e8b57).setInteractive({ cursor: 'pointer' });
      this.buyButtons.set(item.id, btn);

      const btnLabel = scene.add
        .text(615, rowY + 9, 'BUY', { color: '#ffffff', fontSize: '13px', fontFamily: 'monospace' })
        .setOrigin(0.5);

      btn.on('pointerdown', () => config.onBuy(item));
      btn.on('pointerover', () => {
        if (this.currentMoney >= item.buyPrice) btn.setFillStyle(0x37a66a);
      });
      btn.on('pointerout', () => this.refreshButtonStyle(item));

      this.container.add(btn);
      this.container.add(btnLabel);
    });

    const dividerY = panelTop + 80 + ITEMS.length * 34 + 6;
    this.container.add(scene.add.rectangle(PANEL_CX, dividerY, PANEL_W - 40, 1, 0x333366));

    const closeBtnY = panelTop + PANEL_H - 26;
    const closeBtn = scene.add
      .rectangle(PANEL_CX, closeBtnY, 130, 34, 0x883322)
      .setInteractive({ cursor: 'pointer' });
    const closeLabel = scene.add
      .text(PANEL_CX, closeBtnY, 'CLOSE', { color: '#ffffff', fontSize: '16px', fontFamily: 'monospace' })
      .setOrigin(0.5);

    closeBtn.on('pointerdown', config.onClose);
    closeBtn.on('pointerover', () => closeBtn.setFillStyle(0xaa4433));
    closeBtn.on('pointerout', () => closeBtn.setFillStyle(0x883322));

    this.container.add(closeBtn);
    this.container.add(closeLabel);
  }

  show(): void {
    this.container.setVisible(true);
  }

  hide(): void {
    this.container.setVisible(false);
  }

  updateState(state: StoreState): void {
    this.currentMoney = state.money;

    for (const item of ITEMS) {
      const qty = state.inventory[item.id] ?? 0;
      this.qtyLabels.get(item.id)?.setText(String(qty));
      this.refreshButtonStyle(item);
    }
  }

  private refreshButtonStyle(item: ItemData): void {
    const btn = this.buyButtons.get(item.id);
    if (!btn) return;
    btn.setFillStyle(this.currentMoney >= item.buyPrice ? 0x2e8b57 : 0x555555);
  }
}
