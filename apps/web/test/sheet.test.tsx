import { act, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { usePlayUi } from "../src/play/play-ui-store.ts";
import { SPEED_MAX, usePlayback } from "../src/play/playback-store.ts";
import { respond } from "./support/api.ts";
import { renderApp } from "./support/app.tsx";
import { CORRIDOR, mapDetail } from "./support/fixtures.ts";

function seedProgram(source: string) {
  window.localStorage.setItem("minescript.program.1", JSON.stringify({ source, linked: null }));
}

function editorText(): string {
  return [...document.querySelectorAll(".cm-line")].map((line) => line.textContent).join("\n");
}

async function openPlay(source: string) {
  seedProgram(source);
  respond("GET", "/maps/1", mapDetail(1, "Folyosó", CORRIDOR));
  respond("POST", "/runs", {
    run: { id: 1, gold: 1, steps: 2, outcomeKind: "ok" },
    outcome: { kind: "ok" },
    console: [],
  });
  const app = renderApp("/play/1");
  await screen.findByRole("grid", { name: "Folyosó térképe" });
  await waitFor(() => expect(document.querySelector(".cm-content")).not.toBeNull());
  return app;
}

function tip(): HTMLElement {
  return screen.getByRole("complementary", { name: "Tipp" });
}

describe("programlap", () => {
  test("a fiókokból a parancs a kurzor után kerül be, a mezős blokk kitölthető", async () => {
    const { user } = await openPlay("step forward 3\n");
    await user.click(screen.getByRole("button", { name: "Robot" }));
    await user.click(await screen.findByRole("menuitem", { name: /Bányássz itt/ }));
    await waitFor(() => expect(editorText()).toContain("mine here"));
    expect(screen.getByText(/^Beszúrva: /)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Ciklus" }));
    const items = await screen.findAllByRole("menuitem");
    await user.click(items[0] as HTMLElement);
    await waitFor(() => expect(editorText()).toContain("while"));
    await user.click(screen.getByRole("button", { name: "Változók" }));
    await user.click(await screen.findByRole("menuitem", { name: /^Új változó/ }));
    await waitFor(() => expect(editorText()).toContain("set szamlalo to 0"));
  });

  test("üres programnál a tipp a Robot fiókot nyitja, elrejthető", async () => {
    const { user } = await openPlay("");
    expect(tip().textContent).toContain("Kezdd egy lépéssel");
    await user.click(within(tip()).getByRole("button", { name: "Robot fiók" }));
    expect(await screen.findByRole("menu", { name: "Robot" })).toBeTruthy();
    act(() => usePlayUi.getState().setOpenDrawer(null));
    await user.click(screen.getByRole("button", { name: "Tipp elrejtése" }));
    expect(usePlayUi.getState().dismissedTips).toContain("empty");
  });

  test("szóközhibánál a tipp formáz, behúzáshibánál a hibás sort mutatja", async () => {
    const { user } = await openPlay("step  forward 1\n");
    await waitFor(() => expect(tip().textContent).toContain("Szóköz- vagy behúzáshiba"));
    await user.click(within(tip()).getByRole("button", { name: "Formázás" }));
    await waitFor(() => expect(editorText()).toBe("step forward 1\n"));
  });

  test("üres blokknál a tipp a hiányzó behúzásra visz", async () => {
    const { user } = await openPlay("while true\nmine here\n");
    await waitFor(() => expect(tip().textContent).toContain("húzd beljebb"));
    await user.click(within(tip()).getByRole("button", { name: "Mutasd" }));
    expect(document.activeElement?.closest(".cm-editor")).not.toBeNull();
  });

  test("hibátlan futás után a tipp a maradék aranyra vagy a ranglistára mutat", async () => {
    act(() => usePlayback.getState().setSpeed(SPEED_MAX));
    act(() => usePlayUi.setState({ hasRunOnce: true }));
    const { user, router } = await openPlay("step forward 3\nmine here\n");
    await user.click(screen.getByRole("button", { name: "Futtatás" }));
    act(() => usePlayback.getState().seek(usePlayback.getState().result?.events.length ?? 0));
    await waitFor(() => expect(tip().textContent).toContain("Még 1 elérhető arany maradt"));
    await user.click(within(tip()).getByRole("button", { name: "Teljes térkép" }));
    expect(usePlayUi.getState().fogMode).toBe("full");
    await user.click(screen.getByRole("button", { name: "Tipp elrejtése" }));
    expect(router.state.location.pathname).toBe("/play/1");
  });

  test("a 100 000 karakternél hosszabb program jelzést kap, és nem fut", async () => {
    const { user } = await openPlay(`print 1\n${"x".repeat(100_001)}`);
    expect((await screen.findByText(/legfeljebb 100/)).getAttribute("role")).toBe("alert");
    await user.click(screen.getByRole("button", { name: "Futtatás" }));
    expect(usePlayback.getState().result).toBeNull();
  });
});
