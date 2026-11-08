import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { usePlayback } from "../src/play/playback-store.ts";
import { callsTo, respond } from "./support/api.ts";
import { renderApp } from "./support/app.tsx";
import { CORRIDOR, mapDetail } from "./support/fixtures.ts";

const SOURCE = "step forward 3\nmine here\nstep forward 3\nmine here\n";

function runDetail(overrides: { gold?: number; versionId?: number } = {}) {
  return {
    run: {
      id: 7,
      mapId: 1,
      mapTitle: "Folyosó",
      mapVersionId: overrides.versionId ?? 11,
      version: 1,
      gold: overrides.gold ?? 2,
      steps: 4,
      outcomeKind: "ok",
      errorCode: null,
      errorLine: null,
      createdAt: 1_793_960_000_000,
      source: SOURCE,
    },
    map: { content: CORRIDOR, lampMode: "open" },
  };
}

function editorText(): string {
  return [...document.querySelectorAll(".cm-line")].map((line) => line.textContent).join("\n");
}

describe("visszajátszás", () => {
  test("a rögzített futás lejátszódik a saját térképén, és semmit nem küld be", async () => {
    respond("GET", "/runs/7", runDetail());
    respond("GET", "/maps/1", mapDetail(1, "Folyosó", CORRIDOR));
    renderApp("/runs/7");
    expect(await screen.findByRole("heading", { level: 1, name: /Folyosó/ })).toBeTruthy();
    await waitFor(() => expect(editorText()).toBe(SOURCE));
    await waitFor(() => expect(usePlayback.getState().result).not.toBeNull());
    expect(usePlayback.getState().result?.gold).toBe(2);
    usePlayback.getState().seek(usePlayback.getState().result?.events.length ?? 0);
    expect(await screen.findByText("Rögzített eredmény: 2 arany, 4 lépés.")).toBeTruthy();
    expect(callsTo("POST", "/runs")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Futtatás" })).toBeNull();
  });

  test("régi verziónál jelzi, eltérő eredménynél figyelmeztet", async () => {
    respond("GET", "/runs/7", runDetail({ gold: 1, versionId: 10 }));
    respond("GET", "/maps/1", mapDetail(1, "Folyosó", CORRIDOR));
    renderApp("/runs/7");
    expect(await screen.findByText(/régi verzió/)).toBeTruthy();
    usePlayback.getState().seek(usePlayback.getState().result?.events.length ?? 0);
    expect(await screen.findByText(/eltér/)).toBeTruthy();
  });

  test("megnyitás a szerkesztőben: nem mentett munka előtt megerősítést kér", async () => {
    respond("GET", "/runs/7", runDetail());
    respond("GET", "/maps/1", mapDetail(1, "Folyosó", CORRIDOR));
    window.localStorage.setItem(
      "minescript.program.1",
      JSON.stringify({ source: "print 9\n", linked: null }),
    );
    const { user, router } = renderApp("/runs/7");
    await user.click(await screen.findByRole("button", { name: "Megnyitás a szerkesztőben" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "Felülírod a szerkesztő tartalmát?",
    });
    await user.click(within(dialog).getByRole("button", { name: "Megnyitás a szerkesztőben" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/play/1"));
    expect(JSON.parse(window.localStorage.getItem("minescript.program.1") ?? "{}").source).toBe(
      SOURCE,
    );
  });

  test.each(["/runs/abc", "/runs/404"])("%s: nincs ilyen futás", async (path) => {
    renderApp(path);
    expect(
      await screen.findByRole("heading", { level: 1, name: "404: nincs ilyen oldal" }),
    ).toBeTruthy();
  });
});
