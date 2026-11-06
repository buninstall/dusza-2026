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

async function openNew() {
  const app = renderApp("/maps/new");
  await screen.findByRole("grid", { name: "Térképrács" });
  return app;
}

function saveButton(): HTMLElement {
  return screen.getByRole("button", { name: /^Mentés/ });
}

describe("új térkép", () => {
  test("érvénytelen térképnél a mentés nem ment, a hibalistára visz; mentés után a szerkesztőben marad", async () => {
    respond("POST", "/maps", { map: { id: 9 }, warnings: [] }, 201);
    respond("GET", "/maps/9", mapDetail(9, "Saját akna", "1 3\n>@.\n"));
    const { user, router } = await openNew();
    expect(within(screen.getByRole("grid")).getAllByRole("gridcell")).toHaveLength(70);
    expect(screen.getByText("A térkép címe hiányzik.")).toBeTruthy();
    expect(saveButton().getAttribute("data-blocked")).toBe("true");
    await user.click(saveButton());
    expect(callsTo("POST", "/maps")).toHaveLength(0);
    expect(document.activeElement?.textContent).toContain("Ellenőrzés");
    expect(screen.getByText(/Még nem menthető: 1 hiba/)).toBeTruthy();

    await user.click(screen.getByRole("radio", { name: /Arany/ }));
    cell("1. sor, 2. oszlop: üres kamra").focus();
    await user.keyboard("{Enter}");
    expect(cell("1. sor, 2. oszlop: arany")).toBeTruthy();
    expect(screen.getByText("1. sor, 2. oszlop: Arany")).toBeTruthy();
    await user.keyboard("{ArrowRight}3{Enter}");
    expect(cell("1. sor, 3. oszlop: fal")).toBeTruthy();

    await user.type(screen.getByRole("textbox", { name: /Cím/ }), "Saját akna");
    expect(screen.getByText("A térkép érvényes, menthető.")).toBeTruthy();
    expect(screen.getByText("Módosítva")).toBeTruthy();
    await user.click(saveButton());
    await waitFor(() => expect(router.state.location.pathname).toBe("/maps/9/edit"));
    const body = callsTo("POST", "/maps")[0]?.body as { title: string; content: string };
    expect(body.title).toBe("Saját akna");
    expect(body.content.split("\n").slice(0, 2)).toEqual(["7 10", ">@#......."]);
    expect(await screen.findByRole("link", { name: "Kipróbálás" })).toBeTruthy();
  });

  test("a robot felülfestése érvénytelenné teszi, a hiba gombja a robot eszközt választja", async () => {
    const { user } = await openNew();
    await user.click(screen.getByRole("radio", { name: /Fal/ }));
    cell("1. sor, 1. oszlop: robot, kelet felé").focus();
    await user.keyboard("{Enter}");
    expect(screen.getAllByText("Nincs robot.", { exact: false }).length).toBeGreaterThan(0);
    expect(screen.getByText("hiányzik")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Robot kiválasztása" }));
    expect((screen.getByRole("radio", { name: /Robot/ }) as HTMLInputElement).checked).toBe(true);
    await user.click(screen.getByRole("radio", { name: "dél" }));
    cell("1. sor, 1. oszlop: fal").focus();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(cell("2. sor, 1. oszlop: robot, dél felé")).toBeTruthy();
    await user.keyboard("{Enter}");
    expect(cell("2. sor, 1. oszlop: robot, kelet felé")).toBeTruthy();
    await user.keyboard("R");
    expect(cell("2. sor, 1. oszlop: robot, észak felé")).toBeTruthy();
    await user.keyboard("{Shift>}R{/Shift}");
    expect(cell("2. sor, 1. oszlop: robot, kelet felé")).toBeTruthy();
  });

  test("visszavonás és újra, festésmódok és törlés billentyűvel", async () => {
    const { user } = await openNew();
    const undo = screen.getByRole("button", { name: "Visszavonás" });
    expect(undo.hasAttribute("disabled")).toBe(true);
    cell("1. sor, 2. oszlop: üres kamra").focus();
    await user.keyboard("{Enter}");
    expect(cell("1. sor, 2. oszlop: fal")).toBeTruthy();
    await user.keyboard("{Control>}z{/Control}");
    expect(cell("1. sor, 2. oszlop: üres kamra")).toBeTruthy();
    expect(screen.getByText("Visszavonva.")).toBeTruthy();
    await user.keyboard("{Control>}y{/Control}");
    expect(cell("1. sor, 2. oszlop: fal")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Visszavonás" }));
    await user.click(screen.getByRole("button", { name: "Újra" }));
    expect(cell("1. sor, 2. oszlop: fal")).toBeTruthy();

    cell("1. sor, 2. oszlop: fal").focus();
    await user.keyboard("{Delete}");
    expect(cell("1. sor, 2. oszlop: üres kamra")).toBeTruthy();

    await user.keyboard("t{Enter}{ArrowDown}{ArrowRight}");
    expect(screen.getByText(/Téglalap sarka: 1\. sor, 2\. oszlop/)).toBeTruthy();
    expect(screen.getByText("2 × 2")).toBeTruthy();
    await user.keyboard("{Enter}");
    expect(cell("2. sor, 3. oszlop: fal")).toBeTruthy();
    expect(screen.getByText("Téglalap: 4 mező, Fal")).toBeTruthy();

    await user.keyboard("{Enter}{Escape}");
    expect(screen.getByText("Téglalap megszakítva.")).toBeTruthy();

    await user.keyboard("k1{ArrowRight}{ArrowRight}{Enter}");
    expect(screen.getByText(/Kitöltés: \d+ mező, Üres kamra/)).toBeTruthy();
    await user.keyboard("e");
    expect(screen.getByText(/Üres kamra · Ecset/)).toBeTruthy();
  });

  test("az egérvonás egy lépés, a Shift+kattintás egyenest húz", async () => {
    const { user } = await openNew();
    const start = cell("3. sor, 2. oszlop: üres kamra");
    const end = cell("3. sor, 5. oszlop: üres kamra");
    document.elementFromPoint = vi.fn(() => end);
    fireEvent.pointerDown(start, { button: 0 });
    fireEvent.pointerMove(end, { clientX: 1, clientY: 1 });
    fireEvent.pointerUp(window);
    expect(cell("3. sor, 5. oszlop: fal")).toBeTruthy();
    fireEvent.pointerDown(cell("3. sor, 8. oszlop: üres kamra"), { button: 0, shiftKey: true });
    fireEvent.pointerUp(window);
    expect(cell("3. sor, 7. oszlop: fal")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Visszavonás" }));
    expect(cell("3. sor, 7. oszlop: üres kamra")).toBeTruthy();
    fireEvent.pointerDown(cell("3. sor, 5. oszlop: fal"), { button: 2 });
    fireEvent.pointerUp(window);
    expect(cell("3. sor, 5. oszlop: üres kamra")).toBeTruthy();
  });

  test("egérrel: téglalap húzása, kitöltés, robot elhelyezése és forgatása, rávezetett előnézet", async () => {
    const { user } = await openNew();
    const drag = (from: HTMLElement, to: HTMLElement) => {
      document.elementFromPoint = vi.fn(() => to);
      fireEvent.pointerDown(from, { button: 0 });
      fireEvent.pointerMove(to, { clientX: 1, clientY: 1 });
      fireEvent.pointerUp(window);
    };
    await user.click(screen.getByRole("radio", { name: /Téglalap/ }));
    drag(cell("2. sor, 2. oszlop: üres kamra"), cell("3. sor, 4. oszlop: üres kamra"));
    expect(cell("3. sor, 4. oszlop: fal")).toBeTruthy();
    expect(screen.getByText("Téglalap: 6 mező, Fal")).toBeTruthy();

    await user.click(screen.getByRole("radio", { name: /Kitöltés/ }));
    await user.click(screen.getByRole("radio", { name: /Arany/ }));
    fireEvent.pointerDown(cell("7. sor, 10. oszlop: üres kamra"), { button: 0 });
    fireEvent.pointerUp(window);
    expect(cell("1. sor, 2. oszlop: arany")).toBeTruthy();
    expect(cell("2. sor, 2. oszlop: fal")).toBeTruthy();

    await user.click(screen.getByRole("radio", { name: /Robot/ }));
    fireEvent.pointerDown(cell("5. sor, 5. oszlop: arany"), { button: 0 });
    fireEvent.pointerUp(window);
    expect(cell("5. sor, 5. oszlop: robot, kelet felé")).toBeTruthy();
    fireEvent.pointerDown(cell("5. sor, 5. oszlop: robot, kelet felé"), { button: 0 });
    fireEvent.pointerUp(window);
    expect(cell("5. sor, 5. oszlop: robot, észak felé")).toBeTruthy();

    document.elementFromPoint = vi.fn(() => cell("6. sor, 6. oszlop: arany"));
    fireEvent.pointerMove(screen.getByRole("grid"), { clientX: 2, clientY: 2 });
    expect(document.querySelector('[data-source="hover"]')).not.toBeNull();
    fireEvent.pointerLeave(screen.getByRole("grid"));
    expect(document.querySelector('[data-source="hover"]')).toBeNull();
  });

  test("Shift+nyíl festés közben mozog, a Shift felengedése egy lépésbe zárja", async () => {
    const { user } = await openNew();
    cell("1. sor, 2. oszlop: üres kamra").focus();
    await user.keyboard("{Shift>}{ArrowRight}{ArrowRight}{/Shift}");
    expect(cell("1. sor, 3. oszlop: fal")).toBeTruthy();
    expect(cell("1. sor, 4. oszlop: fal")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Visszavonás" }));
    expect(cell("1. sor, 3. oszlop: üres kamra")).toBeTruthy();
    expect(cell("1. sor, 4. oszlop: üres kamra")).toBeTruthy();
  });

  test("méretváltás a léptetőkkel, egy lépésben visszavonható", async () => {
    const { user } = await openNew();
    await user.click(screen.getByRole("button", { name: "Sorok csökkentése" }));
    expect(screen.getAllByRole("gridcell")).toHaveLength(60);
    await user.click(screen.getByRole("button", { name: "Visszavonás" }));
    expect(screen.getAllByRole("gridcell")).toHaveLength(70);
  });

  test("hibás térképfájl importja érthető hibát ad, és nem tölt be semmit", async () => {
    const { user } = await openNew();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await chooseFile(input, textFile("rossz.txt", "2 3\n>.@\n#.\n"));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("nem érvényes térkép");
    expect(alert.textContent).toContain("3. sor");
    expect(alert.textContent).toContain("Fájl: rossz.txt");
    expect(screen.getAllByRole("gridcell")).toHaveLength(70);
    await user.click(within(alert).getByRole("button", { name: "Bezárás" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("érvényes importálás betölti, az exportálás a kanonikus szöveget tölti le", async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    URL.createObjectURL = vi.fn(() => "blob:map");
    URL.revokeObjectURL = vi.fn();
    const { user } = await openNew();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await chooseFile(input, textFile("jo.txt", "1 3\r\n>.@\r\n"));
    await waitFor(() => expect(screen.getAllByRole("gridcell")).toHaveLength(3));
    expect(await screen.findByText(/A térkép betöltve a fájlból\./)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Exportálás" }));
    expect(click).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("radio", { name: /Fal/ }));
    cell("1. sor, 1. oszlop: robot, kelet felé").focus();
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("button", { name: "Exportálás" }));
    expect(await screen.findByText("Csak érvényes térkép exportálható.")).toBeTruthy();
    expect(click).toHaveBeenCalledOnce();
    click.mockRestore();
  });

  test("elérhetetlen aranyra figyelmeztet, a gomb odaviszi a kurzort, a bejárható rész látszik", async () => {
    const { user } = await openNew();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await chooseFile(input, textFile("zart.txt", "1 3\n>#@\n"));
    const goTo = await screen.findByRole("button", { name: "Ugrás ide: 1. sor, 3. oszlop" });
    expect(cell("1. sor, 3. oszlop: arany, elérhetetlen arany")).toBeTruthy();
    await user.click(goTo);
    expect(document.activeElement).toBe(cell("1. sor, 3. oszlop: arany, elérhetetlen arany"));
    await user.click(screen.getByRole("button", { name: "Bejárható rész" }));
    expect(document.querySelector(".ed-shroud")).not.toBeNull();
  });

  test("a szerver elutasítása hibaüzenetet ad, a mentés megismételhető", async () => {
    onApi("POST", "/maps", () =>
      apiError(422, "MAP_INVALID", "A térkép nem felel meg a szabályoknak."),
    );
    const { user } = await openNew();
    await user.type(screen.getByRole("textbox", { name: /Cím/ }), "X");
    await user.click(saveButton());
    expect(await screen.findByText("A térkép nem felel meg a szabályoknak.")).toBeTruthy();
    expect(screen.getByText("Módosítva")).toBeTruthy();
  });

  test("a láthatatlan karakterből álló cím hiányzónak számít", async () => {
    const { user } = await openNew();
    await user.type(screen.getByRole("textbox", { name: /Cím/ }), "​  ");
    expect(screen.getByText("A térkép címe hiányzik.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Cím megadása" }));
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: /Cím/ }));
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
    expect(screen.getByText(/már 3 futás tartozik.*új verziót hoz létre \(v3\)/)).toBeTruthy();
    expect(screen.getByText("v2 · 3 futás")).toBeTruthy();
    await user.click(screen.getByRole("radio", { name: /Arany/ }));
    cell("2. sor, 1. oszlop: üres kamra").focus();
    await user.keyboard("{Enter}");
    const save = screen.getByRole("button", { name: "Mentés, új verzió: v3" });
    expect(save.textContent).toContain("új verzió: v3");
    await user.click(save);
    expect(await screen.findByText(/új verzióként \(v3\)/)).toBeTruthy();
    expect(callsTo("PUT", "/maps/4")[0]?.body).toMatchObject({ title: "Labirintus" });
    expect(screen.getByText("Mentve")).toBeTruthy();
  });

  test("futás nélkül helyben ment, törlés megerősítéssel a listára visz", async () => {
    respond("GET", "/maps/4", mapDetail(4, "Labirintus", LABYRINTH));
    respond("PUT", "/maps/4", { map: { id: 4 }, createdNewVersion: false });
    respond("DELETE", "/maps/4", { ok: true });
    respond("GET", "/maps", { maps: [] });
    const { user, router } = renderApp("/maps/4/edit");
    expect(await screen.findByText(/még nincs futás/)).toBeTruthy();
    await user.click(saveButton());
    expect(await screen.findByText("A térkép elmentve.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Térkép törlése" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Biztosan törlöd a térképet?" });
    await user.click(within(dialog).getByRole("button", { name: "Végleges törlés" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/maps"));
    expect(callsTo("DELETE", "/maps/4")).toHaveLength(1);
  });

  test("nem mentett módosítással kilépéskor megerősítést kér", async () => {
    respond("GET", "/maps/4", mapDetail(4, "Labirintus", LABYRINTH));
    respond("GET", "/maps", { maps: [] });
    const { user, router } = renderApp("/maps/4/edit");
    await screen.findByRole("grid", { name: "Térképrács" });
    await user.type(screen.getByRole("textbox", { name: /Leírás/ }), " új");
    const back = within(screen.getByRole("main")).getByRole("link", { name: "Pályák" });
    await user.click(back);
    const dialog = await screen.findByRole("alertdialog", { name: "Nem mentett módosítások" });
    await user.click(within(dialog).getByRole("button", { name: "Maradok" }));
    expect(router.state.location.pathname).toBe("/maps/4/edit");
    await user.click(back);
    const again = await screen.findByRole("alertdialog", { name: "Nem mentett módosítások" });
    await user.click(within(again).getByRole("button", { name: "Kilépés mentés nélkül" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/maps"));
  });

  test("idegen térkép nem szerkeszthető", async () => {
    respond("GET", "/maps/5", mapDetail(5, "Idegen", LABYRINTH, { canEdit: false }));
    renderApp("/maps/5/edit");
    expect(await screen.findByText(/csak a készítője vagy egy adminisztrátor/)).toBeTruthy();
  });

  test.each(["/maps/77/edit", "/maps/abc/edit"])("%s: nem létező térkép", async (path) => {
    renderApp(path);
    expect(
      await screen.findByRole("heading", { level: 1, name: "404: nincs ilyen oldal" }),
    ).toBeTruthy();
  });
});
