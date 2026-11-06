import { beforeEach, describe, expect, test } from "vitest";
import { usePlayback } from "../src/runner/playback-store.ts";
import { start, syntheticTrace } from "./fixtures.ts";

describe("lejátszás", () => {
  beforeEach(() => {
    usePlayback.setState({ breakpoints: new Set() });
    usePlayback.getState().clear();
  });

  test("a betöltés lejátszást indít az elejéről", () => {
    usePlayback.getState().load(syntheticTrace, start);
    expect(usePlayback.getState()).toMatchObject({ index: 0, status: "playing" });
  });

  test("a tick a végén befejezett állapotba megy", () => {
    const store = usePlayback.getState();
    store.load(syntheticTrace, start);
    for (let tick = 0; tick < 10; tick += 1) {
      usePlayback.getState().tick();
    }
    expect(usePlayback.getState()).toMatchObject({ index: 4, status: "finished" });
  });

  test("a töréspont a sor előtt megállítja a lejátszást", () => {
    usePlayback.getState().toggleBreakpoint(3);
    usePlayback.getState().load(syntheticTrace, start);
    usePlayback.getState().tick();
    usePlayback.getState().tick();
    expect(usePlayback.getState()).toMatchObject({ index: 2, status: "paused" });
  });

  test("leállítás után a futás állapota stopped", () => {
    usePlayback.getState().load(syntheticTrace, start);
    usePlayback.getState().stop();
    usePlayback.getState().tick();
    expect(usePlayback.getState()).toMatchObject({ index: 0, status: "stopped" });
  });

  test("léptetés előre és vissza", () => {
    const store = usePlayback.getState();
    store.load(syntheticTrace, start);
    store.pause();
    usePlayback.getState().step();
    usePlayback.getState().step();
    usePlayback.getState().back();
    expect(usePlayback.getState().index).toBe(1);
    usePlayback.getState().seek(100);
    expect(usePlayback.getState()).toMatchObject({ index: 4, status: "finished" });
  });
});
