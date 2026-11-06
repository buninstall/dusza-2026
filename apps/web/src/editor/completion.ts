import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
  snippetCompletion,
} from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";
import type { CompletionKind, Engine } from "@minescript/engine";

const completionType: Record<CompletionKind, string> = {
  keyword: "keyword",
  snippet: "keyword",
  variable: "variable",
  value: "constant",
};

export function completionSource(engine: Engine) {
  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/[A-Za-z]*/);
    if (!word || (word.from === word.to && !context.explicit)) {
      return null;
    }
    const items = engine.complete(context.state.doc.toString(), context.pos);
    if (items.length === 0) {
      return null;
    }
    const options: Completion[] = items.map((item) =>
      snippetCompletion(item.insertText, {
        label: item.label,
        detail: item.detail,
        info: item.documentation,
        type: completionType[item.kind],
      }),
    );
    return { from: word.from, options };
  };
}

export function mineScriptCompletion(engine: Engine): Extension {
  return autocompletion({ override: [completionSource(engine)], icons: false });
}
