import { describe, expect, test } from "vitest";
import { isDemoShownOn } from "../src/auth/demo.ts";

describe("demó fiókok láthatósága", () => {
  test("az éles minescript.hu címen rejtve vannak", () => {
    expect(isDemoShownOn("minescript.hu")).toBe(false);
    expect(isDemoShownOn("www.minescript.hu")).toBe(false);
    expect(isDemoShownOn("MineScript.HU")).toBe(false);
    expect(isDemoShownOn("minescript.hu.")).toBe(false);
  });

  test("minden más címen látszanak", () => {
    expect(isDemoShownOn("localhost")).toBe(true);
    expect(isDemoShownOn("127.0.0.1")).toBe(true);
    expect(isDemoShownOn("csapat13.dusza.cloudsyso.com")).toBe(true);
    expect(isDemoShownOn("staging.minescript.hu")).toBe(true);
    expect(isDemoShownOn("minescript.hu.example.com")).toBe(true);
  });
});
