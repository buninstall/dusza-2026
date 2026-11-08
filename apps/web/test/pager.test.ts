import { describe, expect, test } from "vitest";
import { PAGER_SLOTS, pageItems } from "../src/components/Pager.tsx";

describe("lapozó helyei", () => {
  test("kevés oldalnál minden oldal látszik, kihagyás nélkül", () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(3, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageItems(7, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  test("sok oldalnál minden oldalon ugyanannyi hely van", () => {
    for (const pageCount of [8, 9, 12, 39, 120]) {
      for (let page = 1; page <= pageCount; page += 1) {
        expect(pageItems(page, pageCount)).toHaveLength(PAGER_SLOTS);
      }
    }
  });

  test("az aktuális, az első és az utolsó oldal mindig látszik", () => {
    for (let page = 1; page <= 39; page += 1) {
      const items = pageItems(page, 39);
      expect(items).toContain(page);
      expect(items[0]).toBe(1);
      expect(items.at(-1)).toBe(39);
    }
  });

  test("a kihagyás legalább két oldalt takar", () => {
    for (let page = 1; page <= 39; page += 1) {
      const items = pageItems(page, 39);
      items.forEach((item, index) => {
        if (item !== "gap") {
          return;
        }
        const before = items[index - 1];
        const after = items[index + 1];
        expect(typeof before === "number" && typeof after === "number").toBe(true);
        expect(Number(after) - Number(before)).toBeGreaterThan(2);
      });
    }
  });

  test("az eleje, a közepe és a vége", () => {
    expect(pageItems(1, 39)).toEqual([1, 2, 3, 4, 5, "gap", 39]);
    expect(pageItems(4, 39)).toEqual([1, 2, 3, 4, 5, "gap", 39]);
    expect(pageItems(5, 39)).toEqual([1, "gap", 4, 5, 6, "gap", 39]);
    expect(pageItems(35, 39)).toEqual([1, "gap", 34, 35, 36, "gap", 39]);
    expect(pageItems(36, 39)).toEqual([1, "gap", 35, 36, 37, 38, 39]);
    expect(pageItems(39, 39)).toEqual([1, "gap", 35, 36, 37, 38, 39]);
  });
});
