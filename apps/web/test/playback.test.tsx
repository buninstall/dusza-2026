import { act, render, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { clampIndex, deriveFrame, formatValue } from "../src/play/derive.ts";
import {
  ANNOUNCE_INTERVAL_MS,
  announcementFor,
  LiveAnnouncer,
} from "../src/play/LiveAnnouncer.tsx";
import { isPlaybackActive, SPEED_MAX, SPEED_MIN, usePlayback } from "../src/play/playback-store.ts";
import {
  eventBeats,
  STEP_ANIMATION_MS,
  settleWindow,
  stepDuration,
  usePrevious,
} from "../src/play/step-animation.ts";
import { tickInterval, usePlaybackTimer } from "../src/play/usePlaybackTimer.ts";
import { corridorStart, crashTrace, walkTrace } from "./support/fixtures.ts";

describe("deriveFrame", () => {
  test("a 0. index a kiinduló állapot: csak a kezdőmező felfedezett", () => {
    const frame = deriveFrame(walkTrace, corridorStart, 0);
    expect(frame).toMatchObject({ atStart: true, atEnd: false, gold: 0, steps: 0, line: null });
    expect([...frame.discovered]).toEqual(["0:0"]);
    expect(frame.lastMined).toBeNull();
  });

  test("az isThere célmezője és a bejárt út felfedezett lesz", () => {
    const frame = deriveFrame(walkTrace, corridorStart, 2);
    expect([...frame.discovered].sort()).toEqual(["0:0", "0:1", "0:2"]);
    expect(frame.variables.get("elol")).toEqual({ kind: "bool", value: false });
    expect(frame.robot.pos).toEqual({ row: 0, col: 2 });
  });

  test("a bányászás, a kiírás és a lépésszám halmozódik", () => {
    const mined = deriveFrame(walkTrace, corridorStart, 3);
    expect(mined.lastMined).toEqual({ row: 0, col: 2 });
    expect(mined.mined.has("0:2")).toBe(true);
    expect(mined.gold).toBe(1);
    const end = deriveFrame(walkTrace, corridorStart, 5);
    expect(end.atEnd).toBe(true);
    expect(end.console).toEqual([{ index: 4, step: 4, text: "1" }]);
    expect(end.robot.dir).toBe("north");
    expect(end.lastMined).toBeNull();
  });

  test("visszalépéskor a korábbi állapot jön vissza, a tartományon kívüli index levágódik", () => {
    expect(deriveFrame(walkTrace, corridorStart, 2).mined.size).toBe(0);
    expect(clampIndex(walkTrace, 99)).toBe(5);
    expect(clampIndex(walkTrace, -4)).toBe(0);
    expect(deriveFrame(walkTrace, corridorStart, 2.7).index).toBe(2);
  });

  test("az értékek a print formátumában jelennek meg", () => {
    expect(formatValue({ kind: "int", value: -5 })).toBe("-5");
    expect(formatValue({ kind: "bool", value: true })).toBe("true");
    expect(formatValue({ kind: "bool", value: false })).toBe("false");
  });
});

describe("lejátszás-tár", () => {
  beforeEach(() => usePlayback.getState().clear());

  const store = () => usePlayback.getState();

  test("a betöltés az elejéről indít, új futásazonosítóval", () => {
    const before = store().runId;
    store().load(walkTrace, corridorStart, "forrás");
    expect(store()).toMatchObject({ index: 0, status: "playing", source: "forrás" });
    expect(store().runId).toBe(before + 1);
  });

  test("a tick a végén befejezett állapotba megy", () => {
    store().load(walkTrace, corridorStart, "");
    for (let tick = 0; tick < 8; tick += 1) {
      store().tick();
    }
    expect(store()).toMatchObject({ index: 5, status: "finished" });
    store().tick();
    expect(store().index).toBe(5);
  });

  test("szünet, folytatás, léptetés és tekerés", () => {
    store().load(walkTrace, corridorStart, "");
    store().pause();
    expect(store().status).toBe("paused");
    store().tick();
    expect(store().index).toBe(0);
    store().step();
    store().step();
    store().back();
    expect(store().index).toBe(1);
    store().seek(4);
    expect(store()).toMatchObject({ index: 4, status: "paused" });
    store().restart();
    expect(store().index).toBe(0);
    store().play();
    expect(store().status).toBe("playing");
    store().seek(99);
    expect(store()).toMatchObject({ index: 5, status: "finished" });
  });

  test("leállítás után semmi nem mozdítja a futást", () => {
    store().load(crashTrace, corridorStart, "");
    store().stop();
    store().tick();
    store().step();
    store().play();
    expect(store()).toMatchObject({ index: 0, status: "stopped" });
    expect(isPlaybackActive(store().status)).toBe(false);
  });

  test("üres tárban a vezérlők hatástalanok, a sebesség korlátos", () => {
    store().play();
    store().pause();
    store().stop();
    store().tick();
    store().seek(2);
    expect(store().status).toBe("idle");
    store().setSpeed(999);
    expect(store().speed).toBe(SPEED_MAX);
    store().setSpeed(-3);
    expect(store().speed).toBe(SPEED_MIN);
  });
});

describe("időzítés és animáció", () => {
  test("a sebesség a tick-intervallumot adja", () => {
    expect(tickInterval(4)).toBe(250);
  });

  test("csak az egylépéses haladás animál", () => {
    expect(stepDuration(3, 4, 1)).toBe(STEP_ANIMATION_MS);
    expect(stepDuration(3, 4, 30)).toBeLessThan(STEP_ANIMATION_MS);
    expect(stepDuration(3, 9, 4)).toBe(0);
    expect(stepDuration(4, 3, 4)).toBe(0);
  });

  test("a több mezős lépés mezőnként kap időt, és az animációs ablak kivárja", () => {
    expect(eventBeats(walkTrace.events[1])).toBe(2);
    expect(eventBeats(null)).toBe(1);
    expect(stepDuration(3, 4, 1, 3)).toBe(STEP_ANIMATION_MS * 3);
    expect(stepDuration(3, 4, 4, 2)).toBe(450);
    expect(settleWindow(2000)).toBeGreaterThan(2000);
  });

  test("a usePrevious az előző értéket adja", () => {
    const { result, rerender } = renderHook(({ value }) => usePrevious(value), {
      initialProps: { value: 1 },
    });
    expect(result.current).toBe(1);
    rerender({ value: 2 });
    expect(result.current).toBe(1);
    rerender({ value: 5 });
    expect(result.current).toBe(2);
  });

  test("a lejátszó időzítő lejátszás közben léptet", () => {
    vi.useFakeTimers();
    usePlayback.getState().clear();
    usePlayback.getState().setSpeed(8);
    usePlayback.getState().load(walkTrace, corridorStart, "");
    renderHook(() => usePlaybackTimer());
    act(() => {
      vi.advanceTimersByTime(125);
    });
    act(() => {
      vi.advanceTimersByTime(125);
    });
    expect(usePlayback.getState().index).toBe(2);
    act(() => {
      vi.advanceTimersByTime(125);
    });
    expect(usePlayback.getState().index).toBe(2);
    act(() => {
      vi.advanceTimersByTime(125);
    });
    expect(usePlayback.getState().index).toBe(3);
    act(() => usePlayback.getState().pause());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(usePlayback.getState().index).toBe(3);
  });
});

describe("élő bejelentő", () => {
  test("a képkockát magyarul, fojtva jelenti be", () => {
    vi.useFakeTimers();
    const first = deriveFrame(walkTrace, corridorStart, 1);
    expect(announcementFor(first)).toBe(
      "1. sor. Robot: 1. sor, 1. oszlop, kelet felé. Arany: 0, lépés: 1.",
    );
    expect(announcementFor(null)).toBe("");
    const { rerender } = render(<LiveAnnouncer frame={first} />);
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(screen.getByRole("status").textContent).toContain("Arany: 0");
    rerender(<LiveAnnouncer frame={deriveFrame(walkTrace, corridorStart, 3)} />);
    expect(screen.getByRole("status").textContent).toContain("Arany: 0");
    act(() => {
      vi.advanceTimersByTime(ANNOUNCE_INTERVAL_MS);
    });
    expect(screen.getByRole("status").textContent).toContain("Arany: 1");
    rerender(<LiveAnnouncer frame={null} final="Vége" />);
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(screen.getByRole("status").textContent).toBe("Vége");
  });
});
