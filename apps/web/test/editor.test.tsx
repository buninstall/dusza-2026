import { CompletionContext } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { Diagnostic } from "@minescript/engine";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AttractScene } from "../src/auth/AttractScene.tsx";
import { DEMO_MAP, DEMO_PROGRAM, DEMO_RUN } from "../src/auth/demo-run.ts";
import { completionSource } from "../src/editor/completion.ts";
import { lineMarks, scrollToLine, setErrorLines, setExecLine } from "../src/editor/exec-line.ts";
import { hoverSource } from "../src/editor/hover.ts";
import { formatDocument, INDENT, insertSpacesTab, mineScriptKeymap } from "../src/editor/keymap.ts";
import { classifyWord, tokenizeLine } from "../src/editor/language.ts";
import { toCodeMirror } from "../src/editor/lint.ts";
import { EngineContext } from "../src/engine/EngineProvider.tsx";
import { useEngine } from "../src/engine/useEngine.ts";
import { realEngine } from "./support/engine.ts";

const views: EditorView[] = [];

function Probe() {
  return <span>{useEngine().version()}</span>;
}

function view(doc: string, cursor = doc.length): EditorView {
  const created = new EditorView({
    state: EditorState.create({ doc, selection: { anchor: cursor }, extensions: [lineMarks()] }),
    parent: document.body,
  });
  views.push(created);
  return created;
}

afterEach(() => {
  for (const created of views.splice(0)) {
    created.destroy();
  }
  vi.restoreAllMocks();
});

describe("szerkesztőbővítmények", () => {
  test("a Tab a következő 4-es tabulátorhelyig szóközt szúr be", () => {
    const editor = view("ab", 2);
    expect(insertSpacesTab(editor)).toBe(true);
    expect(editor.state.doc.toString()).toBe(`ab${" ".repeat(INDENT.length - 2)}`);
  });

  test("a formázás csak változás esetén ír a dokumentumba, csak írható szerkesztőben", () => {
    const editor = view("print  1");
    vi.spyOn(realEngine, "format").mockReturnValueOnce({
      text: "print 1\n",
      changed: true,
      diagnostics: [],
    });
    expect(formatDocument(realEngine, editor).changed).toBe(true);
    expect(editor.state.doc.toString()).toBe("print 1\n");
    expect(mineScriptKeymap(realEngine, () => undefined)).toBeTruthy();
  });

  test("a kiegészítés a motor javaslatait snippetként adja", () => {
    const state = EditorState.create({ doc: "st" });
    const result = completionSource(realEngine)(new CompletionContext(state, 2, false));
    expect(result?.from).toBe(0);
    expect(result?.options.map((option) => option.label)).toContain("step forward");
    const empty = EditorState.create({ doc: "" });
    expect(completionSource(realEngine)(new CompletionContext(empty, 0, false))).toBeNull();
    vi.spyOn(realEngine, "complete").mockReturnValueOnce([]);
    expect(completionSource(realEngine)(new CompletionContext(state, 2, true))).toBeNull();
  });

  test("a kiegészítés eltűnik, ha a szó már teljesen be van gépelve", () => {
    const typed = EditorState.create({ doc: "mine here" });
    expect(completionSource(realEngine)(new CompletionContext(typed, 9, false))).toBeNull();
  });

  test("a súgóbuborék a motor magyar leírását mutatja", () => {
    const editor = view("set x to 1");
    const tooltip = hoverSource(realEngine)(editor, 1);
    expect(tooltip?.pos).toBe(0);
    const dom = tooltip?.create(editor).dom;
    expect(dom?.textContent).toMatch(/változó/);
    vi.spyOn(realEngine, "hover").mockReturnValueOnce(undefined);
    expect(hoverSource(realEngine)(editor, 1)).toBeNull();
  });

  test("a diagnosztika CodeMirror-formára alakul, a javítás alkalmazható", () => {
    const diagnostic: Diagnostic = {
      code: "SYN_DOUBLE_SPACE",
      severity: "error",
      span: { line: 1, colStart: 6, colEnd: 7, from: 5, to: 99 },
      message: "Dupla szóköz.",
      help: "Törölj egyet.",
      fixes: [{ title: "Javítás", edits: [{ from: 5, to: 6, insert: "" }] }],
    };
    const converted = toCodeMirror(diagnostic, 8);
    expect(converted).toMatchObject({
      from: 5,
      to: 8,
      severity: "error",
      message: "Dupla szóköz. Törölj egyet.",
    });
    const editor = view("print  1");
    converted.actions?.[0]?.apply(editor, 0, 0);
    expect(editor.state.doc.toString()).toBe("print 1");
  });

  test("a futó és a hibás sor díszítése, a hiba nyer", () => {
    const editor = view("a\nb\nc");
    editor.dispatch({ effects: [setExecLine.of(2), setErrorLines.of([2, 9])] });
    expect(editor.dom.querySelector(".cm-error-line")?.textContent).toBe("b");
    editor.dispatch({ effects: [setErrorLines.of([]), setExecLine.of(3)] });
    expect(editor.dom.querySelector(".cm-exec-line")?.getAttribute("aria-current")).toBe("step");
    editor.dispatch({ changes: { from: 0, insert: "x" } });
    expect(editor.dom.querySelector(".cm-exec-line")).not.toBeNull();
    expect(() => scrollToLine(editor, 99)).not.toThrow();
    scrollToLine(editor, 1);
  });

  test("statikus tokenizáló a kézikönyvhöz", () => {
    const keywords = new Set(realEngine.keywords());
    expect(classifyWord("true", keywords)).toBe("atom");
    expect(classifyWord("while", keywords)).toBe("keyword");
    expect(classifyWord("arany", keywords)).toBe("variableName");
    expect(tokenizeLine("set x to 1 <> -", keywords).map((token) => token.kind)).toEqual([
      "keyword",
      null,
      "variableName",
      null,
      "keyword",
      null,
      "number",
      null,
      "operator",
      null,
      "operator",
    ]);
    expect(tokenizeLine("ő", keywords)).toEqual([{ text: "ő", kind: "invalid" }]);
  });

  test("useEngine csak a szolgáltató alatt működik", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow(/EngineProvider/);
    render(
      <EngineContext value={realEngine}>
        <Probe />
      </EngineContext>,
    );
    expect(screen.getByText(realEngine.version())).toBeTruthy();
  });
});

describe("bemutató jelenet", () => {
  test("a demó-futás minden sorhoz egy eseményt ad, és körbejár", () => {
    expect(DEMO_RUN.events).toHaveLength(DEMO_PROGRAM.length);
    expect(DEMO_RUN.gold).toBe(3);
    for (const event of DEMO_RUN.events) {
      expect(event.robot.pos.row).toBeLessThan(DEMO_MAP.rows);
      expect(DEMO_MAP.cells[event.robot.pos.row]?.[event.robot.pos.col]).not.toBe("wall");
    }
    vi.useFakeTimers();
    const { container } = render(<AttractScene />);
    expect(container.querySelector("figure")?.getAttribute("aria-hidden")).toBe("true");
    act(() => {
      vi.advanceTimersByTime(720 * 3);
    });
    expect(container.querySelector('[data-current="true"]')?.textContent).toContain("turn by 3");
  });
});
