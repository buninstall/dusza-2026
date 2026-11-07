import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { apiError, onApi, respond } from "./support/api.ts";
import { renderApp } from "./support/app.tsx";
import { CORRIDOR, mapDetail } from "./support/fixtures.ts";

describe("hibaképernyők", () => {
  test("a munkamenet hibája üzemzavart mutat, az újrapróbálás betölti az oldalt", async () => {
    let attempts = 0;
    respond("GET", "/maps", { maps: [] });
    const { user } = renderApp("/maps", "none");
    onApi("GET", "/auth/me", () => {
      attempts += 1;
      return attempts < 2
        ? apiError(500, "INTERNAL", "A szerver hibát jelzett.")
        : { body: { user: { id: 2, username: "demo1", role: "user", createdAt: 1 } } };
    });
    expect(await screen.findByText("Üzemzavar", undefined, { timeout: 5000 })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Újrapróbálás" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Pályák" }, { timeout: 5000 }),
    ).toBeTruthy();
  });

  test("a hibás tartalmú térkép nem tölt be, az ismeretlen térkép hibát ad", async () => {
    respond("GET", "/maps/1", mapDetail(1, "Jó", CORRIDOR));
    onApi("GET", "/maps/2", () => ({
      body: {
        ...mapDetail(2, "Rossz", CORRIDOR),
        version: { ...mapDetail(2, "Rossz", CORRIDOR).version, content: "x" },
      },
    }));
    renderApp("/play/2");
    expect(await screen.findByText("A térkép nem tölthető be.")).toBeTruthy();
  });

  test("az ismeretlen vagy hibás azonosítójú pálya a beomlott járatot mutatja", async () => {
    renderApp("/play/404");
    expect(
      await screen.findByRole("heading", { level: 1, name: "404: nincs ilyen oldal" }),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Vissza a pályákhoz" })).toBeTruthy();
  });

  test.each(["/play/abc", "/play/0", "/play/99999"])("%s nem létező pálya", async (path) => {
    renderApp(path);
    expect(
      await screen.findByRole("heading", { level: 1, name: "404: nincs ilyen oldal" }),
    ).toBeTruthy();
  });
});
