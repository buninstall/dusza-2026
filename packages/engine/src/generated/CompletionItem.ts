import type { CompletionKind } from "./CompletionKind";

export type CompletionItem = {
  label: string;
  kind: CompletionKind;
  detail: string;
  documentation: string;
  insertText: string;
};
