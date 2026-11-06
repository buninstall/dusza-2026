import type { Pos } from "./Pos";

export type MapInfo = { goldTotal: number; reachableGold: number; unreachable: Array<Pos> };
