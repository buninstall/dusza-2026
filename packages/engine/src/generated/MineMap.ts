import type { Cell } from "./Cell";
import type { Dir } from "./Dir";
import type { Pos } from "./Pos";

export type MineMap = {
  rows: number;
  cols: number;
  cells: Array<Array<Cell>>;
  robot: Pos;
  dir: Dir;
};
