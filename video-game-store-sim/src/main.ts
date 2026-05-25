import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { StoreScene } from './scenes/StoreScene';
import { UIScene } from './scenes/UIScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#ede0bf',
  parent: 'game-container',
  scene: [BootScene, StoreScene, UIScene]
};

new Phaser.Game(config);
