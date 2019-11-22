import IsoSprite from "./phaser3-plugin-isometric/IsoSprite.js";

export default class EnhancedIsoSprite extends IsoSprite {
  constructor(config) {
    super(
      config.scene,
      config.x,
      config.y,
      config.z,
      config.texture,
      config.frame
    );
    this.room = config.room;
    this.config = config;
    config.scene.add.existing(this);
  }

  /*
   * What is the likely reward for interacting with this?
   */
  reward(player) {
    return this.config.reward || 0;
  }

  /*
   * Return the location the player should come to for interaction
   * A treasure chest might want you to stand in a special place
   */
  position() {
    return this.isoPosition;
  }

  /*
   * Return the path to the interaction position given the path
   * The idea is to give the object an opportunity to edit the path
   */
  path(path) {
    return path;
  }

  /*
   * Interact with the object
   */
  async interact(player, room) {
    this.visible = false;
    return false; // false to remove, true to keep
  }
}
