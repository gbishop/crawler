/** @typedef {import('phaser')} Phaser */
import settings from "./settings.js";
import Dungeon from "./dungeon-generator/generators/dungeon.js";
import EasyStar from "./easystar/easystar.js";
import IsoPlugin from "./phaser3-plugin-isometric/IsoPlugin.js";
import { sortByDistance } from "./helpers.js";

const TileSize = 38; // tile width and height

export class GameScene extends Phaser.Scene {
  constructor() {
    super({
      key: "GameScene",
      mapAdd: { isoPlugin: "iso" }
    });
    this.canvas = document.querySelector("canvas");
    this.score = 0;
    this.targetIndex = -1;

    // cast this once so I don't have to below
    // shouldn't I be able to just assert this?
    this.sound = /** @type {Phaser.Sound.WebAudioSoundManager} */ (super.sound);
    // debugging hack
    window.scene = this;
  }

  preload() {
    this.load.scenePlugin({
      key: "IsoPlugin",
      url: IsoPlugin,
      sceneKey: "iso"
    });

    this.load.image("ground", "assets/cube.png");
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
    // this.iso.projector.projectionAngle = Math.PI / 6; // 30 degrees

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

    this.finder = new EasyStar.js();
    this.finder.setGrid(grid);
    this.finder.setAcceptableTiles([28]);

    this.tiles = [];
    this.dungeon.children.forEach(room => {
      // console.log(room);
      // console.log(room.position);
      // console.log(room.size);
      let objects = [...Phaser.Math.RND.shuffle(this.RandomlyPlacedObjects)];
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
      positions = positions.filter(([px, py]) => px != ix || py != iy);
      positions = Phaser.Math.RND.shuffle(positions);
      const nobjects = Phaser.Math.RND.between(0, 3);
      room.isoObjects = [];
      for (let i = 0; i < nobjects; i++) {
        if (!positions.length) {
          break;
        }
        /// remove the position of the player
        let o = objects.pop();
        let [ox, oy] = positions.pop();
        // console.log("o", o, ox, oy);
        // @ts-ignore
        let isoObj = this.add.isoSprite(
          ox * TileSize,
          oy * TileSize,
          0, // heights[o] - TileSize,
          o
        );
        this.finder.setAdditionalPointCost(ox, oy, 20);
        room.isoObjects.push(isoObj);
        // eliminate this position and its neighbors
        positions = positions.filter(
          ([px, py]) => Math.hypot(px - ox, py - oy) > 1
        );
      }
    });

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (grid[y][x] === 0) continue;
        // @ts-ignore
        let tile = this.add.isoSprite(
          x * TileSize,
          y * TileSize,
          -TileSize,
          "ground",
          this.isoGroup
        );
        // 493 is width of the image
        // There are 12 empty pixels on either side (2*12 = 24)
        // The isometric projection is sqrt(3) tiles the edge width
        this.tiles.push(tile);
      }
    }

    // @ts-ignore
    var hero = this.add.isoSprite(
      ix * TileSize,
      iy * TileSize,
      0,
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

    // @ts-ignore
    this.selectionIndicator = this.add.isoSprite(
      this.player.isoX,
      this.player.isoY,
      1,
      "door",
      this.isoGroup,
      null
    );
    this.selectionIndicator.alpha = 0.8;
    this.selectionIndicator.visible = false;

    this.scoreDisplay = this.add.text(20, 20, "0", { fontSize: 20 });

    // control sound
    if (settings.sound) {
    }

    // configure the camera
    // I'm making the camera follow the selection box and it follows the
    // player when the player moves. I'm using this hack to keep the selection
    // in view without too much motion. I still think it could be better.
    this.cameras.main.setSize(20 * TileSize, 20 * TileSize);
    this.cameras.main.startFollow(this.selectionIndicator, false, 0.05, 0.05);
    this.cameras.main.setDeadzone(300, 300);

    // make the selection box follow the player
    this.player.on("update", () => {
      this.selectionIndicator.isoX = this.player.isoX;
      this.selectionIndicator.isoY = this.player.isoY;
    });

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
    // console.log(this.currentObject);
    this.finder.findPath(fromX, fromY, toX, toY, path => {
      if (path === null) {
        // console.log(fromX + " " + fromY + " " + toX + " " + toY);
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
    this.selectionIndicator.visible = false;
    if (this.target) {
      this.targetIndex = -1;
      if ("exit" in this.target) {
        // tween the camera back over to the player
        this.tweens.add({
          targets: this.selectionIndicator,
          isoX: this.player.isoX,
          isoY: this.player.isoY,
          duration: 500,
          onComplete: () => {
            let [xy, rot, room] = this.target.exit;

            // console.log("door", xy[0], xy[1], rot);
            xy = this.room.global_pos(xy);
            let step = [[0, 1], [-1, 0], [0, -1], [1, 0]][rot / 90];
            let x = xy[0] + step[0];
            let y = xy[1] + step[1];
            // console.log("gp", x, y);
            this.moveTo(x * TileSize, y * TileSize, () => {
              this.room = room;
              this.target = null;
            });
          }
        });
        // console.log("door selected");
      } else {
        // console.log("object selected", this.target.object);
        let pos = [this.target.object.isoX, this.target.object.isoY];
        pos = this.room.global_pos(pos);
        this.moveTo(pos[0], pos[1], () => (this.target.object.visible = false));
        this.room.isoObjects = this.room.isoObjects.filter(
          o => o !== this.target.object
        );
        this.score++;
      }
    }
  }

  selectNext() {
    // get objects in the room
    let px = this.player.isoX;
    let py = this.player.isoY;
    let targets = this.room.isoObjects.map(object => {
      return { object, x: object.isoX, y: object.isoY };
    });
    sortByDistance(targets, px, py);
    let exits = this.room.exits.map(exit => {
      let [xy, rot, room] = exit;
      const [x, y] = this.room.global_pos(xy);
      // console.log("exit", x, y);
      const tiles = this.tiles.filter(
        t => t.isoX / TileSize == x && t.isoY / TileSize == y
      );
      return {
        object: tiles[0],
        exit,
        x: tiles[0].isoX,
        y: tiles[0].isoY
      };
    });
    sortByDistance(exits, px, py);
    targets = [...targets, ...exits];
    // console.log("targets", targets);
    // choose one based on the index
    this.targetIndex += 1;
    this.target = targets[this.targetIndex % targets.length];
    this.selectionIndicator.visible = true;
    this.selectionIndicator.isoX = this.target.object.isoX;
    this.selectionIndicator.isoY = this.target.object.isoY;
    this.selectionIndicator._project();
  }

  generateObjectPositions(room) {
    // positions is an array of [x,y] as viable locations
    // to place an object
    // console.log(room);
    let positions = [];
    let x = room.position[0] + 1;
    let y = room.position[1] + 1;
    // the i = 2 here is necessary to prevent the exit columns/rows
    // from being valid positions
    for (let i = 1; i < room.room_size[0] - 1; i++) {
      for (let j = 1; j < room.room_size[1] - 1; j++) {
        positions.push([x + i, y + j]);
      }
    }
    return positions;
  }
}
