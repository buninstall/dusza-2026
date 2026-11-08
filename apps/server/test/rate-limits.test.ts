import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { createLoginLimiter, createRateLimits, RATE_LIMITS } from "../src/auth/rate-limit.ts";
import { createTestContext, type ErrorBody, json, SPEC_MAP } from "./helpers.ts";
import { TEST_TIMEOUT_MS } from "./timeout.ts";

setDefaultTimeout(TEST_TIMEOUT_MS);

const MINUTE = 60_000;

describe("terhelési korlátok", () => {
  test("a regisztráció címenként korlátozott, és az idő múlásával újra engedett", async () => {
    await using context = await createTestContext();
    context.deps.rates = createRateLimits(context.deps.now);
    for (let index = 0; index < RATE_LIMITS.register.limit; index += 1) {
      const response = await context
        .client()
        .post("/api/auth/register", { username: `ujonc_${index}`, password: "titkos123" });
      expect(response.status).toBe(201);
    }
    const blocked = await context
      .client()
      .post("/api/auth/register", { username: "ujonc_tobb", password: "titkos123" });
    expect(blocked.status).toBe(429);
    expect((await json<ErrorBody>(blocked)).error.code).toBe("RATE_LIMITED");
    context.advance(RATE_LIMITS.register.windowMs + 1);
    const later = await context
      .client()
      .post("/api/auth/register", { username: "ujonc_kesobb", password: "titkos123" });
    expect(later.status).toBe(201);
  });

  test("a belépés címenként is korlátozott, nem csak felhasználónként", async () => {
    await using context = await createTestContext();
    context.deps.rates = {
      ...createRateLimits(context.deps.now),
      loginAddress: createLoginLimiter({ limit: 3, windowMs: MINUTE, now: context.deps.now }),
    };
    const guesser = context.client();
    for (const name of ["anna", "bela", "csaba"]) {
      const response = await guesser.post("/api/auth/login", {
        username: name,
        password: "rossz123",
      });
      expect(response.status).toBe(401);
    }
    const blocked = await guesser.post("/api/auth/login", {
      username: "dora",
      password: "rossz123",
    });
    expect(blocked.status).toBe(429);
  });

  test("a futások felhasználónként korlátozottak, a többi játékos közben futtathat", async () => {
    await using context = await createTestContext();
    const player = context.client();
    await player.register("sietos");
    const other = context.client();
    await other.register("turelmes");
    const { map } = await json<{ map: { currentVersionId: number } }>(
      await player.post("/api/maps", { title: "Korlát", content: SPEC_MAP }),
    );
    context.deps.rates = {
      ...createRateLimits(context.deps.now),
      runs: createLoginLimiter({ limit: 2, windowMs: MINUTE, now: context.deps.now }),
    };
    const run = { mapVersionId: map.currentVersionId, source: "print 1" };
    expect((await player.post("/api/runs", run)).status).toBe(201);
    expect((await player.post("/api/runs", run)).status).toBe(201);
    expect((await player.post("/api/runs", run)).status).toBe(429);
    expect((await other.post("/api/runs", run)).status).toBe(201);
    context.advance(MINUTE + 1);
    expect((await player.post("/api/runs", run)).status).toBe(201);
  });

  test("a módosító kérések címenként korlátozottak, az olvasás közben is működik", async () => {
    await using context = await createTestContext();
    const player = context.client();
    await player.register("irogato");
    context.deps.rates = {
      ...createRateLimits(context.deps.now),
      writes: createLoginLimiter({ limit: 2, windowMs: MINUTE, now: context.deps.now }),
    };
    const program = { title: "Próba", source: "print 1\n" };
    expect((await player.post("/api/programs", program)).status).toBe(201);
    expect((await player.post("/api/programs", program)).status).toBe(201);
    expect((await player.post("/api/programs", program)).status).toBe(429);
    expect((await player.get("/api/programs")).status).toBe(200);
  });
});
