import { FIELD } from "../../editor/insertion.ts";
import type { DrawerId } from "../play-ui-store.ts";

export type BlockId =
  | "step"
  | "turnLeft"
  | "turnRight"
  | "turnBack"
  | "mine"
  | "senseGold"
  | "senseWall"
  | "senseEmpty"
  | "newVar"
  | "increment"
  | "negate"
  | "print"
  | "ifGold"
  | "ifElse"
  | "toWall"
  | "repeatFour";

export type Block = { id: BlockId; drawer: DrawerId; lines: readonly string[] };

export const BLOCKS: readonly Block[] = [
  { id: "step", drawer: "robot", lines: ["step forward ‹1›"] },
  { id: "turnLeft", drawer: "robot", lines: ["turn by 1"] },
  { id: "turnRight", drawer: "robot", lines: ["turn by 3"] },
  { id: "turnBack", drawer: "robot", lines: ["turn by 2"] },
  { id: "mine", drawer: "robot", lines: ["mine here"] },
  { id: "senseGold", drawer: "sense", lines: ["set arany to isThere 2"] },
  { id: "senseWall", drawer: "sense", lines: ["set fal to isThere 1"] },
  { id: "senseEmpty", drawer: "sense", lines: ["set ures to isThere 0"] },
  { id: "newVar", drawer: "variables", lines: ["set ‹szamlalo› to ‹0›"] },
  { id: "increment", drawer: "variables", lines: ["set szamlalo to szamlalo + 1"] },
  { id: "negate", drawer: "variables", lines: ["set megy to not fal"] },
  { id: "print", drawer: "variables", lines: ["print ‹szamlalo›"] },
  {
    id: "ifGold",
    drawer: "decision",
    lines: ["set arany to isThere 2", "if arany", "    step forward 1", "    mine here"],
  },
  {
    id: "ifElse",
    drawer: "decision",
    lines: ["if ‹arany›", "    step forward 1", "else", "    turn by 1"],
  },
  {
    id: "toWall",
    drawer: "loop",
    lines: [
      "set fal to isThere 1",
      "set megy to not fal",
      "while megy",
      "    step forward 1",
      "    set fal to isThere 1",
      "    set megy to not fal",
    ],
  },
  {
    id: "repeatFour",
    drawer: "loop",
    lines: [
      "set kor to 0",
      "set tovabb to kor < 4",
      "while tovabb",
      "    step forward 1",
      "    set kor to kor + 1",
      "    set tovabb to kor < 4",
    ],
  },
];

export const GUARD_BLOCK: Block = {
  id: "senseWall",
  drawer: "sense",
  lines: ["set fal to isThere 1"],
};

export function blocksIn(drawer: DrawerId): Block[] {
  return BLOCKS.filter((block) => block.drawer === drawer);
}

export function plainLines(block: Block): string[] {
  return block.lines.map((line) => line.replace(FIELD, "$1"));
}
