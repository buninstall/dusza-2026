import { describe, expect, test } from "vitest";
import { draftToText, emptyDraft, paint, resizeDraft } from "../src/map/editor-state.ts";

describe("térképszerkesztő állapot", () => {
  test("az üres vázlat érvényes szöveget ad", () => {
    expect(draftToText(emptyDraft(1, 3))).toBe("1 3\n>..\n");
  });

  test("festés és robotáthelyezés", () => {
    let draft = emptyDraft(1, 3);
    draft = paint(draft, { row: 0, col: 2 }, "gold", "east");
    draft = paint(draft, { row: 0, col: 1 }, "robot", "west");
    expect(draftToText(draft)).toBe("1 3\n.<@\n");
  });

  test("a robot felülfestése eltávolítja a robotot", () => {
    const draft = paint(emptyDraft(1, 2), { row: 0, col: 0 }, "wall", "east");
    expect(draft.robot).toBeNull();
    expect(draftToText(draft)).toBe("1 2\n#.\n");
  });

  test("átméretezés 1 és 15 közé szorítva, a kívül eső robot elvész", () => {
    const moved = paint(emptyDraft(3, 3), { row: 2, col: 2 }, "robot", "south");
    const shrunk = resizeDraft(moved, 2, 40);
    expect(shrunk.rows).toBe(2);
    expect(shrunk.cols).toBe(15);
    expect(shrunk.robot).toBeNull();
    expect(resizeDraft(moved, 0, 1).rows).toBe(1);
  });
});
