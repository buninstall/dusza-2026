import { HighlightStyle, StreamLanguage, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { tags } from "@lezer/highlight";

export type TokenClass = "keyword" | "atom" | "number" | "operator" | "variableName" | "invalid";

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9]*/;
const NUMBER = /^[0-9]+/;
const OPERATOR = /^(<>|<=|>=|[+\-*=<>])/;
const BOOLEANS = new Set(["true", "false"]);
const SPACE = /^ +/;

export function classifyWord(word: string, keywords: ReadonlySet<string>): TokenClass {
  if (BOOLEANS.has(word)) {
    return "atom";
  }
  return keywords.has(word) ? "keyword" : "variableName";
}

export type LineToken = { text: string; kind: TokenClass | null };

export function tokenizeLine(line: string, keywords: ReadonlySet<string>): LineToken[] {
  const matchers: readonly [RegExp, (text: string) => TokenClass | null][] = [
    [SPACE, () => null],
    [IDENTIFIER, (text) => classifyWord(text, keywords)],
    [NUMBER, () => "number"],
    [OPERATOR, () => "operator"],
  ];
  const tokens: LineToken[] = [];
  let offset = 0;
  while (offset < line.length) {
    const rest = line.slice(offset);
    const hit = matchers
      .map(([pattern, kind]) => ({ match: pattern.exec(rest), kind }))
      .find(({ match }) => match !== null);
    const text = hit?.match?.[0] ?? rest.charAt(0);
    tokens.push({ text, kind: hit ? hit.kind(text) : "invalid" });
    offset += text.length;
  }
  return tokens;
}

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
        return classifyWord(word[0], keywordSet);
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
  { tag: tags.keyword, color: "var(--c-gold)", fontWeight: "700" },
  { tag: tags.atom, color: "var(--c-ok)", fontWeight: "700" },
  { tag: tags.number, color: "var(--c-signal)" },
  { tag: tags.operator, color: "var(--c-rust)", fontWeight: "700" },
  { tag: tags.variableName, color: "var(--c-text)" },
  { tag: tags.invalid, color: "var(--c-rust)", textDecoration: "underline wavy" },
]);

export function mineScriptHighlighting(): Extension {
  return syntaxHighlighting(highlight);
}
