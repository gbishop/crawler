/** @typedef {import('phaser')} Phaser */
import settings from "./settings.js";
import Dungeon from "./dungeon-generator/generators/dungeon.js";
import EasyStar from "./easystar/easystar.js";
import IsoPlugin from "./phaser3-plugin-isometric/IsoPlugin.js";

const T = 38; // tile width and height

export class GameScene extends Phaser.Scene {
  constructor() {
    super({
      key: "GameScene",
      mapAdd: { isoPlugin: "iso" }
    });
    this.canvas = document.querySelector("canvas");
    this.score = 0;
    // cast this once so I don't have to below
    // shouldn't I be able to just assert this?
    this.sound = /** @type {Phaser.Sound.WebAudioSoundManager} */ (super.sound);
  }

  preload() {
    this.load.scenePlugin({
      key: "IsoPlugin",
      url: IsoPlugin,
      sceneKey: "iso"
    });

    this.load.image("tileset", "assets/cube.png");
    // this.load.image("phaserguy", "assets/phaserguy.png");
    this.load.spritesheet("phaserguy", "assets/george.png", {
      frameWidth: 48,
      frameHeight: 48
    });
  }

  create() {
    this.isoGroup = this.add.group();
    // @ts-ignore
    this.iso.projector.origin.setTo(0.5, 0.3);

    this.dungeon = new Dungeon({
      size: [100, 100],
      // seed: "abcd", //omit for generated seed
      rooms: {
        initial: {
          min_size: [3, 3],
          max_size: [6, 6],
          max_exits: 2
        },
        any: {
          min_size: [3, 3],
          max_size: [7, 7],
          max_exits: 4
        }
      },
      max_corridor_length: 20,
      min_corridor_length: 5,
      corridor_density: 0.0, //corridors per room
      symmetric_rooms: false, // exits must be in the center of a wall if true
      interconnects: 5, //extra corridors to connect rooms and make circular paths. not 100% guaranteed
      max_interconnect_length: 10,
      room_count: 10
    });
    this.dungeon.generate();
    let [ix, iy] = this.dungeon.start_pos;

    this.room = this.dungeon.initial_room;

    // translate into a tilemap
    let [width, height] = this.dungeon.size;
    let grid = [];
    for (let y = 0; y < height; y++) {
      let row = [];
      for (let x = 0; x < width; x++) {
        let t = this.dungeon.walls.get([x, y]);
        row.push(t ? 0 : 28);
      }
      grid.push(row);
    }
    this.tiles = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (grid[y][x] === 0) continue;
        // @ts-ignore
        let tile = this.add.isoSprite(
          x * T,
          y * T,
          grid[y][x] === 0 ? 16 : 0,
          "tileset",
          this.isoGroup
        );
        this.tiles.push(tile);
      }
    }

    // @ts-ignore
    var phaserGuy = this.add.isoSprite(
      ix * T,
      iy * T,
      T,
      "phaserguy",
      this.isoGroup,
      null
    );
    this.anims.create({
      key: "down",
      frames: this.anims.generateFrameNumbers("phaserguy", {
        frames: [0, 4, 8, 12]
      }),
      frameRate: 5,
      repeat: -1
    });
    this.anims.create({
      key: "left",
      frames: this.anims.generateFrameNumbers("phaserguy", {
        frames: [1, 5, 9, 13]
      }),
      frameRate: 5,
      repeat: -1
    });
    this.anims.create({
      key: "up",
      frames: this.anims.generateFrameNumbers("phaserguy", {
        frames: [2, 6, 10, 14]
      }),
      frameRate: 5,
      repeat: -1
    });
    this.anims.create({
      key: "right",
      frames: this.anims.generateFrameNumbers("phaserguy", {
        frames: [3, 7, 11, 15]
      }),
      frameRate: 5,
      repeat: -1
    });
    this.player = phaserGuy;
    this.lighting();
    // this.player.x = ix * 32;
    // this.player.y = iy * 32;

    this.finder = new EasyStar.js();
    this.finder.setGrid(grid);
    this.finder.setAcceptableTiles([28]);
    // this.finder.enableDiagonals();
    // this.finder.disableCornerCutting();

    this.scoreDisplay = this.add.text(20, 20, "0", { fontSize: 20 });

    // control sound
    if (settings.sound) {
    }

    // configure the camera
    this.cameras.main.setSize(20 * T, 20 * T);
    this.cameras.main.startFollow(this.player);

    // handle keyboard input
    this.input.keyboard.on("keydown", e => {
      const angles = {
        ArrowDown: 0,
        ArrowLeft: 90,
        ArrowUp: 180,
        ArrowRight: 270
      };
      if (e.code in angles) {
        const angle = angles[e.code];
        console.log(this.room.exits);
        const exits = this.room.exits.filter(exit => exit[1] == angle);
        if (exits.length > 0) {
          let [xy, rot, room] = exits[0];
          xy = this.room.global_pos(xy);
          this.moveTo(xy[0] * T, xy[1] * T);
          this.room = room;
          console.log(room);
        }
      }
    });
  }

  moveTo(x, y) {
    var toX = Math.floor(x / T);
    var toY = Math.floor(y / T);
    var fromX = Math.floor(this.player.isoX / T);
    var fromY = Math.floor(this.player.isoY / T);

    this.finder.findPath(fromX, fromY, toX, toY, path => {
      if (path === null) {
        console.warn("Path was not found.");
      } else {
        this.moveCharacter(path);
      }
    });
    this.finder.calculate(); // don't fthis, otherwise nothing happens
  }

  lighting() {
    this.tiles.map(tile => {
      const px = this.player.isoX;
      const py = this.player.isoY;
      const tx = tile.isoX;
      const ty = tile.isoY;
      const d = Math.hypot(tx - px, ty - py);
      const dmin = 30;
      const dmax = 400;
      const u = Math.max(0, Math.min(1, (d - dmin) / (dmax - dmin)));
      const b = (255 * (1 - u)) & 0xff;
      tile.tint = (b << 16) | (b << 8) | b;
    });
  }

  moveCharacter(path) {
    // Sets up a list of tweens, one for each tile to walk,
    // that will be chained by the timeline
    const tweens = [];
    const start = dir => () => this.player.play(dir, true);
    for (var i = 1; i < path.length; i++) {
      const ex = path[i].x;
      const ey = path[i].y;
      const dx = ex - path[i - 1].x;
      const dy = ey - path[i - 1].y;
      var dir = "";
      if (dx < 0) {
        dir = "left";
      } else if (dx > 0) {
        dir = "right";
      } else if (dy < 0) {
        dir = "up";
      } else if (dy > 0) {
        dir = "down";
      }
      tweens.push({
        targets: this.player,
        isoX: { value: ex * T, duration: 200 },
        isoY: { value: ey * T, duration: 200 },
        onStart: start(dir),
        onUpdate: () => this.lighting()
      });
    }

    this.tweens.timeline({
      tweens: tweens,
      onComplete: () => this.player.anims.stop()
    });
  }
}
