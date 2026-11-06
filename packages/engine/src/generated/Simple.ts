import type { Span } from "./Span";

export type Simple =
  | { kind: "ident"; name: string; span: Span }
  | { kind: "int"; value: number; span: Span }
  | { kind: "bool"; value: boolean; span: Span };
