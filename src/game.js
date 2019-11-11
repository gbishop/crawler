/** @typedef {import('phaser')} Phaser */
import settings from "./settings.js";

export class GameScene extends Phaser.Scene {
  constructor() {
    super({
      key: "GameScene"
    });
    this.canvas = document.querySelector("canvas");
    this.score = 0;
    // cast this once so I don't have to below
    // shouldn't I be able to just assert this?
    this.sound = /** @type {Phaser.Sound.WebAudioSoundManager} */ (super.sound);
  }

  preload() {
  }

  create() {

    this.scoreDisplay = this.add.text(20, 20, "0", { fontSize: 20 });

    // control sound
    if (settings.sound) {
    }
  }

}
