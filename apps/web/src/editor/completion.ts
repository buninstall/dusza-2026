import {
  acceptCompletion,
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
  closeCompletion,
  moveCompletionSelection,
  snippetCompletion,
  startCompletion,
} from "@codemirror/autocomplete";
import { type Extension, Prec } from "@codemirror/state";
import { keymap } from "@codemirror/view";
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
    const isTypedOut = items.every((item) => item.label === word.text);
    if (items.length === 0 || (isTypedOut && !context.explicit)) {
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

const completionKeys = Prec.highest(
  keymap.of([
    { key: "Ctrl-Space", run: startCompletion },
    { key: "Escape", run: closeCompletion },
    { key: "ArrowDown", run: moveCompletionSelection(true) },
    { key: "ArrowUp", run: moveCompletionSelection(false) },
    { key: "PageDown", run: moveCompletionSelection(true, "page") },
    { key: "PageUp", run: moveCompletionSelection(false, "page") },
    { key: "Tab", run: acceptCompletion },
  ]),
);

export function mineScriptCompletion(engine: Engine): Extension {
  return [
    autocompletion({ override: [completionSource(engine)], icons: false, defaultKeymap: false }),
    completionKeys,
  ];
}
