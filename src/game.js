/** @typedef {import('phaser')} Phaser */
import settings from "./settings.js";
import Dungeon from "./dungeon-generator/generators/dungeon.js";
import EasyStar from "./easystar/easystar.js";
import IsoPlugin from "./phaser3-plugin-isometric/IsoPlugin.js";

const TileSize = 38; // tile width and height

export class GameScene extends Phaser.Scene {
  constructor() {
    super({
      key: "GameScene",
      mapAdd: { isoPlugin: "iso" }
    });
    this.canvas = document.querySelector("canvas");
    this.score = 0;
    this.exitIndex = 0;
    this.doorSelection = null;
    this.associatedExit = null;
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
    this.load.image("door", "assets/door.png");
    this.load.atlas("hero", "assets/Knight.png", "assets/Knight.json");
  }

  create() {
    this.isoGroup = this.add.group();
    // @ts-ignore
    this.iso.projector.origin.setTo(0.5, 0.3);

    this.dungeon = new Dungeon({
      size: [100, 100],
      seed: "abcd", //omit for generated seed
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
          x * TileSize,
          y * TileSize,
          0,
          "tileset",
          this.isoGroup
        );
        this.tiles.push(tile);
      }
    }

    // @ts-ignore
    var phaserGuy = this.add.isoSprite(
      ix * TileSize,
      iy * TileSize,
      TileSize,
      "hero",
      this.isoGroup,
      null
    );

    for (var direction of ["x+1", "x-1", "y+1", "y-1"]) {
      this.anims.create({
        key: direction,
        frames: this.anims.generateFrameNames("hero", {
          prefix: direction + "_",
          end: 29,
          zeroPad: 2
        }),
        frameRate: 60,
        repeat: -1
      });
    }
    this.player = phaserGuy;
    // this.player.scale = 0.4;
    this.lighting();

    this.finder = new EasyStar.js();
    this.finder.setGrid(grid);
    this.finder.setAcceptableTiles([28]);

    this.scoreDisplay = this.add.text(20, 20, "0", { fontSize: 20 });

    // control sound
    if (settings.sound) {
    }

    // configure the camera
    this.cameras.main.setSize(20 * TileSize, 20 * TileSize);
    this.cameras.main.startFollow(this.player);

    // respond to switch input
    this.input.keyboard.on("keydown", e => {
      if (e.key == "Enter" || e.key == "ArrowRight") {
        this.makeChoice();
      } else if (e.keyCode == 32 || e.key == "ArrowLeft") {
        this.selectNext();
      }
    });

    // respond to eye gaze user button click
    document
      .getElementById("left")
      .addEventListener("click", e => this.selectNext());
    document
      .getElementById("right")
      .addEventListener("click", e => this.makeChoice());
  }

  moveTo(x, y) {
    var toX = Math.floor(x / TileSize);
    var toY = Math.floor(y / TileSize);
    var fromX = Math.floor(this.player.isoX / TileSize);
    var fromY = Math.floor(this.player.isoY / TileSize);

    this.finder.findPath(fromX, fromY, toX, toY, path => {
      if (path === null) {
        console.log(fromX + " " + fromY + " " + toX + " " + toY);
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
        dir = "x-1";
      } else if (dx > 0) {
        dir = "x+1";
      } else if (dy > 0) {
        dir = "y+1";
      } else if (dy < 0) {
        dir = "y-1";
      }
      tweens.push({
        targets: this.player,
        isoX: { value: ex * TileSize, duration: 200 },
        isoY: { value: ey * TileSize, duration: 200 },
        onStart: start(dir),
        onUpdate: () => this.lighting()
      });
    }

    this.tweens.timeline({
      tweens: tweens,
      onComplete: () => this.player.anims.stop()
    });
  }

  makeChoice() {
    if (this.doorSelection != null) {
      this.doorSelection.destroy();
    }
    console.log("choice made");
    this.exitIndex = 0;
    let [xy, rot, room] = this.associatedExit;
    xy = this.room.global_pos(xy);
    let x = xy[0];
    let y = xy[1];
    switch (rot) {
      case 0:
        y = y - 1;
        break;
      case 90:
        x = x - 1;
        break;
      case 180:
        y = y + 1;
        break;
      case 270:
        x = x + 1;
        break;
    }
    this.moveTo(x * TileSize, y * TileSize);
    this.room = room;
    console.log(room);
  }

  selectNext() {
    if (this.doorSelection != null) {
      this.doorSelection.destroy();
    }
    console.log("next choice");

    this.exitIndex++;

    let [xy, rot, room] = this.room.exits[
      this.exitIndex % this.room.exits.length
    ];

    this.associatedExit = [xy, rot, room];

    xy = this.room.global_pos(xy);

    this.doorSelection = this.add.isoSprite(
      xy[0] * TileSize,
      xy[1] * TileSize,
      0,
      "door"
    );
    this.doorSelection.setInteractive();
  }
}
