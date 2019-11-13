/** @typedef {import('phaser')} Phaser */
import settings from "./settings.js";
import Dungeon from "./dungeon-generator/generators/dungeon.js";
import EasyStar from "./easystar/easystar.js";

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
    this.load.image("tileset", "assets/gridtiles.png");
    this.load.image("phaserguy", "assets/phaserguy.png");
  }

  create() {
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
          max_exits: 2
        }
      },
      max_corridor_length: 20,
      min_corridor_length: 5,
      corridor_density: 0.0, //corridors per room
      symmetric_rooms: false, // exits must be in the center of a wall if true
      interconnects: 0, //extra corridors to connect rooms and make circular paths. not 100% guaranteed
      max_interconnect_length: 10,
      room_count: 30
    });
    this.dungeon.generate();
    let [ix, iy] = this.dungeon.start_pos;

    this.room = this.dungeon.initial_room;

    var phaserGuy = this.add.image(32, 32, "phaserguy");
    phaserGuy.setDepth(1);
    phaserGuy.setOrigin(0, 0.5);
    this.player = phaserGuy;
    this.player.x = ix * 32;
    this.player.y = iy * 32;

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
    this.map = this.make.tilemap({
      data: grid,
      tileWidth: 32,
      tileHeight: 32
    });
    const tiles = this.map.addTilesetImage("tileset");
    const layer = this.map.createStaticLayer(0, tiles, 0, 0);

    this.finder = new EasyStar.js();
    this.finder.setGrid(grid);
    this.finder.setAcceptableTiles([28]);
    this.finder.enableDiagonals();
    this.finder.disableCornerCutting();

    this.scoreDisplay = this.add.text(20, 20, "0", { fontSize: 20 });

    // control sound
    if (settings.sound) {
    }

    // move on mouse click
    this.input.on("pointerup", pointer =>
      this.moveTo(
        this.cameras.main.scrollX + pointer.x,
        this.cameras.main.scrollY + pointer.y
      )
    );

    // configure the camera
    this.cameras.main.setSize(20 * 32, 20 * 32);
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
        const exits = this.room.exits.filter(exit => exit[1] == angle);
        if (exits.length > 0) {
          let [xy, rot, room] = exits[0];
          xy = this.room.global_pos(xy);
          this.moveTo(xy[0] * 32, xy[1] * 32);
          this.room = room;
          console.log(room);
        }
      }
    });
  }

  moveTo(x, y) {
    var toX = Math.floor(x / 32);
    var toY = Math.floor(y / 32);
    var fromX = Math.floor(this.player.x / 32);
    var fromY = Math.floor(this.player.y / 32);

    this.finder.findPath(fromX, fromY, toX, toY, path => {
      if (path === null) {
        console.warn("Path was not found.");
      } else {
        this.moveCharacter(path);
      }
    });
    this.finder.calculate(); // don't fthis, otherwise nothing happens
  }

  moveCharacter(path) {
    // Sets up a list of tweens, one for each tile to walk, that will be chained by the timeline
    var tweens = [];
    for (var i = 0; i < path.length - 1; i++) {
      var ex = path[i + 1].x;
      var ey = path[i + 1].y;
      tweens.push({
        targets: this.player,
        x: { value: ex * this.map.tileWidth, duration: 200 },
        y: { value: ey * this.map.tileHeight, duration: 200 }
      });
    }

    this.tweens.timeline({
      tweens: tweens
    });
  }
}
