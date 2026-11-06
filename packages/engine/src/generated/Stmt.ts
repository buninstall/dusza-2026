import type { Span } from "./Span";
import type { StmtKind } from "./StmtKind";

export type Stmt = { line: number; span: Span; kind: StmtKind };
