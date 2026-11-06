import type { ElseBranch } from "./ElseBranch";
import type { Expr } from "./Expr";
import type { Ident } from "./Ident";
import type { Simple } from "./Simple";
import type { Stmt } from "./Stmt";

export type StmtKind =
  | { kind: "step"; count: Simple }
  | { kind: "turn"; quarters: Simple }
  | { kind: "mine" }
  | { kind: "print"; value: Simple }
  | { kind: "set"; name: Ident; value: Expr }
  | { kind: "if"; cond: Simple; thenBody: Array<Stmt>; elseBranch: ElseBranch | null }
  | { kind: "while"; cond: Simple; body: Array<Stmt> };
