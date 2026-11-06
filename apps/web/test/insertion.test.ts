import { describe, expect, test } from "vitest";
import { hasFields, indentOf, isHeader, planInsertion } from "../src/editor/insertion.ts";

const STEP = { lines: ["step forward ‹1›"] };
const MINE = { lines: ["mine here"] };
const IF_GOLD = { lines: ["if isThere ‹2›", "    mine here"] };

describe("blokk beszúrása a szerkesztőbe", () => {
  test("segédfüggvények", () => {
    expect(hasFields(STEP)).toBe(true);
    expect(hasFields(MINE)).toBe(false);
    expect(indentOf("   x")).toBe(3);
    expect(isHeader("else")).toBe(true);
    expect(isHeader("    while true")).toBe(true);
    expect(isHeader("  print x")).toBe(false);
  });

  test("üres dokumentumba a mezők helyén kitöltendő részlettel", () => {
    expect(planInsertion("", 0, STEP)).toEqual({
      from: 0,
      to: 0,
      text: "step forward 1",
      firstLine: 1,
      lastLine: 1,
      cursor: 14,
      snippet: { from: 0, to: 0, template: `step forward \${1:1}` },
    });
  });

  test("üres sorba a fejléc alatti behúzással", () => {
    expect(planInsertion("while true\n    \n", 13, MINE)).toEqual({
      from: 11,
      to: 15,
      text: "    mine here",
      firstLine: 2,
      lastLine: 2,
      cursor: 24,
      snippet: null,
    });
  });

  test("a sor elején álló kurzor elé szúr", () => {
    const doc = "step forward 1\nmine here";
    expect(planInsertion(doc, 15, MINE)).toMatchObject({
      from: 15,
      to: 15,
      text: "mine here\n",
      firstLine: 2,
      cursor: 24,
      snippet: null,
    });
    expect(planInsertion(doc, 15, STEP).snippet).toEqual({
      from: 15,
      to: 15,
      template: `step forward \${1:1}\n`,
    });
  });

  test("a sor végén álló kurzor után szúr, fejléc után beljebb", () => {
    expect(planInsertion("if isThere 1", 12, IF_GOLD)).toEqual({
      from: 12,
      to: 12,
      text: "\n    if isThere 2\n        mine here",
      firstLine: 2,
      lastLine: 3,
      cursor: 47,
      snippet: {
        from: 12,
        to: 12,
        template: `\n    if isThere \${1:2}\n        mine here`,
      },
    });
  });

  test("ha a részlet behúzása nem fér el, sima szöveg kerül be", () => {
    const plan = planInsertion("mine here\n        ", 15, IF_GOLD);
    expect(plan.text).toBe("if isThere 2\n    mine here");
    expect(plan.snippet).toBeNull();
  });
});
