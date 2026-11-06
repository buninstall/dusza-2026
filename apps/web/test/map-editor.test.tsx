import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { apiError, callsTo, onApi, respond } from "./support/api.ts";
import { renderApp } from "./support/app.tsx";
import { LABYRINTH, mapDetail } from "./support/fixtures.ts";

function textFile(name: string, content: string): File {
  return new File([content], name, { type: "text/plain" });
}

function cell(name: string): HTMLElement {
  return screen.getByRole("gridcell", { name });
}

async function chooseFile(input: HTMLInputElement, file: File) {
  const list = { 0: file, length: 1, item: (index: number) => (index === 0 ? file : null) };
  Object.defineProperty(input, "files", { value: list, configurable: true });
  fireEvent.change(input);
}

describe("új térkép", () => {
  test("festés, ellenőrzés és mentés után a játékba visz", async () => {
    respond("POST", "/maps", { map: { id: 9 }, warnings: [] }, 201);
    respond("GET", "/maps/9", mapDetail(9, "Saját akna", "1 3\n>@.\n"));
    const { user, router } = renderApp("/maps/new");
    const grid = await screen.findByRole("grid", { name: "Térképrács" });
    expect(within(grid).getAllByRole("gridcell")).toHaveLength(70);
    expect(screen.getByRole("button", { name: /Mentés/ }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("A térkép címe hiányzik.")).toBeTruthy();

    await user.click(screen.getByRole("radio", { name: /Arany/ }));
    cell("1. sor, 2. oszlop: üres kamra").focus();
    await user.keyboard("{Enter}");
    expect(cell("1. sor, 2. oszlop: arany")).toBeTruthy();
    expect(screen.getByText("1. sor, 2. oszlop: Arany")).toBeTruthy();

    await user.keyboard("{ArrowRight}3{Enter}");
    expect(cell("1. sor, 3. oszlop: fal")).toBeTruthy();

    await user.type(screen.getByRole("textbox", { name: /Cím/ }), "Saját akna");
    expect(screen.getByText("A térkép érvényes, menthető.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Mentés" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/play/9"));
    const body = callsTo("POST", "/maps")[0]?.body as { title: string; content: string };
    expect(body.title).toBe("Saját akna");
    expect(body.content.split("\n").slice(0, 2)).toEqual(["7 10", ">@#......."]);
  });

  test("a robot felülfestése érvénytelenné teszi, a robot eszköz visszahelyezi irányával", async () => {
    const { user } = renderApp("/maps/new");
    await screen.findByRole("grid", { name: "Térképrács" });
    await user.click(screen.getByRole("radio", { name: /Fal/ }));
    cell("1. sor, 1. oszlop: robot, kelet felé").focus();
    await user.keyboard("{Enter}");
    expect(screen.getAllByText("Nincs robot.", { exact: false }).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("radio", { name: "dél" }));
    await user.click(screen.getByRole("radio", { name: /Robot/ }));
    cell("1. sor, 1. oszlop: fal").focus();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(cell("2. sor, 1. oszlop: robot, dél felé")).toBeTruthy();
  });

  test("méretváltás a léptetőkkel", async () => {
    const { user } = renderApp("/maps/new");
    await screen.findByRole("grid", { name: "Térképrács" });
    const rows = screen.getAllByRole("button", { name: /Csökkentés|Decrease/i })[0] as HTMLElement;
    await user.click(rows);
    expect(screen.getAllByRole("gridcell")).toHaveLength(60);
  });

  test("hibás térképfájl importja érthető hibát ad, és nem tölt be semmit", async () => {
    renderApp("/maps/new");
    await screen.findByRole("grid", { name: "Térképrács" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await chooseFile(input, textFile("rossz.txt", "2 3\n>.@\n#.\n"));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("nem érvényes térkép");
    expect(alert.textContent).toContain("3. sor");
    expect(screen.getAllByRole("gridcell")).toHaveLength(70);
  });

  test("érvényes importálás betölti, az exportálás a kanonikus szöveget tölti le", async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    URL.createObjectURL = vi.fn(() => "blob:map");
    URL.revokeObjectURL = vi.fn();
    const { user } = renderApp("/maps/new");
    await screen.findByRole("grid", { name: "Térképrács" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await chooseFile(input, textFile("jo.txt", "1 3\r\n>.@\r\n"));
    await waitFor(() => expect(screen.getAllByRole("gridcell")).toHaveLength(3));
    expect(await screen.findByText("A térkép betöltve a fájlból.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Exportálás" }));
    expect(click).toHaveBeenCalledOnce();
    click.mockRestore();
  });

  test("a szerver elutasítása hibaüzenetet ad", async () => {
    onApi("POST", "/maps", () =>
      apiError(422, "MAP_INVALID", "A térkép nem felel meg a szabályoknak."),
    );
    const { user } = renderApp("/maps/new");
    await user.type(await screen.findByRole("textbox", { name: /Cím/ }), "X");
    await user.click(screen.getByRole("button", { name: "Mentés" }));
    expect(await screen.findByText("A térkép nem felel meg a szabályoknak.")).toBeTruthy();
  });
});

describe("térkép szerkesztése", () => {
  test("futás után a mentés új verziót hoz létre, és ezt előre jelzi", async () => {
    respond("GET", "/maps/4", mapDetail(4, "Labirintus", LABYRINTH, { runCount: 3, version: 2 }));
    respond("PUT", "/maps/4", { map: { id: 4 }, createdNewVersion: true });
    const { user } = renderApp("/maps/4/edit");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Térkép szerkesztése" }),
    ).toBeTruthy();
    expect(
      await screen.findByText(/már 3 futás tartozik.*új verziót hoz létre \(v3\)/),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Mentés" }));
    expect(await screen.findByText(/új verzióként \(v3\)/)).toBeTruthy();
    expect(callsTo("PUT", "/maps/4")[0]?.body).toMatchObject({
      title: "Labirintus",
      content: LABYRINTH,
    });
  });

  test("futás nélkül helyben ment, törlés megerősítéssel a listára visz", async () => {
    respond("GET", "/maps/4", mapDetail(4, "Labirintus", LABYRINTH));
    respond("PUT", "/maps/4", { map: { id: 4 }, createdNewVersion: false });
    respond("DELETE", "/maps/4", { ok: true });
    respond("GET", "/maps", { maps: [] });
    const { user, router } = renderApp("/maps/4/edit");
    expect(await screen.findByText(/még nincs futás/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Mentés" }));
    expect(await screen.findByText("A térkép elmentve.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Térkép törlése" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Biztosan törlöd a térképet?" });
    await user.click(within(dialog).getByRole("button", { name: "Végleges törlés" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/maps"));
    expect(callsTo("DELETE", "/maps/4")).toHaveLength(1);
  });

  test("idegen térkép nem szerkeszthető, hiányzó térkép hibát ad", async () => {
    respond("GET", "/maps/5", mapDetail(5, "Idegen", LABYRINTH, { canEdit: false }));
    renderApp("/maps/5/edit");
    expect(await screen.findByText(/csak a készítője vagy egy adminisztrátor/)).toBeTruthy();
  });

  test("nem létező térkép", async () => {
    renderApp("/maps/77/edit");
    expect((await screen.findByRole("alert")).textContent).toContain("GET /maps/77");
  });
});
