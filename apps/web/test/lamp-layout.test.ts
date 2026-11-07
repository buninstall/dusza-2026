import { describe, expect, test } from "vitest";
import {
  allocate,
  fitsLive,
  lanternSpots,
  type Metrics,
  place,
  REACH,
  repaintRect,
  SLACK,
} from "../src/auth/lamp/layout.ts";

const RESTING: Metrics = {
  width: 1280,
  height: 800,
  left: 424,
  top: 86,
  panelWidth: 432,
  panelHeight: 628,
};

describe("lámpás jelenet elrendezése", () => {
  test("a keret a panel bal felső sarkához igazodik egész vászonpixelre", () => {
    const placed = place(RESTING, 3);
    expect(placed.offsetX).toBeGreaterThanOrEqual(-3);
    expect(placed.offsetX).toBeLessThan(0);
    expect(placed.box.x * 3 + placed.offsetX).toBe(RESTING.left);
    expect(placed.box.y * 3 + placed.offsetY).toBe(RESTING.top);
    expect(placed.box.w).toBe(144);
    expect(placed.box.h).toBe(210);
    expect(placed.view.w * 3 + placed.offsetX).toBeGreaterThanOrEqual(RESTING.width);
    expect(placed.view.h * 3 + placed.offsetY).toBeGreaterThanOrEqual(RESTING.height);
  });

  test("a vászon tartalékot kap, hogy a növekvő oldal ne kényszerítsen újraindítást", () => {
    const placed = place(RESTING, 3);
    expect(allocate(placed.view)).toEqual({
      w: placed.view.w + SLACK.x,
      h: placed.view.h + SLACK.y,
    });
  });

  test("hibaüzenettől megnőtt panel és megjelenő görgetősáv mellett a jelenet fut tovább", () => {
    const first = place(RESTING, 3);
    const size = allocate(first.view);
    const grown = place(
      { ...RESTING, width: 1266, height: 814, left: 417, top: 64, panelHeight: 686 },
      3,
    );
    expect(fitsLive(size, first.box, grown)).toBe(true);
  });

  test("ablakméret-váltásnál, ami messze viszi a panelt, a bánya újraépül", () => {
    const first = place(RESTING, 3);
    const size = allocate(first.view);
    const moved = place({ ...RESTING, width: 900, left: 234 }, 3);
    expect(fitsLive(size, first.box, moved)).toBe(false);
    const wider = place({ ...RESTING, width: 1280 + SLACK.x * 3 + 6 }, 3);
    expect(fitsLive(size, first.box, wider)).toBe(false);
    const taller = place(
      { ...RESTING, height: 800 + SLACK.y * 3 + 6, panelHeight: 628 + REACH.y * 6 + 12 },
      3,
    );
    expect(fitsLive(size, first.box, taller)).toBe(false);
  });

  test("az újrafestett sáv lefedi a régi és az új keretet, csempére kerekítve", () => {
    const rect = repaintRect(
      { x: 142, y: 29, w: 144, h: 210 },
      { x: 140, y: 22, w: 144, h: 229 },
      { w: 600, h: 400 },
    );
    expect(rect).toEqual({ x0: 128, y0: 16, x1: 288, y1: 256 });
  });

  test("az újrafestett sáv nem lóg ki a vászonról", () => {
    const rect = repaintRect(
      { x: 2, y: 1, w: 50, h: 40 },
      { x: 0, y: 0, w: 60, h: 80 },
      {
        w: 70,
        h: 72,
      },
    );
    expect(rect).toEqual({ x0: 0, y0: 0, x1: 64, y1: 72 });
  });

  test("a lámpák a kerettel együtt mozognak", () => {
    const box = { x: 100, y: 40, w: 144, h: 210 };
    const moved = { ...box, y: 30 };
    const [left, right] = lanternSpots(moved, false);
    const [restLeft, restRight] = lanternSpots(box, false);
    expect(left?.[1]).toBe((restLeft?.[1] ?? 0) - 10);
    expect(right?.[0]).toBe(restRight?.[0]);
    expect(lanternSpots(box, true).every(([, y]) => y < box.y)).toBe(true);
  });
});
