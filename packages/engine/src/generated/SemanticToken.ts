import type { SemanticTokenKind } from "./SemanticTokenKind";

export type SemanticToken = { from: number; to: number; kind: SemanticTokenKind };
