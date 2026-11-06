import { describe, expect, test } from "bun:test";
import { createTestContext, type ErrorBody, json } from "./helpers.ts";

describe("CSRF Origin-ellenőrzés", () => {
  test("Origin nélküli POST elutasítva", async () => {
    await using context = await createTestContext();
    const { client } = context;
    const response = await client().request(
      "POST",
      "/api/auth/login",
      { username: "valaki", password: "jelszo1234" },
      { Origin: "" },
    );
    expect(response.status).toBe(403);
    expect((await json<ErrorBody>(response)).error.code).toBe("CSRF_ORIGIN");
  });

  test("idegen Origin elutasítva", async () => {
    await using context = await createTestContext();
    const { client } = context;
    const response = await client().request(
      "POST",
      "/api/auth/register",
      { username: "valaki", password: "jelszo1234" },
      { Origin: "https://gonosz.example" },
    );
    expect(response.status).toBe(403);
  });

  test("a GET kérésekhez nem kell Origin", async () => {
    await using context = await createTestContext();
    const { client } = context;
    const response = await client().get("/api/health");
    expect(response.status).toBe(200);
    const body = await json<{ ok: boolean; engineVersion: string }>(response);
    expect(body.ok).toBe(true);
    expect(body.engineVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("biztonsági fejlécek és CSP", async () => {
    await using context = await createTestContext();
    const { client } = context;
    const response = await client().get("/api/health");
    const csp = response.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  test("ismeretlen API-útvonal egységes 404", async () => {
    await using context = await createTestContext();
    const { client } = context;
    const response = await client().get("/api/nincs-ilyen");
    expect(response.status).toBe(404);
    expect((await json<ErrorBody>(response)).error.code).toBe("NOT_FOUND");
  });
});
