import type { Span } from "./Span";
import type { TokenKind } from "./TokenKind";

export type Token = { kind: TokenKind; text: string; span: Span };
