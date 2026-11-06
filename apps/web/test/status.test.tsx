import { screen, waitFor } from "@testing-library/react";
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
      return attempts < 4
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

  test("az ismeretlen térkép lejátszása hibaüzenetet ad", async () => {
    renderApp("/play/404");
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("GET /maps/404"));
  });
});
