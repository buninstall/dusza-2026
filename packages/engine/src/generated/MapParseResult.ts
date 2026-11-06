import type { Diagnostic } from "./Diagnostic";
import type { MineMap } from "./MineMap";

export type MapParseResult = { map: MineMap | null; diagnostics: Array<Diagnostic> };
