/** @typedef {import('phaser')} Phaser */
import settings from "./settings.js";
import Dungeon from "./dungeon-generator/generators/dungeon.js";
import EasyStar from "./easystar/easystar.js";
import IsoPlugin from "./phaser3-plugin-isometric/IsoPlugin.js";
import EnhancedIsoSprite from "./EnhancedIsoSprite.js";
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
          max_exits: 3
        }
      },
      max_corridor_length: 0,
      min_corridor_length: 0,
      corridor_density: 0.0, //corridors per room
      symmetric_rooms: false, // exits must be in the center of a wall if true
      interconnects: 0, //extra corridors to connect rooms and make circular paths. not 100% guaranteed
      max_interconnect_length: 10,
      room_count: 40
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
      // monkey patch the room to have our objects list
      room.isoObjects = [];
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
      for (let i = 0; i < nobjects; i++) {
        if (!positions.length) {
          break;
        }
        /// remove the position of the player
        let o = objects.pop();
        let [ox, oy] = positions.pop();
        // console.log("o", o, ox, oy);
        // @ts-ignore
        /*
        let isoObj = this.add.isoSprite(
          ox * TileSize,
          oy * TileSize,
          0, // heights[o] - TileSize,
          o
        );
        */

        let isoObj = new EnhancedIsoSprite({
          scene: this,
          x: ox * TileSize,
          y: oy * TileSize,
          z: 0,
          texture: o,
          frame: 0,
          description: o,
          reward: 1,
          room: room
        });
        this.finder.setAdditionalPointCost(ox, oy, 20);
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

    // respond to switch input
    this.input.keyboard.on("keydown", e => {
      if (e.key == "Enter" || e.key == "ArrowLeft") {
        this.makeChoice();
      } else if (e.key == " " || e.key == "ArrowRight") {
        this.selectNext();
      } else if (e.key == "a") {
        this.autoPlay();
      }
    });

    // respond to eye gaze user button click
    document
      .getElementById("left")
      .addEventListener("click", async (e) => await this.makeChoice());
    document
      .getElementById("right")
      .addEventListener("click", e => this.selectNext());

    document.getElementById("information_box").innerHTML = this.room.getDescription();
  }

  pathTo(x, y) {
    return new Promise((resolve, reject) => {
      var toX = Math.floor(x / TileSize);
      var toY = Math.floor(y / TileSize);
      var fromX = Math.floor(this.player.isoX / TileSize);
      var fromY = Math.floor(this.player.isoY / TileSize);
      // console.log(this.currentObject);
      this.finder.findPath(fromX, fromY, toX, toY, path => {
        resolve(path || []);
      });
      this.finder.calculate();
    });
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

  moveCharacter(path) {
    // Sets up a list of tweens, one for each tile to walk,
    // that will be chained by the timeline
    return new Promise((resolve, reject) => {
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
          targets: [this.player, this.selectionIndicator],
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
          if (this.selectionIndicator.audio != null) {
            let music = this.sound.add(this.selectionIndicator.audio);
            music.play();
          }
          this.player.anims.stop();
          resolve();
          document.getElementById("information_box").innerHTML = this.room.getDescription();
        }
      });
    });
  }

  async autoPlay() {
    // const roomsToVisit = [this.room];
    // const roomsVisited = [];
    // while (roomsToVisit.length) {
    //   this.room = roomsToVisit.pop();
    //   roomsVisited.push(this.room);
    //   const targets = this.getTargets();
    //   for (const target of targets) {
    //     if ("exit" in target) {
    //       const [xy, rot, room] = target.exit;
    //       if (roomsVisited.indexOf(room) >= 0) {
    //         continue;
    //       } else {
    //         roomsToVisit.push(room);
    //         continue;
    //       }
    //     }
    //     this.clickButton(document.getElementById('left'));
    //     await this.visitChoice(target);
    //   }
    // }
    while (this.room.isoObjects.length > 0) {
      document.getElementById('right').click();
      this.time.delayedCall(300, () => document.getElementById('left').click());
    }
    this.room = this.room.children.sort((a,b) => a.isoObjects > b.isoObjects)[0];
    if(this.room.isoObjects.length == 0){
      return;
    } else {
      this.autoPlay();
    }
  }

  clickButton(button) {
    console.log("here");
    button.style.backgroundColor = "#99badd";
    this.time.delayedCall(300, () => button.style.backgroundColor = "#FFFFFF");
  }

  async makeChoice() {
    this.clickButton(document.getElementById('left'));
    if (this.target) {
      this.targetIndex = -1;
      this.selectionIndicator.visible = false;
      this.room.isoObjects = this.room.isoObjects.filter(room => this.selectionIndicator !== room);
      await this.visitChoice(this.target);
      this.target = null;
      document.getElementById("information_box").innerHTML = this.room.getDescription();
    }
  }

  async visitChoice(target) {
    if ("exit" in target) {
      let [xy, rot, room] = target.exit;

      xy = this.room.global_pos(xy);
      let [sx, sy] = [[0, 1], [-1, 0], [0, -1], [1, 0]][rot / 90];
      let x = xy[0] + sx;
      let y = xy[1] + sy;
      // get the path to the door
      let path = await this.pathTo(x * TileSize, y * TileSize);
      // move there
      await this.moveCharacter(path);
      // it is now the current room
      this.room = room;
    } else {
      // allow the object to provide the destination
      let { x, y, z } = target.object.position();
      // get the path there
      let path = await this.pathTo(x, y);
      // allow the object to edit the path
      path = target.object.path(path);
      // go there
      await this.moveCharacter(path);
      // interact with the object
      target.object.interact(this.player, this.room);
      // this should be in interact because we might not want to remove it
      this.room.isoObjects = this.room.isoObjects.filter(
        o => o !== target.object
      );
      this.score++;
    }
  }

  getTargets() {
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
    return targets;
  }

  selectNext() {
    this.clickButton(document.getElementById('right'));
    const targets = this.getTargets();
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
