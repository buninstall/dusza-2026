import { getIndentation } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { describe, expect, test } from "vitest";
import { mineScriptIndent } from "../src/editor/indent.ts";
import { insertSpacesTab } from "../src/editor/keymap.ts";

function indentAfter(doc: string): number | null {
  const state = EditorState.create({ doc: `${doc}\n`, extensions: [mineScriptIndent()] });
  return getIndentation(state, state.doc.length);
}

function indentOfLine(doc: string, line: number): number | null {
  const state = EditorState.create({ doc, extensions: [mineScriptIndent()] });
  return getIndentation(state, state.doc.line(line).from);
}

describe("blokk-behúzás", () => {
  test("if, while és else után egy szinttel beljebb kezd", () => {
    expect(indentAfter("while megy")).toBe(4);
    expect(indentAfter("if van")).toBe(4);
    expect(indentAfter("if van\n    mine here\nelse")).toBe(4);
    expect(indentAfter("while a\n    if b")).toBe(8);
  });

  test("sima utasítás után a szintet tartja", () => {
    expect(indentAfter("step forward 1")).toBe(0);
    expect(indentAfter("while a\n    turn by 1")).toBe(4);
  });

  test("az else a saját if-je szintjére kerül", () => {
    expect(indentOfLine("if a\n    mine here\n    else", 3)).toBe(0);
    expect(indentOfLine("while b\n    if a\n        mine here\n        else", 4)).toBe(4);
  });

  test("a csak olvasható szerkesztőben a Tab nem ír", () => {
    const view = new EditorView({
      state: EditorState.create({
        doc: "step forward 1",
        extensions: [EditorState.readOnly.of(true)],
      }),
    });
    expect(insertSpacesTab(view)).toBe(false);
    expect(view.state.doc.toString()).toBe("step forward 1");
    view.destroy();
  });
});
