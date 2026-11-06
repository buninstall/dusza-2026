import { describe, expect, test } from "bun:test";
import { count } from "drizzle-orm";
import { runs } from "../src/db/schema.ts";
import { createTestContext, type ErrorBody, json, SPEC_MAP } from "./helpers.ts";

describe("futások", () => {
  test("a szintaktikailag hibás program 422, és nem kerül mentésre", async () => {
    const context = await createTestContext();
    const user = context.client();
    await user.register("futtato");
    const { map } = await json<{ map: { currentVersionId: number } }>(
      await user.post("/api/maps", { title: "Pálya", content: SPEC_MAP }),
    );
    const response = await user.post("/api/runs", {
      mapVersionId: map.currentVersionId,
      source: "Step forward 1",
    });
    expect(response.status).toBe(422);
    const body = await json<ErrorBody>(response);
    expect(body.error.code).toBe("SYNTAX_ERROR");
    expect(Array.isArray(body.error.details)).toBe(true);
    const stored = context.deps.db.select({ value: count() }).from(runs).get();
    expect(stored?.value).toBe(0);
  });

  test("a befejezett futást a szerver számolja és menti", async () => {
    const context = await createTestContext();
    const user = context.client();
    await user.register("futtato");
    const { map } = await json<{ map: { id: number; currentVersionId: number } }>(
      await user.post("/api/maps", { title: "Pálya", content: SPEC_MAP }),
    );
    const response = await user.post("/api/runs", {
      mapVersionId: map.currentVersionId,
      source: "",
      gold: 999,
    });
    expect(response.status).toBe(201);
    const body = await json<{ run: { gold: number; steps: number; outcomeKind: string } }>(
      response,
    );
    expect(body.run).toMatchObject({ gold: 0, steps: 0, outcomeKind: "ok" });

    const mine = await json<{ runs: { mapTitle: string }[] }>(await user.get("/api/me/runs"));
    expect(mine.runs.map((r) => r.mapTitle)).toEqual(["Pálya"]);
  });

  test("nem létező térképverzió 404", async () => {
    const context = await createTestContext();
    const user = context.client();
    await user.register("futtato");
    const response = await user.post("/api/runs", { mapVersionId: 9999, source: "" });
    expect(response.status).toBe(404);
  });

  test("bejelentkezés nélkül 401", async () => {
    const context = await createTestContext();
    const response = await context.client().post("/api/runs", { mapVersionId: 1, source: "" });
    expect(response.status).toBe(401);
  });
});
