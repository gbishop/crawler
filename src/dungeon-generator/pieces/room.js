import Piece from "./piece.js";
import { iter_range, array_test } from "../utils/index.js";

export default class Room extends Piece {
  constructor(options) {
    /*
        note, size to be provided is size without walls.
        */
    options.room_size = options.size;
    options.size = [options.size[0] + 2, options.size[1] + 2];
    options.objects = ["path/to/object", "path/to/other/object"];
    options = Object.assign(
      {},
      {
        symmetric: false //if true,
      },
      options
    );

    super(options);
    
    this.objects = this.getRandomList(options.max_object_count*options.room_size/(options.size[1]+1), options.objects);

    this.walls.set_square([1, 1], this.room_size, false, true);

    if (!this.symmetric) {
      //any point at any wall can be exit
      this.add_perimeter([1, 0], [this.size[0] - 2, 0], 180);
      this.add_perimeter([0, 1], [0, this.size[1] - 2], 90);
      this.add_perimeter(
        [1, this.size[1] - 1],
        [this.size[0] - 2, this.size[1] - 1],
        0
      );
      this.add_perimeter(
        [this.size[0] - 1, 1],
        [this.size[0] - 1, this.size[1] - 2],
        270
      );
    } else {
      //only middle of each wall can be exit
      let [w, h] = this.get_center_pos();

      this.perimeter = [
        [[w, 0], 180],
        [[this.size[0] - 1, h], 270],
        [[w, this.size[1] - 1], 0],
        [[0, h], 90]
      ];
    }
  }

getRandomList(size, arr){
  let l = [];
  while(size > 0){
    let item = arr[Math.random()*arr.length];
    arr.remove(item);
    l.push(item);
    size--;
  }
  return l;
}
}
