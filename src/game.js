/** @typedef {import('phaser')} Phaser */
import settings from "./settings.js";
import Dungeon from "./dungeon-generator/generators/dungeon.js";
import EasyStar from "./easystar/easystar.js";
import IsoPlugin from "./phaser3-plugin-isometric/IsoPlugin.js";

const TileSize = 32; // tile width and height

export class GameScene extends Phaser.Scene {
  constructor() {
    super({
      key: "GameScene",
      mapAdd: { isoPlugin: "iso" }
    });
    this.canvas = document.querySelector("canvas");
    this.score = 0;
    this.targetIndex = -1;

    this.selectionIndicator = null;

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

    this.load.image("ground", "assets/ground.png");
    this.load.image("door", "assets/door.png");
    this.load.atlas("hero", "assets/Knight.png", "assets/Knight.json");
    this.load.image("Chest1_closed", "assets/Chest1_closed.png");
    this.load.image("Chest2_opened", "assets/Chest2_opened.png");
    this.load.image("fountain", "assets/fountain.png");
    this.load.image("Rock_1", "assets/Rock_1.png");
    this.load.image("Rock_2", "assets/Rock_2.png");
    this.load.image("over_grass_flower1", "assets/over_grass_flower1.png");

    this.RandomlyPlacedObjects = [
      "Chest1_closed",
      "Chest2_opened",
      "fountain",
      "Rock_1",
      "Rock_2",
      "over_grass_flower1"
    ];
  }

  create() {
    this.isoGroup = this.add.group();
    // @ts-ignore
    // isometric projection
    this.iso.projector.projectionAngle = Math.PI / 6; // 30 degrees

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
    this.dungeon.children.forEach(room => {
      // console.log(room);
      // console.log(room.position);
      // console.log(room.size);
      room.objects = Phaser.Math.RND.shuffle(this.RandomlyPlacedObjects).slice(
        0,
        Phaser.Math.RND.between(0, 3)
      );
      // console.log(room.objects);
      let heights = {
        Chest1_closed: 50,
        Chest2_opened: 50,
        fountain: 55,
        over_grass_flower1: 40,
        Rock_1: 40,
        Rock_2: 40
      };
      let positions = this.generateObjectPositions(room);
      positions = positions.filter(p => p != [ix, iy]);
      /// remove the position of the player
      room.isoObjects = [];
      room.objects.forEach(o => {
        let positionOfObject = this.getRandomPositionAndRemoveItFromPositions(
          positions
        );
        // @ts-ignore
        let isoObj = this.add.isoSprite(
          positionOfObject[0] * TileSize,
          positionOfObject[1] * TileSize,
          heights[o] - 32,
          o
        );
        room.isoObjects.push(isoObj);
      });
    });

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (grid[y][x] === 0) continue;
        // @ts-ignore
        let tile = this.add.isoSprite(
          x * TileSize,
          y * TileSize,
          0,
          "ground",
          this.isoGroup
        );
        // 493 is width of the image
        // There are 12 empty pixels on either side (2*12 = 24)
        // The isometric projection is sqrt(3) tiles the edge width
        tile.scale = (TileSize * Math.sqrt(3)) / (493 - 24);
        this.tiles.push(tile);
      }
    }

    // @ts-ignore
    var hero = this.add.isoSprite(
      ix * TileSize,
      iy * TileSize,
      TileSize / Math.sqrt(2),
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
    this.player = hero;
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
      if (e.key == "Enter" || e.key == "ArrowLeft") {
        this.makeChoice();
      } else if (e.key == "Space" || e.key == "ArrowRight") {
        this.selectNext();
      }
    });

    // respond to eye gaze user button click
    document
      .getElementById("left")
      .addEventListener("click", e => this.makeChoice());
    document
      .getElementById("right")
      .addEventListener("click", e => this.selectNext());
  }

  moveTo(x, y, callback) {
    var toX = Math.floor(x / TileSize);
    var toY = Math.floor(y / TileSize);
    var fromX = Math.floor(this.player.isoX / TileSize);
    var fromY = Math.floor(this.player.isoY / TileSize);
    this.room.isoObjects
      .filter(p => p != this.currentObject)
      .forEach(p => {
        this.finder.setAdditionalPointCost(
          p.isoX / TileSize,
          p.isoY / TileSize,
          2
        );
      });
    // console.log(this.currentObject);
    this.finder.findPath(fromX, fromY, toX, toY, path => {
      if (path === null) {
        console.log(fromX + " " + fromY + " " + toX + " " + toY);
        console.warn("Path was not found.");
      } else {
        this.moveCharacter(path, callback);
      }
    });
    this.finder.calculate(); // don't fthis, otherwise nothing happens
  }

  lighting() {
    return;
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

  moveCharacter(path, callback) {
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
    // console.log(this.dungeon.rooms);
    // console.log(this.dungeon.room_tags);
    this.tweens.timeline({
      tweens: tweens,
      onComplete: () => {
        this.player.anims.stop();
        if (callback) {
          callback();
        }
      }
    });
  }

  makeChoice() {
    console.log("make choice");
    if (this.selectionIndicator) {
      this.selectionIndicator.destroy();
    }
    if (this.target) {
      if ("exit" in this.target) {
        console.log("door selected");
        let [xy, rot, room] = this.target.exit;

        console.log("door", xy[0], xy[1], rot);
        xy = this.room.global_pos(xy);
        let step = { 0: [0, 1], 90: [-1, 0], 180: [0, -1], 270: [1, 0] }[rot];
        let x = xy[0] + step[0];
        let y = xy[1] + step[1];
        console.log("gp", x, y);
        this.moveTo(x * TileSize, y * TileSize, () => {
          this.room = room;
          this.targetIndex = -1;
          this.target = null;
        });
      } else {
        console.log("object selected", this.target.object);
        let pos = [this.target.object.isoX, this.target.object.isoY];
        pos = this.room.global_pos(pos);
        this.moveTo(pos[0], pos[1], () => (this.target.object.visible = false));
        this.score++;
      }
    }
  }

  selectNext() {
    // get the visible objects in the room
    const targets = [];
    this.room.isoObjects
      .filter(object => object.visible)
      .forEach(object => targets.push({ object }));
    this.room.exits.forEach(exit => {
      let [xy, rot, room] = exit;
      xy = this.room.global_pos(xy);
      console.log("exit", xy);
      const tiles = this.tiles.filter(
        t => t.isoX / TileSize == xy[0] && t.isoY / TileSize == xy[1]
      );
      if (tiles.length) {
        targets.push({ object: tiles[0], exit });
      }
    });
    console.log("targets", targets);
    // choose one based on the index
    this.targetIndex += 1;
    this.target = targets[this.targetIndex % targets.length];
    if (this.selectionIndicator) {
      this.selectionIndicator.destroy();
    }
    // @ts-ignore
    this.selectionIndicator = this.add.isoSprite(
      this.target.object.isoX,
      this.target.object.isoY,
      TileSize / 2,
      "door"
    );
    this.selectionIndicator.alpha = 0.8;
  }

  generateObjectPositions(room) {
    // positions is an array of [x,y] as viable locations
    // to place an object
    // console.log(room);
    let positions = [];
    let x = room.position[0] - 1;
    let y = room.position[1] - 1;
    // the i = 2 here is necessary to prevent the exit columns/rows
    // from being valid positions
    for (let i = 2; i < room.size[0]; i++) {
      for (let j = 2; j < room.size[1]; j++) {
        positions.push([x + i, y + j]);
      }
    }
    return positions;
  }

  getRandomPositionAndRemoveItFromPositions(positions) {
    let p = positions[Phaser.Math.RND.between(0, positions.length - 1)];
    positions = positions.filter(pos => pos != p);
    return p;
  }
}
