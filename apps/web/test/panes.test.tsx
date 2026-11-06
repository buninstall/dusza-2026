import { act, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { usePlayUi } from "../src/play/play-ui-store.ts";
import { SPEED_MAX, usePlayback } from "../src/play/playback-store.ts";
import { respond } from "./support/api.ts";
import { renderApp } from "./support/app.tsx";
import { CORRIDOR, mapDetail } from "./support/fixtures.ts";

function narrowScreen(query: string): MediaQueryList {
  return {
    matches: !query.includes("min-width"),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  };
}

beforeEach(() => {
  vi.stubGlobal("matchMedia", narrowScreen);
  act(() => usePlayback.getState().setSpeed(SPEED_MAX));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function openPlay(source: string) {
  window.localStorage.setItem("minescript.program.1", JSON.stringify({ source, linked: null }));
  respond("GET", "/maps/1", mapDetail(1, "Folyosó", CORRIDOR));
  respond("POST", "/runs", {
    run: { id: 1, gold: 1, steps: 2, outcomeKind: "ok" },
    outcome: { kind: "ok" },
    console: [],
  });
  const app = renderApp("/play/1");
  await screen.findByRole("grid", { name: "Folyosó térképe" });
  return app;
}

describe("keskeny képernyő", () => {
  test("a bánya és a program külön fülön, futtatáskor a bánya kerül elő", async () => {
    const { user } = await openPlay("step forward 3\nmine here\n");
    const stage = screen.getByRole("tab", { name: "Bánya" });
    expect(stage.getAttribute("aria-selected")).toBe("true");
    await user.click(screen.getByRole("tab", { name: "Program" }));
    expect(usePlayUi.getState().pane).toBe("sheet");
    await user.click(screen.getByRole("button", { name: "Futtatás" }));
    await waitFor(() => expect(usePlayUi.getState().pane).toBe("stage"));
    expect(stage.getAttribute("aria-selected")).toBe("true");
  });

  test("szintaktikai hibánál a program fül nyílik meg, az ugrólink is oda visz", async () => {
    const { user } = await openPlay("step  forward 1\n");
    await user.click(screen.getByRole("button", { name: "Futtatás" }));
    await waitFor(() => expect(usePlayUi.getState().pane).toBe("sheet"));
    act(() => usePlayUi.getState().setPane("stage"));
    await user.click(screen.getByRole("button", { name: "Ugrás a programhoz" }));
    expect(usePlayUi.getState().pane).toBe("sheet");
  });
});

describe("a felület beállításai", () => {
  test("a sérült tárolt beállítás alapértékre áll vissza", () => {
    window.localStorage.setItem("minescript.play-ui", "{nem json");
    act(() => usePlayUi.getState().reset());
    expect(usePlayUi.getState().fogMode).toBe("lamp");
    window.localStorage.setItem("minescript.play-ui", JSON.stringify({ fogMode: 7 }));
    act(() => usePlayUi.getState().reset());
    expect(usePlayUi.getState().fogMode).toBe("lamp");
    act(() => usePlayUi.getState().toggleFog());
    expect(JSON.parse(window.localStorage.getItem("minescript.play-ui") ?? "{}").fogMode).toBe(
      "full",
    );
  });
});
