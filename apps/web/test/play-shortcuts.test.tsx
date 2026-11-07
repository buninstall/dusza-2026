import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import { usePlayUi } from "../src/play/play-ui-store.ts";
import { usePlayback } from "../src/play/playback-store.ts";
import { respond } from "./support/api.ts";
import { renderApp } from "./support/app.tsx";
import { LABYRINTH, mapDetail, respondPrograms } from "./support/fixtures.ts";

const PROGRAM = "step forward 2\nturn by 3\nstep forward 2\nmine here\n";

function seedProgram(source: string) {
  window.localStorage.setItem("minescript.program.4", JSON.stringify({ source, linked: null }));
}

async function openPlay() {
  seedProgram(PROGRAM);
  respond("GET", "/maps/4", mapDetail(4, "Labirintus", LABYRINTH));
  respondPrograms([]);
  const app = renderApp("/play/4");
  await screen.findByRole("grid", { name: "Labirintus térképe" });
  await waitFor(() => expect(document.querySelector(".cm-content")).not.toBeNull());
  return app;
}

function key(target: Element, init: KeyboardEventInit) {
  act(() => {
    fireEvent.keyDown(target, init);
  });
}

function firstCell(): HTMLElement {
  return screen.getAllByRole("gridcell")[0] as HTMLElement;
}

beforeEach(() => {
  act(() => usePlayback.getState().setSpeed(1));
});

describe("a játék billentyűparancsai", () => {
  test("Ctrl+Enter a szerkesztőből futtat, Shift+F5 leállít, F5 újra futtat", async () => {
    await openPlay();
    key(document.querySelector(".cm-content") as Element, { key: "Enter", ctrlKey: true });
    await waitFor(() => expect(usePlayback.getState().status).toBe("playing"));
    key(firstCell(), { key: "F5", shiftKey: true });
    expect(usePlayback.getState().status).toBe("stopped");
    key(firstCell(), { key: "F5" });
    await waitFor(() => expect(usePlayback.getState().status).toBe("playing"));
  });

  test("a bánya területén Szóköz, nyilak, Home, End, L és a sebesség billentyűi", async () => {
    await openPlay();
    key(firstCell(), { key: "Enter", metaKey: true });
    await waitFor(() => expect(usePlayback.getState().status).toBe("playing"));
    key(firstCell(), { key: " " });
    expect(usePlayback.getState().status).toBe("paused");
    const lever = screen.getByRole("button", { name: /^Konzol/ });
    const at = usePlayback.getState().index;
    key(lever, { key: "ArrowRight" });
    expect(usePlayback.getState().index).toBe(at + 1);
    key(lever, { key: "ArrowLeft" });
    expect(usePlayback.getState().index).toBe(at);
    key(lever, { key: "End" });
    expect(usePlayback.getState().status).toBe("finished");
    key(firstCell(), { key: " " });
    await waitFor(() => expect(usePlayback.getState().status).toBe("playing"));
    key(firstCell(), { key: " " });
    key(lever, { key: "Home" });
    expect(usePlayback.getState().index).toBe(0);
    key(firstCell(), { key: " " });
    expect(usePlayback.getState().status).toBe("playing");

    const fog = usePlayUi.getState().fogMode;
    key(firstCell(), { key: "l" });
    expect(usePlayUi.getState().fogMode).not.toBe(fog);
    key(firstCell(), { key: "L" });
    expect(usePlayUi.getState().fogMode).toBe(fog);

    const speed = usePlayback.getState().speed;
    key(firstCell(), { key: "+" });
    expect(usePlayback.getState().speed).toBeGreaterThan(speed);
    key(firstCell(), { key: "−" });
    key(firstCell(), { key: "=" });
    key(firstCell(), { key: "-" });
    expect(usePlayback.getState().speed).toBe(speed);
  });

  test("a rácsban a nyilak a cellák között mozognak, a csúszkán és a menüben semmit nem vált", async () => {
    await openPlay();
    key(firstCell(), { key: "Enter", ctrlKey: true });
    await waitFor(() => expect(usePlayback.getState().status).toBe("playing"));
    key(firstCell(), { key: " " });
    const at = usePlayback.getState().index;
    key(firstCell(), { key: "ArrowRight" });
    expect(usePlayback.getState().index).toBe(at);
    key(screen.getByRole("slider", { name: "Sebesség" }), { key: "l" });
    expect(usePlayUi.getState().fogMode).toBe("lamp");
    key(screen.getByRole("button", { name: /^Konzol/ }), { key: " " });
    expect(usePlayback.getState().status).toBe("paused");
    key(document.body, { key: "l" });
    expect(usePlayUi.getState().fogMode).toBe("lamp");
  });

  test("Ctrl+S menti, Ctrl+O a programtárat nyitja", async () => {
    await openPlay();
    key(firstCell(), { key: "s", ctrlKey: true });
    expect(await screen.findByRole("dialog", { name: "Program mentése" })).toBeTruthy();
    key(document.activeElement ?? document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    key(firstCell(), { key: "o", ctrlKey: true });
    expect(await screen.findByRole("dialog", { name: "Mentett programok" })).toBeTruthy();
  });
});
