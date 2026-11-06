import type { DiagCode } from "./DiagCode";
import type { Fix } from "./Fix";
import type { Severity } from "./Severity";
import type { Span } from "./Span";

export type Diagnostic = {
  code: DiagCode;
  severity: Severity;
  span: Span;
  message: string;
  help: string | null;
  fixes: Array<Fix>;
};
