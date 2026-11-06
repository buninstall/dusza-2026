import type { Diagnostic } from "./Diagnostic";
import type { Program } from "./Program";

export type ParseResult = { program: Program | null; diagnostics: Array<Diagnostic> };
