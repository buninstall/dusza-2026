import type { Diagnostic } from "./Diagnostic";

export type FormatResult = { text: string; changed: boolean; diagnostics: Array<Diagnostic> };
