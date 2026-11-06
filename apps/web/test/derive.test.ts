import { describe, expect, test } from "vitest";
import { deriveFrame, formatValue } from "../src/runner/derive.ts";
import { start, syntheticTrace } from "./fixtures.ts";

describe("deriveFrame", () => {
  test("a 0. index a kiinduló állapot", () => {
    const frame = deriveFrame(syntheticTrace, start, 0);
    expect(frame.atStart).toBe(true);
    expect(frame.robot).toEqual(start);
    expect([...frame.discovered]).toEqual(["0:0"]);
    expect(frame.line).toBeNull();
    expect(frame.gold).toBe(0);
  });

  test("az isThere által felfedezett mező és a változó megjelenik", () => {
    const frame = deriveFrame(syntheticTrace, start, 1);
    expect(frame.discovered.has("0:1")).toBe(true);
    expect(frame.variables.get("arany")).toEqual({ kind: "bool", value: true });
    expect(frame.line).toBe(1);
    expect(frame.steps).toBe(1);
  });

  test("a konzol és a bányászott arany halmozódik", () => {
    const frame = deriveFrame(syntheticTrace, start, 4);
    expect(frame.atEnd).toBe(true);
    expect(frame.console).toEqual(["true"]);
    expect(frame.mined.has("0:1")).toBe(true);
    expect(frame.gold).toBe(1);
    expect(frame.robot.pos).toEqual({ row: 0, col: 1 });
  });

  test("a tartományon kívüli index levágódik", () => {
    expect(deriveFrame(syntheticTrace, start, 99).index).toBe(4);
    expect(deriveFrame(syntheticTrace, start, -3).index).toBe(0);
  });

  test("visszalépés után a korábbi állapot jön vissza", () => {
    const forward = deriveFrame(syntheticTrace, start, 4);
    const back = deriveFrame(syntheticTrace, start, 2);
    expect(back.console).toEqual(["true"]);
    expect(back.mined.size).toBe(0);
    expect(forward.mined.size).toBe(1);
  });

  test("az értékek a print formátumában jelennek meg", () => {
    expect(formatValue({ kind: "int", value: -5 })).toBe("-5");
    expect(formatValue({ kind: "bool", value: false })).toBe("false");
  });
});
