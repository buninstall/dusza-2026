import type { Span } from "./Span";
import type { Stmt } from "./Stmt";

export type ElseBranch = { line: number; span: Span; body: Array<Stmt> };
