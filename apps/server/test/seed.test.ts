import { describe, expect, test } from "bun:test";
import { count } from "drizzle-orm";
import { maps, type programs, users } from "../src/db/schema.ts";
import { DEMO_ACCOUNTS, seedDemo } from "../src/seed/index.ts";
import { TUTORIAL_MAPS } from "../src/seed/maps.ts";
import { createTestContext, json } from "./helpers.ts";

describe("demó-seed", () => {
  test("minden oktató térkép érvényes", async () => {
    await using context = await createTestContext();
    const { deps } = context;
    for (const tutorial of TUTORIAL_MAPS) {
      expect(deps.engine.parseMap(tutorial.content).map).not.toBeNull();
    }
    expect(TUTORIAL_MAPS).toHaveLength(8);
  });

  test("idempotens, és a demó-fiókkal be lehet lépni", async () => {
    await using context = await createTestContext();
    const first = await seedDemo(context.deps, { reset: false });
    expect(first.seeded).toBe(true);
    expect(first.users).toBe(DEMO_ACCOUNTS.length);
    expect(first.maps).toBe(8);
    expect(first.runs + first.skippedRuns).toBe(first.programs);

    const second = await seedDemo(context.deps, { reset: false });
    expect(second.seeded).toBe(false);
    const total = async (table: typeof users | typeof maps | typeof programs) => {
      const [row] = await context.deps.db.select({ value: count() }).from(table);
      return row?.value;
    };
    expect(await total(users)).toBe(4);
    expect(await total(maps)).toBe(8);

    const reset = await seedDemo(context.deps, { reset: true });
    expect(reset.seeded).toBe(true);
    expect(await total(maps)).toBe(8);

    const demo = context.client();
    const login = await demo.post("/api/auth/login", { username: "demo1", password: "demo2026" });
    expect(login.status).toBe(200);
    const list = await json<{ maps: { title: string; lampMode: string }[] }>(
      await demo.get("/api/maps"),
    );
    expect(list.maps.map((m) => m.title)).toEqual(TUTORIAL_MAPS.map((m) => m.title));
    expect(list.maps.map((m) => m.lampMode)).toEqual([
      "open",
      "open",
      "open",
      "open",
      "lamp",
      "lamp",
      "dark",
      "dark",
    ]);
  });
});
