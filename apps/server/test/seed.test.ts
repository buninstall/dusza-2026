import { describe, expect, test } from "bun:test";
import { asc, count, eq, gt } from "drizzle-orm";
import { maps, programs, users } from "../src/db/schema.ts";
import { DEMO_ACCOUNTS, seedDemo } from "../src/seed/index.ts";
import { TUTORIAL_MAPS } from "../src/seed/maps.ts";
import { SANDBOX_MAPS } from "../src/seed/sandbox.ts";

const ALL_MAPS = TUTORIAL_MAPS.length + SANDBOX_MAPS.length;

import { createTestContext, json } from "./helpers.ts";

describe("demó-seed", () => {
  test("minden oktató térkép érvényes", async () => {
    await using context = await createTestContext();
    const { deps } = context;
    for (const tutorial of TUTORIAL_MAPS) {
      expect(deps.engine.parseMap(tutorial.content).map).not.toBeNull();
    }
    expect(TUTORIAL_MAPS).toHaveLength(30);
    expect(new Set(TUTORIAL_MAPS.map((tutorial) => tutorial.title)).size).toBe(30);
  });

  test("idempotens, és a demó-fiókkal be lehet lépni", async () => {
    await using context = await createTestContext();
    const first = await seedDemo(context.deps, { reset: false });
    expect(first.seeded).toBe(true);
    expect(first.users).toBe(DEMO_ACCOUNTS.length);
    expect(first.maps).toBe(30);
    expect(first.runs + first.skippedRuns).toBe(first.programs);

    const second = await seedDemo(context.deps, { reset: false });
    expect(second.seeded).toBe(false);
    const total = async (table: typeof users | typeof maps | typeof programs) => {
      const [row] = await context.deps.db.select({ value: count() }).from(table);
      return row?.value;
    };
    expect(await total(users)).toBe(4);
    expect(await total(maps)).toBe(ALL_MAPS);

    const reset = await seedDemo(context.deps, { reset: true });
    expect(reset.seeded).toBe(true);
    expect(await total(maps)).toBe(ALL_MAPS);

    const demo = context.client();
    const login = await demo.post("/api/auth/login", { username: "demo1", password: "demo2026" });
    expect(login.status).toBe(200);
    const list = await json<{ maps: { title: string; lampMode: string }[] }>(
      await demo.get("/api/maps"),
    );
    expect(list.maps.map((m) => m.title)).toEqual([
      ...TUTORIAL_MAPS.map((m) => m.title),
      ...SANDBOX_MAPS.map((m) => m.title),
    ]);
    expect(list.maps.slice(0, 30).map((m) => m.lampMode)).toEqual(
      TUTORIAL_MAPS.map((m) => m.lampMode),
    );
    expect(list.maps.slice(0, 8).map((m) => m.lampMode)).toEqual([
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

  test("a kampány nehézsége kiegyensúlyozott: 10 könnyű, 10 közepes, 10 nehéz pálya", async () => {
    await using context = await createTestContext();
    await seedDemo(context.deps, { reset: false });
    const demo = context.client();
    await demo.post("/api/auth/login", { username: "demo1", password: "demo2026" });
    const list = await json<{ maps: { title: string; difficulty: string | null }[] }>(
      await demo.get("/api/maps"),
    );
    const campaign = new Set(TUTORIAL_MAPS.map((m) => m.title));
    const tally = new Map<string | null, number>();
    for (const map of list.maps.filter((m) => campaign.has(m.title)))
      tally.set(map.difficulty, (tally.get(map.difficulty) ?? 0) + 1);
    expect(Object.fromEntries(tally)).toEqual({ easy: 10, medium: 10, hard: 10 });
  });

  test("a régi, nyolc pályás adatbázis induláskor megkapja a teljes kampányt", async () => {
    await using context = await createTestContext();
    const { db } = context.deps;
    await seedDemo(context.deps, { reset: false });
    await db.delete(maps).where(gt(maps.id, 8));
    await db
      .update(maps)
      .set({ description: "Egyetlen sor, két aranyrög. Elég a step forward és a mine here." })
      .where(eq(maps.title, "1. Egyenes folyosó"));
    await db
      .update(maps)
      .set({ description: "Saját leírás." })
      .where(eq(maps.title, "2. Az első kanyar"));
    const [demo] = await db.select({ id: users.id }).from(users).where(eq(users.username, "demo1"));
    await db.delete(programs).where(eq(programs.ownerId, demo?.id ?? 0));

    const again = await seedDemo(context.deps, { reset: false });
    expect(again.seeded).toBe(false);
    const rows = await db
      .select({ title: maps.title, description: maps.description, parSteps: maps.parSteps })
      .from(maps)
      .orderBy(asc(maps.createdAt), asc(maps.id));
    expect(rows.map((row) => row.title)).toEqual([
      ...TUTORIAL_MAPS.map((m) => m.title),
      ...SANDBOX_MAPS.map((m) => m.title),
    ]);
    expect(rows[0]?.description).toBe(TUTORIAL_MAPS[0]?.description);
    expect(rows[1]?.description).toBe("Saját leírás.");
    expect(rows.every((row) => row.parSteps !== null)).toBe(true);
    const library = await db
      .select({ value: count() })
      .from(programs)
      .where(eq(programs.ownerId, demo?.id ?? 0));
    expect(library[0]?.value).toBeGreaterThan(30);

    const third = await seedDemo(context.deps, { reset: false });
    expect(third.seeded).toBe(false);
    const [total] = await db.select({ value: count() }).from(maps);
    expect(total?.value).toBe(ALL_MAPS);
  });
});
