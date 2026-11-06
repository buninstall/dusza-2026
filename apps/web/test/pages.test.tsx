import { act, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { toast } from "../src/components/ui/Toast.tsx";
import { apiError, callsTo, onApi, respond } from "./support/api.ts";
import { renderApp } from "./support/app.tsx";
import { CORRIDOR, demoUser, LABYRINTH, mapSummary } from "./support/fixtures.ts";

const MAPS = [mapSummary(1, "Folyosó", CORRIDOR), mapSummary(2, "Labirintus", LABYRINTH, 2)];

describe("térképlista", () => {
  test("szintenként mutatja a térképeket, a szerkesztés csak a sajátnál látszik", async () => {
    respond("GET", "/maps", { maps: MAPS });
    renderApp("/maps");
    const list = await screen.findByRole("list", { name: "Térképek listája" });
    const levels = within(list).getAllByRole("listitem");
    expect(levels).toHaveLength(2);
    expect(within(levels[0] as HTMLElement).getByText("01. szint")).toBeTruthy();
    expect(within(levels[0] as HTMLElement).getByText("1×8")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Játék: Folyosó" }).getAttribute("href")).toBe(
      "/play/1",
    );
    expect(screen.getByRole("link", { name: "Ranglista: Labirintus" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Szerkesztés: Folyosó" })).toBeNull();
    expect(screen.getByRole("link", { name: "Szerkesztés: Labirintus" })).toBeTruthy();
  });

  test("a Sajátjaim fül a scope=mine lekérdezést használja, üresen tippet ad", async () => {
    onApi("GET", "/maps", (request) => ({
      body: { maps: request.search.get("scope") === "mine" ? [] : MAPS },
    }));
    const { user } = renderApp("/maps");
    await screen.findByRole("list", { name: "Térképek listája" });
    await user.click(screen.getByRole("tab", { name: "Sajátjaim" }));
    expect(await screen.findByText(/Még nem készítettél térképet/)).toBeTruthy();
    expect(callsTo("GET", "/maps").some((call) => call.search.get("scope") === "mine")).toBe(true);
  });

  test("az admin minden térképet szerkeszthet, a privát térkép jelölve", async () => {
    respond("GET", "/maps", {
      maps: [{ ...mapSummary(3, "Titkos", CORRIDOR, 2), visibility: "private" }],
    });
    renderApp("/maps", "admin");
    expect(await screen.findByRole("link", { name: "Szerkesztés: Titkos" })).toBeTruthy();
    expect(screen.getByText("Privát")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Felhasználók" })).toBeTruthy();
  });

  test("betöltési hiba magyar üzenettel", async () => {
    onApi("GET", "/maps", () => apiError(500, "INTERNAL", "Belső hiba történt."));
    renderApp("/maps");
    expect((await screen.findByRole("alert", undefined, { timeout: 4000 })).textContent).toContain(
      "Belső hiba történt.",
    );
  });
});

const BOARD = {
  mapId: 2,
  title: "Labirintus",
  versionId: 22,
  currentVersionId: 22,
  versions: [
    { id: 21, version: 1, createdAt: 1 },
    { id: 22, version: 2, createdAt: 2 },
  ],
  entries: [
    {
      rank: 1,
      runId: 9,
      userId: 3,
      username: "demo2",
      gold: 2,
      steps: 30,
      outcomeKind: "ok",
      createdAt: 5,
    },
    {
      rank: 2,
      runId: 7,
      userId: 2,
      username: "demo1",
      gold: 2,
      steps: 41,
      outcomeKind: "runtimeError",
      createdAt: 3,
    },
    {
      rank: 3,
      runId: 4,
      userId: 4,
      username: "demo3",
      gold: 1,
      steps: 12,
      outcomeKind: "ok",
      createdAt: 1,
    },
    {
      rank: 4,
      runId: 2,
      userId: 5,
      username: "uj",
      gold: 0,
      steps: 3,
      outcomeKind: "ok",
      createdAt: 1,
    },
  ],
};

describe("ranglista", () => {
  test("a szerver sorrendjében, a saját sor kiemelve", async () => {
    respond("GET", "/maps/2/leaderboard", BOARD);
    renderApp("/leaderboard/2");
    const table = await screen.findByRole("table", { name: "Ranglista: Labirintus, 2. verzió" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getByRole("rowheader").textContent)).toEqual([
      "demo2",
      "demo1te",
      "demo3",
      "uj",
    ]);
    expect(within(rows[1] as HTMLElement).getByText("te")).toBeTruthy();
    expect(within(rows[1] as HTMLElement).getByText("futásidejű hiba")).toBeTruthy();
    expect(rows[0]?.getAttribute("data-podium")).toBe("true");
    expect(rows[3]?.getAttribute("data-podium")).toBe("false");
  });

  test("verzióváltás a keresési paraméterbe kerül", async () => {
    onApi("GET", "/maps/2/leaderboard", (request) => ({
      body:
        request.search.get("version") === "21" ? { ...BOARD, versionId: 21, entries: [] } : BOARD,
    }));
    const { user, router } = renderApp("/leaderboard/2");
    await user.click(await screen.findByRole("button", { name: /Verzió/ }));
    await user.click(screen.getByRole("option", { name: "1. verzió" }));
    expect(await screen.findByText(/még senki nem futtatott/)).toBeTruthy();
    expect(router.state.location.search).toEqual({ version: 21 });
  });
});

describe("futásaim", () => {
  test("a kimenet hibakóddal és sorral", async () => {
    respond("GET", "/me/runs", {
      runs: [
        {
          id: 1,
          mapId: 2,
          mapTitle: "Labirintus",
          mapVersionId: 22,
          version: 2,
          gold: 1,
          steps: 9,
          outcomeKind: "runtimeError",
          errorCode: "E_NO_GOLD",
          errorLine: 4,
          createdAt: 1,
        },
        {
          id: 2,
          mapId: 1,
          mapTitle: "Folyosó",
          mapVersionId: 11,
          version: 1,
          gold: 2,
          steps: 8,
          outcomeKind: "ok",
          errorCode: null,
          errorLine: null,
          createdAt: 2,
        },
      ],
    });
    renderApp("/runs");
    expect(await screen.findByText("E_NO_GOLD, 4. sor")).toBeTruthy();
    expect(screen.getByText("hiba nélkül")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Labirintus" }).getAttribute("href")).toBe(
      "/leaderboard/2",
    );
  });

  test("üres napló", async () => {
    respond("GET", "/me/runs", { runs: [] });
    renderApp("/runs");
    expect(await screen.findByText(/Még nincs rögzített futásod/)).toBeTruthy();
  });
});

describe("adminisztráció", () => {
  const USERS = [
    { id: 1, username: "admin", role: "admin", createdAt: 1 },
    { id: 2, username: "demo1", role: "user", createdAt: 2 },
  ];

  test("szerepkör váltása és fiók törlése megerősítéssel, saját sor érinthetetlen", async () => {
    respond("GET", "/admin/users", { users: USERS });
    respond("PATCH", "/admin/users/2", { user: { ...USERS[1], role: "admin" } });
    respond("DELETE", "/admin/users/2", { ok: true });
    const { user } = renderApp("/admin", "admin");
    await user.click(await screen.findByRole("button", { name: "Adminná tétel: demo1" }));
    await waitFor(() =>
      expect(callsTo("PATCH", "/admin/users/2")[0]?.body).toEqual({ role: "admin" }),
    );
    expect(screen.queryByRole("button", { name: "Törlés: admin" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Törlés: demo1" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Biztosan törlöd a fiókot?" });
    await user.click(within(dialog).getByRole("button", { name: "Törlés" }));
    await waitFor(() => expect(callsTo("DELETE", "/admin/users/2")).toHaveLength(1));
    expect(await screen.findByText("demo1 fiókja törölve.")).toBeTruthy();
  });

  test("hibás művelet hibaüzenetet ad, a nem admin visszakerül a térképekhez", async () => {
    respond("GET", "/admin/users", { users: USERS });
    onApi("PATCH", "/admin/users/2", () => apiError(409, "SELF_CHANGE", "Nem módosítható."));
    const { user } = renderApp("/admin", "admin");
    await user.click(await screen.findByRole("button", { name: "Adminná tétel: demo1" }));
    expect(await screen.findByText("Nem módosítható.")).toBeTruthy();
  });

  test("játékos nem éri el", async () => {
    respond("GET", "/maps", { maps: [] });
    const { router } = renderApp("/admin");
    await screen.findByRole("heading", { level: 1, name: "Térképek" });
    expect(router.state.location.pathname).toBe("/maps");
  });
});

describe("keret, kézikönyv és hibaképernyők", () => {
  test("a kézikönyv tartalomjegyzéke a fejezetekre ugrik, a kód kiemelt", async () => {
    renderApp("/manual");
    const toc = await screen.findByRole("navigation", { name: "Tartalom" });
    const links = within(toc).getAllByRole("link");
    expect(links.length).toBeGreaterThan(8);
    expect(links[0]?.getAttribute("href")).toBe("#alapok");
    expect(screen.getByRole("heading", { level: 2, name: /Lépésszámlálás/ })).toBeTruthy();
    expect(document.querySelector('[data-token="keyword"]')?.textContent).toBe("set");
    expect(screen.getByRole("table", { name: "Futásidejű hibakódok" })).toBeTruthy();
  });

  test("kijelentkezés a felhasználói menüből", async () => {
    respond("GET", "/maps", { maps: [] });
    respond("POST", "/auth/logout", { ok: true });
    const { user, router } = renderApp("/maps");
    await user.click(
      await screen.findByRole("button", { name: `Felhasználói menü: ${demoUser.username}` }),
    );
    await user.click(await screen.findByRole("menuitem", { name: "Kijelentkezés" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(callsTo("POST", "/auth/logout")).toHaveLength(1);
  });

  test("kijelentkezéskor az előző felhasználó értesítései eltűnnek", async () => {
    respond("GET", "/maps", { maps: [] });
    respond("POST", "/auth/logout", { ok: true });
    const { user, router } = renderApp("/maps");
    act(() => {
      toast.success("demo2 fiókja törölve.");
    });
    expect(await screen.findByText("demo2 fiókja törölve.")).toBeTruthy();
    await user.click(
      await screen.findByRole("button", { name: `Felhasználói menü: ${demoUser.username}` }),
    );
    await user.click(await screen.findByRole("menuitem", { name: "Kijelentkezés" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    await waitFor(() => expect(screen.queryByText("demo2 fiókja törölve.")).toBeNull());
  });

  test("ismeretlen útvonalon beomlott járat", async () => {
    renderApp("/nincs-ilyen");
    expect(await screen.findByRole("heading", { name: "Ez a járat beomlott" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Vissza a térképekhez" })).toBeTruthy();
  });

  test("a gyökér a térképekhez irányít", async () => {
    respond("GET", "/maps", { maps: [] });
    const { router } = renderApp("/");
    await screen.findByRole("heading", { level: 1, name: "Térképek" });
    expect(router.state.location.pathname).toBe("/maps");
  });
});
