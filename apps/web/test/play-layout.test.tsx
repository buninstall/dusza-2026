import { act, fireEvent, renderHook, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  clampZoom,
  nextZoomLevel,
  SHEET_SHARE,
  usePlayUi,
  ZOOM_MAX,
  ZOOM_MIN,
} from "../src/play/play-ui-store.ts";
import { SPEED_MAX, usePlayback } from "../src/play/playback-store.ts";
import { STEP_SETTLE_MS, useStepWindow } from "../src/play/step-animation.ts";
import { respond } from "./support/api.ts";
import { renderApp } from "./support/app.tsx";
import { CORRIDOR, mapDetail } from "./support/fixtures.ts";

const SOURCE = "step forward 3\nmine here\n";

async function openPlay() {
  window.localStorage.setItem(
    "minescript.program.1",
    JSON.stringify({ source: SOURCE, linked: null }),
  );
  respond("GET", "/maps/1", mapDetail(1, "Folyosó", CORRIDOR));
  respond("POST", "/runs", {
    run: { id: 1, gold: 1, steps: 3, outcomeKind: "ok" },
    outcome: { kind: "ok" },
    console: [],
  });
  const app = renderApp("/play/1");
  await screen.findByRole("grid", { name: "Folyosó térképe" });
  return app;
}

function splitter() {
  return screen.getByRole("separator", { name: "A szerkesztő és a bánya határa" });
}

beforeEach(() => {
  act(() => usePlayback.getState().setSpeed(SPEED_MAX));
});

describe("nagyítási lépcsők", () => {
  test("a gombok a következő lépcsőre ugranak, a határokon megállnak", () => {
    expect(nextZoomLevel(1, 1)).toBe(1.25);
    expect(nextZoomLevel(1.3, 1)).toBe(1.5);
    expect(nextZoomLevel(1.3, -1)).toBe(1.25);
    expect(nextZoomLevel(ZOOM_MAX, 1)).toBe(ZOOM_MAX);
    expect(nextZoomLevel(ZOOM_MIN, -1)).toBe(ZOOM_MIN);
  });

  test("a folyamatos nagyítás a tartományon belül marad", () => {
    expect(clampZoom(10)).toBe(ZOOM_MAX);
    expect(clampZoom(0.2)).toBe(ZOOM_MIN);
    act(() => usePlayUi.getState().setZoom(2.37));
    expect(usePlayUi.getState().zoom).toBe(2.37);
  });
});

describe("a szerkesztő szélessége", () => {
  test("a tárolt arány a tartományba szorul, és megmarad", () => {
    act(() => usePlayUi.getState().setSheetShare(90));
    expect(usePlayUi.getState().sheetShare).toBe(SHEET_SHARE.max);
    expect(JSON.parse(window.localStorage.getItem("minescript.play-ui") ?? "{}").sheetShare).toBe(
      SHEET_SHARE.max,
    );
    act(() => usePlayUi.getState().setSheetShare(null));
    expect(usePlayUi.getState().sheetShare).toBeNull();
  });
});

describe("a lépés animációs ablaka", () => {
  test("a lépés után rövid ideig él, utána egy újrarajzolás már nem animál", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ key }) => useStepWindow(key, true), {
      initialProps: { key: "1:1" },
    });
    expect(result.current).toBe(true);
    act(() => vi.advanceTimersByTime(STEP_SETTLE_MS));
    expect(result.current).toBe(false);
    rerender({ key: "1:1" });
    expect(result.current).toBe(false);
    rerender({ key: "1:2" });
    expect(result.current).toBe(true);
  });
});

describe("széles elrendezés", () => {
  test("a program a bal oldalon van, előtte a bányának", async () => {
    await openPlay();
    const program = screen.getByRole("region", { name: "Program" });
    const stage = screen.getByRole("region", { name: "Bánya" });
    expect(program.compareDocumentPosition(stage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(splitter().getAttribute("aria-controls")).toBe(program.id);
  });

  test("az elválasztó billentyűzettel állítható, dupla kattintásra visszaáll", async () => {
    await openPlay();
    const handle = splitter();
    expect(handle.getAttribute("aria-valuenow")).toBe(String(SHEET_SHARE.initial));
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(splitter().getAttribute("aria-valuenow")).toBe(String(SHEET_SHARE.initial + 2));
    fireEvent.keyDown(handle, { key: "Home" });
    expect(splitter().getAttribute("aria-valuenow")).toBe(String(SHEET_SHARE.min));
    expect(splitter().getAttribute("aria-valuetext")).toBe(
      `A szerkesztő a szélesség ${SHEET_SHARE.min}%-a`,
    );
    fireEvent.doubleClick(handle);
    expect(usePlayUi.getState().sheetShare).toBeNull();
    expect(splitter().getAttribute("aria-valuenow")).toBe(String(SHEET_SHARE.initial));
  });

  test("a nagyítás a fejlécben van, és lépcsőnként vált", async () => {
    const { user } = await openPlay();
    const zoom = screen.getByRole("toolbar", { name: "Térkép nagyítása" });
    expect(zoom.textContent).toContain("100%");
    expect(screen.getByRole("button", { name: "Kicsinyítés" }).hasAttribute("disabled")).toBe(true);
    await user.click(screen.getByRole("button", { name: "Nagyítás" }));
    expect(zoom.textContent).toContain("125%");
    expect(document.querySelector(".well-view")?.getAttribute("data-zoomed")).toBe("true");
  });

  test("a futás végén a sor-kijelző a forrássort mutatja, és a programba ugrik", async () => {
    const { user } = await openPlay();
    await user.click(screen.getByRole("button", { name: "Futtatás" }));
    const line = await screen.findByRole("button", {
      name: "2. sor mutatása a programban: mine here",
    });
    expect(line.textContent).toContain("mine here");
    await user.click(line);
    await waitFor(() => expect(document.activeElement?.closest(".cm-editor")).not.toBeNull());
  });
});
