import { describe, expect, test } from "vitest";
import {
  changedCells,
  draftToText,
  emptyDraft,
  floodCells,
  lineCells,
  modeForKey,
  paint,
  paintCells,
  reachableCells,
  rectCells,
  rotateRobot,
} from "../src/map-editor/editor-state.ts";
import { HISTORY_LIMIT, historyReducer, initialHistory } from "../src/map-editor/history.ts";
import { sortMaps } from "../src/maps/sort.ts";
import { CORRIDOR, LABYRINTH, mapSummary } from "./support/fixtures.ts";

const at = (row: number, col: number) => ({ row, col });

describe("szerkesztő-előzmények", () => {
  test("vonás közbeni előnézet egy lépésként rendeződik, a megszakítás visszaállít", () => {
    const start = emptyDraft(2, 2);
    const first = paint(start, at(0, 1), "wall", "east");
    const second = paint(first, at(1, 1), "wall", "east");
    let history = historyReducer(initialHistory(start), { type: "preview", next: first });
    history = historyReducer(history, { type: "preview", next: second });
    expect(history.pending).toBe(start);
    history = historyReducer(history, { type: "settle" });
    expect(history.past).toEqual([start]);
    expect(history.present).toBe(second);
    expect(historyReducer(history, { type: "settle" })).toBe(history);

    const cancelled = historyReducer(historyReducer(history, { type: "preview", next: start }), {
      type: "cancel",
    });
    expect(cancelled.present).toBe(second);
    expect(historyReducer(cancelled, { type: "cancel" })).toBe(cancelled);

    const unchanged = historyReducer(historyReducer(history, { type: "preview", next: second }), {
      type: "settle",
    });
    expect(unchanged.past).toEqual([start]);
    expect(unchanged.pending).toBeNull();
  });

  test("üres veremnél a visszavonás és az újra nem változtat, a reset tiszta lapot ad", () => {
    const start = emptyDraft(1, 2);
    const history = initialHistory(start);
    expect(historyReducer(history, { type: "undo" })).toBe(history);
    expect(historyReducer(history, { type: "redo" })).toBe(history);
    expect(historyReducer(history, { type: "commit", next: start })).toBe(history);
    const reset = historyReducer(
      historyReducer(history, { type: "commit", next: paint(start, at(0, 1), "gold", "east") }),
      { type: "reset", present: start },
    );
    expect(reset).toEqual(initialHistory(start));
  });

  test("legfeljebb HISTORY_LIMIT lépést őriz meg", () => {
    let history = initialHistory(emptyDraft(1, 2));
    for (let index = 0; index < HISTORY_LIMIT + 5; index += 1) {
      const tool = index % 2 === 0 ? "wall" : "empty";
      history = historyReducer(history, {
        type: "commit",
        next: paint(history.present, at(0, 1), tool, "east"),
      });
    }
    expect(history.past).toHaveLength(HISTORY_LIMIT);
  });
});

describe("festőeszközök geometriája", () => {
  test("téglalap, egyenes, kitöltés és bejárhatóság", () => {
    expect(rectCells(at(1, 2), at(0, 0))).toHaveLength(6);
    const line = lineCells(at(0, 0), at(2, 4));
    expect(line).toHaveLength(5);
    expect([line[0], line[4]]).toEqual([at(0, 0), at(2, 4)]);
    expect(lineCells(at(3, 0), at(0, 0))).toHaveLength(4);
    const walled = paintCells(emptyDraft(3, 3), [at(0, 1), at(1, 1), at(2, 1)], "wall");
    expect(floodCells(walled, at(0, 2))).toHaveLength(3);
    expect(floodCells(walled, at(1, 1))).toHaveLength(3);
    expect(reachableCells(walled).size).toBe(3);
    expect(modeForKey("x")).toBeNull();
    expect(modeForKey("K")).toBe("fill");
  });

  test("forgatás robot nélkül az irányt állítja, a változott cellák listája", () => {
    const start = emptyDraft(2, 2);
    const noRobot = paint(start, at(0, 0), "empty", "east");
    expect(noRobot.robot).toBeNull();
    expect(rotateRobot(noRobot, "right").dir).toBe("south");
    expect(draftToText(rotateRobot(start, "left"))).toContain("^");
    expect(changedCells(start, paint(start, at(1, 1), "gold", "east"))).toEqual([at(1, 1)]);
    expect(changedCells(start, emptyDraft(3, 3))).toEqual([]);
  });
});

describe("pályák rendezése", () => {
  test("sorrend, méret, arany és frissesség szerint", () => {
    const small = { ...mapSummary(1, "Kicsi", CORRIDOR), createdAt: 1, updatedAt: 9 };
    const big = { ...mapSummary(2, "Nagy", LABYRINTH), createdAt: 2, updatedAt: 3 };
    expect(sortMaps([big, small], "order").map((map) => map.id)).toEqual([1, 2]);
    expect(sortMaps([small, big], "size").map((map) => map.id)).toEqual([2, 1]);
    expect(sortMaps([small, big], "gold").map((map) => map.id)).toEqual([1, 2]);
    expect(sortMaps([big, small], "recent").map((map) => map.id)).toEqual([1, 2]);
  });
});
