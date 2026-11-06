import { screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { passwordProblem, usernameProblem } from "../src/auth/credentials.ts";
import { safeRedirect } from "../src/auth/session.ts";
import { apiError, callsTo, onApi, respond } from "./support/api.ts";
import { renderApp } from "./support/app.tsx";
import { CORRIDOR, demoUser, mapSummary } from "./support/fixtures.ts";

describe("bejelentkezési szabályok", () => {
  test("a felhasználónév 3–24 karakter, csak angol betű, szám és aláhúzás", () => {
    expect(usernameProblem("")).toMatch(/Add meg/);
    expect(usernameProblem("ab")).toMatch(/3–24/);
    expect(usernameProblem("a".repeat(25))).toMatch(/3–24/);
    expect(usernameProblem("árvíz")).toMatch(/angol betű/);
    expect(usernameProblem("demo_1")).toBeNull();
  });

  test("a jelszó legalább 8 karakter", () => {
    expect(passwordProblem("")).toMatch(/Add meg/);
    expect(passwordProblem("rövid")).toMatch(/8 karakter/);
    expect(passwordProblem("hosszujelszo")).toBeNull();
  });

  test("az átirányítás csak saját, relatív útvonalra mehet", () => {
    expect(safeRedirect("/play/3")).toBe("/play/3");
    expect(safeRedirect("//evil.example")).toBe("/maps");
    expect(safeRedirect("https://evil.example")).toBe("/maps");
    expect(safeRedirect(undefined)).toBe("/maps");
  });
});

describe("bejelentkezés és regisztráció", () => {
  test("védett oldal kijelentkezve a belépéshez irányít, belépés után visszavisz", async () => {
    const { user, router } = renderApp("/runs", "none");
    respond("POST", "/auth/login", { user: demoUser });
    respond("GET", "/me/runs", { runs: [] });
    expect(await screen.findByRole("heading", { level: 1, name: "Bejelentkezés" })).toBeTruthy();
    expect(router.state.location.pathname).toBe("/login");

    await user.type(screen.getByLabelText("Felhasználónév"), "demo1");
    await user.type(screen.getByLabelText("Jelszó"), "demo2026");
    await user.click(screen.getByRole("button", { name: "Belépés" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Futásaim" })).toBeTruthy();
    expect(callsTo("POST", "/auth/login")[0]?.body).toEqual({
      username: "demo1",
      password: "demo2026",
    });
  });

  test("hibás belépésnél a szerver magyar üzenete látszik", async () => {
    const { user } = renderApp("/login", "none");
    onApi("POST", "/auth/login", () =>
      apiError(401, "INVALID_CREDENTIALS", "Hibás felhasználónév vagy jelszó."),
    );
    await user.type(await screen.findByLabelText("Felhasználónév"), "demo1");
    await user.type(screen.getByLabelText("Jelszó"), "rosszjelszo");
    await user.click(screen.getByRole("button", { name: "Belépés" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Hibás felhasználónév vagy jelszó.",
    );
  });

  test("a regisztráció ellenőrzi a mezőket, majd a térképekhez visz", async () => {
    const { user } = renderApp("/register", "none");
    respond("POST", "/auth/register", { user: { ...demoUser, username: "uj_banyasz" } }, 201);
    respond("GET", "/maps", { maps: [mapSummary(1, "Folyosó", CORRIDOR)] });
    await user.type(await screen.findByLabelText(/Felhasználónév/), "ab");
    await user.type(screen.getByLabelText(/Jelszó/), "rovid");
    await user.click(screen.getByRole("button", { name: "Fiók létrehozása" }));
    expect(await screen.findByText(/3–24 karakter hosszú/)).toBeTruthy();
    expect(callsTo("POST", "/auth/register")).toHaveLength(0);

    await user.clear(screen.getByLabelText(/Felhasználónév/));
    await user.type(screen.getByLabelText(/Felhasználónév/), "uj_banyasz");
    await user.clear(screen.getByLabelText(/Jelszó/));
    await user.type(screen.getByLabelText(/Jelszó/), "hosszujelszo");
    await user.click(screen.getByRole("button", { name: "Fiók létrehozása" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Térképek" })).toBeTruthy();
    await waitFor(() => expect(callsTo("POST", "/auth/register")).toHaveLength(1));
  });
});
