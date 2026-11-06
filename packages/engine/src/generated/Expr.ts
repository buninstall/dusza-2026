import type { BinOp } from "./BinOp";
import type { Simple } from "./Simple";

export type Expr =
  | { kind: "simple"; value: Simple }
  | { kind: "isThere"; arg: Simple }
  | { kind: "binary"; op: BinOp; lhs: Simple; rhs: Simple }
  | { kind: "not"; operand: Simple };
