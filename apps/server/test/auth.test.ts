import { describe, expect, test } from "bun:test";
import { createTestContext, type ErrorBody, json } from "./helpers.ts";

describe("hitelesítés", () => {
  test("regisztráció, me, kijelentkezés", async () => {
    await using context = await createTestContext();
    const { client } = context;
    const user = client();
    const registered = await user.register("banyasz");
    expect(registered.user.username).toBe("banyasz");

    const me = await user.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect((await json<{ user: { username: string } }>(me)).user.username).toBe("banyasz");

    expect((await user.post("/api/auth/logout")).status).toBe(200);
    const after = await user.get("/api/auth/me");
    expect(after.status).toBe(401);
    expect((await json<ErrorBody>(after)).error.code).toBe("UNAUTHENTICATED");
  });

  test("a session cookie HttpOnly és SameSite=Lax", async () => {
    await using context = await createTestContext();
    const { client } = context;
    const response = await client().post("/api/auth/register", {
      username: "cookie_teszt",
      password: "jelszo1234",
    });
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("ms_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
  });

  test("login helyes és hibás jelszóval", async () => {
    await using context = await createTestContext();
    const { client } = context;
    await client().register("robot");
    const user = client();
    const wrong = await user.post("/api/auth/login", {
      username: "robot",
      password: "rossz-jelszo",
    });
    expect(wrong.status).toBe(401);
    expect((await json<ErrorBody>(wrong)).error.code).toBe("INVALID_CREDENTIALS");
    const ok = await user.post("/api/auth/login", { username: "robot", password: "jelszo1234" });
    expect(ok.status).toBe(200);
    expect((await user.get("/api/auth/me")).status).toBe(200);
  });

  test("a foglalt név kis- és nagybetűtől függetlenül foglalt", async () => {
    await using context = await createTestContext();
    const { client } = context;
    await client().register("Kincs");
    const response = await client().post("/api/auth/register", {
      username: "kincs",
      password: "jelszo1234",
    });
    expect(response.status).toBe(409);
  });

  test("a hibás felhasználónév és a rövid jelszó 400", async () => {
    await using context = await createTestContext();
    const { client } = context;
    const badName = await client().post("/api/auth/register", {
      username: "a-b",
      password: "jelszo1234",
    });
    expect(badName.status).toBe(400);
    const body = await json<ErrorBody>(badName);
    expect(body.error.code).toBe("VALIDATION");
    const shortPassword = await client().post("/api/auth/register", {
      username: "rendes",
      password: "rovid",
    });
    expect(shortPassword.status).toBe(400);
  });

  test("percenként legfeljebb 5 bejelentkezési kísérlet", async () => {
    await using context = await createTestContext();
    await context.client().register("celpont");
    const attacker = context.client();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await attacker.post("/api/auth/login", {
        username: "celpont",
        password: "rossz-jelszo",
      });
      expect(response.status).toBe(401);
    }
    const blocked = await attacker.post("/api/auth/login", {
      username: "celpont",
      password: "jelszo1234",
    });
    expect(blocked.status).toBe(429);
    context.advance(61_000);
    const later = await attacker.post("/api/auth/login", {
      username: "celpont",
      password: "jelszo1234",
    });
    expect(later.status).toBe(200);
  });

  test("lejárt session nem érvényes", async () => {
    await using context = await createTestContext();
    const user = context.client();
    await user.register("lejaro");
    context.advance(31 * 24 * 60 * 60 * 1000);
    expect((await user.get("/api/auth/me")).status).toBe(401);
  });
});
