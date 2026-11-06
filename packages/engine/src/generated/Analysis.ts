import type { Diagnostic } from "./Diagnostic";
import type { FoldRange } from "./FoldRange";
import type { SemanticToken } from "./SemanticToken";
import type { SymbolInfo } from "./SymbolInfo";

export type Analysis = {
  diagnostics: Array<Diagnostic>;
  tokens: Array<SemanticToken>;
  folds: Array<FoldRange>;
  symbols: Array<SymbolInfo>;
};
