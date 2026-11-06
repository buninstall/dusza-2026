import { describe, expect, test } from "bun:test";
import { createRandom } from "../src/prng.ts";

describe("seedelhető PRNG", () => {
  test("azonos seed azonos sorozatot ad", () => {
    const first = createRandom(42);
    const second = createRandom(42);
    const a = Array.from({ length: 5 }, () => first.next());
    const b = Array.from({ length: 5 }, () => second.next());
    expect(a).toEqual(b);
  });

  test("különböző seed különböző sorozatot ad", () => {
    expect(createRandom(1).next()).not.toBe(createRandom(2).next());
  });

  test("az int a megadott zárt tartományban marad", () => {
    const random = createRandom(7);
    for (let draw = 0; draw < 500; draw += 1) {
      const value = random.int(0, 3);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(3);
    }
  });
});
