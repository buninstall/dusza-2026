import { HighlightStyle, StreamLanguage, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { tags } from "@lezer/highlight";

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9]*/;
const NUMBER = /^[0-9]+/;
const OPERATOR = /^(<>|<=|>=|[+\-*=<>])/;
const BOOLEANS = new Set(["true", "false"]);

export function mineScriptLanguage(keywords: readonly string[]): StreamLanguage<null> {
  const keywordSet = new Set(keywords);
  return StreamLanguage.define<null>({
    name: "minescript",
    startState: () => null,
    token(stream) {
      if (stream.eatSpace()) {
        return null;
      }
      const word = stream.match(IDENTIFIER);
      if (word && typeof word !== "boolean") {
        const text = word[0];
        if (BOOLEANS.has(text)) {
          return "atom";
        }
        return keywordSet.has(text) ? "keyword" : "variableName";
      }
      if (stream.match(NUMBER)) {
        return "number";
      }
      if (stream.match(OPERATOR)) {
        return "operator";
      }
      stream.next();
      return "invalid";
    },
  });
}

const highlight = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--ink)", fontWeight: "700" },
  { tag: tags.atom, color: "var(--signal)", fontWeight: "600" },
  { tag: tags.number, color: "var(--ore-deep)", fontWeight: "600" },
  { tag: tags.operator, color: "var(--rust)" },
  { tag: tags.variableName, color: "var(--moss)" },
  { tag: tags.invalid, color: "var(--rust)", textDecoration: "underline wavy" },
]);

export function mineScriptHighlighting(): Extension {
  return syntaxHighlighting(highlight);
}
