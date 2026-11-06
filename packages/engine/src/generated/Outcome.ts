import type { Diagnostic } from "./Diagnostic";
import type { RuntimeErrorCode } from "./RuntimeErrorCode";

export type Outcome =
  | { kind: "ok" }
  | { kind: "runtimeError"; code: RuntimeErrorCode; line: number; message: string }
  | { kind: "syntaxError"; diagnostics: Array<Diagnostic> };
