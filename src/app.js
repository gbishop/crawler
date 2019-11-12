/** @typedef {import('phaser')} Phaser */
import { GameScene } from "./game.js";
import settings from "./settings.js";
import { getInput, getInputAll } from "./helpers.js";

const config = {
  title: "Base",
  type: Phaser.AUTO,
  width: 1024,
  height: 1024,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  parent: "game",
  scene: [GameScene],
  physics: {
    default: "arcade",
    arcade: {
      debug: false
    }
  },
  backgroundColor: "#101010"
};

export class MyGame extends Phaser.Game {
  constructor(config) {
    super(config);
  }
}

window.onload = () => {
  let game = null;
  document.getElementById("setup").addEventListener("click", () => {
    if (game) {
      game.destroy(true);
      game = null;
    }
    document.body.classList.value = "settings";
  });
  document.getElementById("playButton").addEventListener("click", () => {
    document.body.classList.value = "play";
    game = new MyGame(config);
  });
  // hack for testing
  if (document.body.classList.value === "play") {
    game = new MyGame(config);
  }

  getInputAll("input[name=mode]").map(
    node => (node.checked = node.value == settings.mode)
  );

  const soundInput = getInput("#sound");
  soundInput.checked = settings.sound;

  document.getElementById("settings").addEventListener("change", e => {
    console.log("change");
    const modeInput = getInput("input[name=mode]:checked");
    const mode = modeInput.value;
    settings.mode = mode;
    settings.sound = soundInput.checked;
    settings.persist();
  });
};
