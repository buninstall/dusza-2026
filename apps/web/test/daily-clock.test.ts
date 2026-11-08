import { describe, expect, test } from "vitest";
import { dayLabel, msUntilNextDay } from "../src/maps/daily-clock.ts";

const at = (iso: string) => Date.parse(iso);

describe("napi kihívás órája", () => {
  test("budapesti éjfél után fél perccel kér új pályát", () => {
    expect(msUntilNextDay(at("2026-11-08T22:00:00Z"))).toBe(3_600_000 + 30_000);
    expect(msUntilNextDay(at("2026-07-01T21:30:00Z"))).toBe(1_800_000 + 30_000);
  });

  test("közvetlenül éjfél után egy teljes nap múlva kér újra", () => {
    expect(msUntilNextDay(at("2026-11-08T23:00:10Z"))).toBe(86_400_000 - 10_000 + 30_000);
  });

  test("éjfél előtti utolsó másodpercekben is legalább egy percet vár", () => {
    expect(msUntilNextDay(at("2026-11-08T22:59:50Z"))).toBe(60_000);
  });

  test("a nap kulcsából magyar dátum lesz, hibás kulcsból üres szöveg", () => {
    expect(dayLabel("2026-11-08")).toBe("november 8.");
    expect(dayLabel("2026-1-8")).toBe("");
    expect(dayLabel("")).toBe("");
  });
});
