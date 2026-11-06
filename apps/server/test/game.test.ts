import { describe, expect, test } from "bun:test";
import { maps } from "../src/db/schema.ts";
import { loadEngine } from "../src/engine.ts";
import { seedDemo } from "../src/seed/index.ts";
import { dailyPlan, dayKey } from "../src/services/daily.ts";
import { computeParSteps, generateLayout, generateMap } from "../src/services/generator.ts";
import { solveRoute } from "../src/services/route-solver.ts";
import { starsFor } from "../src/services/stars.ts";
import { createTestContext, type ErrorBody, json } from "./helpers.ts";

type Summary = {
  id: number;
  title: string;
  parSteps: number | null;
  best: { gold: number; steps: number } | null;
  stars: number | null;
  likes: number;
  likedByMe: boolean;
};

type Standing = {
  standing: {
    stars: { run: number; best: number; previous: number; parSteps: number | null } | null;
  };
};

const CORRIDOR = "1 6\n>.@.@.\n";

describe("csillagok", () => {
  test("arany nélkül nincs csillag, az összes arany 2, a célérték alatt 3", () => {
    expect(starsFor(null, 0, null)).toBeNull();
    expect(starsFor(null, 3, 10)).toBe(0);
    expect(starsFor({ gold: 0, steps: 5 }, 3, 10)).toBe(0);
    expect(starsFor({ gold: 2, steps: 5 }, 3, 10)).toBe(1);
    expect(starsFor({ gold: 3, steps: 11 }, 3, 10)).toBe(2);
    expect(starsFor({ gold: 3, steps: 10 }, 3, 10)).toBe(3);
    expect(starsFor({ gold: 3, steps: 1 }, 3, null)).toBe(2);
  });
});

describe("útvonaltervező és generátor", () => {
  test("a tervező programja kibányássza az összes elérhető aranyat", async () => {
    const engine = await loadEngine();
    const content = "7 7\nv#...@#\n.#.#.##\n.#.#...\n...#.#@\n##.#.#.\n@..#...\n#######\n";
    const map = engine.parseMap(content).map;
    if (!map) {
      throw new Error("hibás tesztpálya");
    }
    const program = solveRoute(map) ?? "";
    const result = engine.run(program, content);
    expect(result.outcome.kind).toBe("ok");
    expect(result.gold).toBe(3);
    expect(computeParSteps(engine, content)).toBe(result.steps);
    expect(computeParSteps(engine, "1 3\n>.#\n")).toBeNull();
  });

  test("a generátor determinisztikus, és mindig megoldható pályát ad", async () => {
    const engine = await loadEngine();
    const input = { rows: 11, cols: 13, difficulty: "medium", seed: 42 } as const;
    expect(generateLayout(input)).toBe(generateLayout(input));
    for (const difficulty of ["easy", "medium", "hard"] as const) {
      for (const [rows, cols, seed] of [
        [5, 5, 1],
        [10, 14, 2],
        [15, 15, 3],
        [6, 9, 4],
      ] as const) {
        const generated = generateMap(engine, { rows, cols, difficulty, seed });
        const parsed = engine.parseMap(generated.content);
        expect(parsed.map?.rows).toBe(rows);
        expect(parsed.map?.cols).toBe(cols);
        const info = parsed.map ? engine.mapInfo(parsed.map) : null;
        expect(info?.goldTotal).toBeGreaterThan(0);
        expect(info?.reachableGold).toBe(info?.goldTotal ?? -1);
        expect(generated.parSteps).toBeGreaterThan(0);
      }
    }
  });

  test("a napi terv a budapesti naptól függ", () => {
    expect(dayKey(Date.parse("2026-11-06T22:30:00Z"))).toBe("2026-11-06");
    expect(dayKey(Date.parse("2026-11-06T23:30:00Z"))).toBe("2026-11-07");
    expect(dailyPlan("2026-11-06")).toEqual(dailyPlan("2026-11-06"));
    expect(dailyPlan("2026-11-06").seed).not.toBe(dailyPlan("2026-11-07").seed);
  });
});

describe("haladás, célérték és tetszés", () => {
  test("a lista a saját legjobbat és a csillagokat mutatja", async () => {
    await using context = await createTestContext();
    const player = context.client();
    await player.register("banyasz");
    const created = await player.post("/api/maps", {
      title: "Folyosó",
      content: CORRIDOR,
      parSteps: 4,
    });
    expect(created.status).toBe(201);
    const { map } = await json<{ map: { id: number; currentVersionId: number } }>(created);
    const list = async () =>
      (await json<{ maps: Summary[] }>(await player.get("/api/maps"))).maps[0];
    expect(await list()).toMatchObject({ parSteps: 4, best: null, stars: 0, likes: 0 });

    const run = async (source: string) =>
      json<Standing>(
        await player.post("/api/runs", { mapVersionId: map.currentVersionId, source }),
      );
    expect((await run("step forward 2\nmine here")).standing.stars).toEqual({
      run: 1,
      best: 1,
      previous: 0,
      parSteps: 4,
    });
    expect(
      (await run("step forward 1\nstep forward 1\nmine here\nstep forward 2\nmine here")).standing
        .stars,
    ).toEqual({ run: 2, best: 2, previous: 1, parSteps: 4 });
    expect(
      (await run("step forward 2\nmine here\nstep forward 2\nmine here")).standing.stars,
    ).toEqual({ run: 3, best: 3, previous: 2, parSteps: 4 });
    expect((await run("print 1")).standing.stars).toEqual({
      run: 0,
      best: 3,
      previous: 3,
      parSteps: 4,
    });
    expect(await list()).toMatchObject({ best: { gold: 2, steps: 4 }, stars: 3 });

    const updated = await player.put(`/api/maps/${map.id}`, { parSteps: null });
    expect(updated.status).toBe(200);
    expect(await list()).toMatchObject({ parSteps: null, stars: 2 });
    const invalid = await player.put(`/api/maps/${map.id}`, { parSteps: 0 });
    expect(invalid.status).toBe(400);
  });

  test("tetszést csak az jelölhet, aki már futtatott a pályán", async () => {
    await using context = await createTestContext();
    const owner = context.client();
    await owner.register("gazda");
    const { map } = await json<{ map: { id: number; currentVersionId: number } }>(
      await owner.post("/api/maps", { title: "Tetszik", content: CORRIDOR }),
    );
    const fan = context.client();
    await fan.register("rajongo");
    const early = await fan.post(`/api/maps/${map.id}/like`, { liked: true });
    expect(early.status).toBe(409);
    expect((await json<ErrorBody>(early)).error.code).toBe("LIKE_NEEDS_RUN");
    await fan.post("/api/runs", { mapVersionId: map.currentVersionId, source: "" });
    const liked = await fan.post(`/api/maps/${map.id}/like`, { liked: true });
    expect(await json(liked)).toEqual({ likes: 1, likedByMe: true });
    const again = await fan.post(`/api/maps/${map.id}/like`, { liked: true });
    expect(await json(again)).toEqual({ likes: 1, likedByMe: true });
    const detail = await json<{
      player: { likes: number; likedByMe: boolean; hasPlayed: boolean };
    }>(await fan.get(`/api/maps/${map.id}`));
    expect(detail.player).toMatchObject({ likes: 1, likedByMe: true, hasPlayed: true });
    const ownerView = (await json<{ maps: Summary[] }>(await owner.get("/api/maps"))).maps[0];
    expect(ownerView).toMatchObject({ likes: 1, likedByMe: false });
    const unliked = await fan.post(`/api/maps/${map.id}/like`, { liked: false });
    expect(await json(unliked)).toEqual({ likes: 0, likedByMe: false });
  });
});

describe("napi kihívás és generálás", () => {
  test("naponta egy közös, nem szerkeszthető pálya, amely nem kerül a listába", async () => {
    await using context = await createTestContext();
    const first = context.client();
    await first.register("elso");
    const second = context.client();
    await second.register("masodik");
    type Daily = { map: Summary & { rows: number; cols: number }; date: string };
    const a = await json<Daily>(await first.get("/api/maps/daily"));
    const b = await json<Daily>(await second.get("/api/maps/daily"));
    expect(a.map.id).toBe(b.map.id);
    expect(a.date).toBe(dayKey(context.deps.now()));
    expect(a.map.title).toStartWith("Napi kihívás");
    expect(a.map.parSteps).toBeGreaterThan(0);
    const listed = (await json<{ maps: Summary[] }>(await first.get("/api/maps"))).maps;
    expect(listed.some((map) => map.id === a.map.id)).toBe(false);
    const detail = await json<{ canEdit: boolean; player: { isDaily: boolean } }>(
      await first.get(`/api/maps/${a.map.id}`),
    );
    expect(detail).toMatchObject({ canEdit: false, player: { isDaily: true } });
    context.advance(86_400_000);
    const tomorrow = await json<Daily>(await first.get("/api/maps/daily"));
    expect(tomorrow.map.id).not.toBe(a.map.id);
  });

  test("a generálás és a célérték-számítás validál", async () => {
    await using context = await createTestContext();
    const author = context.client();
    await author.register("szerzo");
    const generated = await author.post("/api/maps/generate", {
      rows: 9,
      cols: 9,
      difficulty: "hard",
      seed: 7,
    });
    expect(generated.status).toBe(200);
    const body = await json<{ content: string; parSteps: number; seed: number }>(generated);
    expect(body.seed).toBe(7);
    expect(body.content.startsWith("9 9\n")).toBe(true);
    const par = await author.post("/api/maps/par", { content: body.content });
    expect(await json(par)).toEqual({ parSteps: body.parSteps });
    const tooBig = await author.post("/api/maps/generate", {
      rows: 16,
      cols: 9,
      difficulty: "easy",
    });
    expect(tooBig.status).toBe(400);
    const broken = await author.post("/api/maps/par", { content: "2 2\n..\n.." });
    expect(broken.status).toBe(422);
  });
});

describe("oktató pályák célértéke", () => {
  test("a seed a receptekből adja, és a régi adatbázisban pótolja", async () => {
    await using context = await createTestContext();
    await seedDemo(context.deps, { reset: false });
    const pars = async () =>
      (await context.deps.db.select({ title: maps.title, parSteps: maps.parSteps }).from(maps))
        .map((row) => [row.title, row.parSteps])
        .slice(0, 3);
    const expected = [
      ["1. Egyenes folyosó", 4],
      ["2. Az első kanyar", 5],
      ["3. Kis labirintus", 24],
    ];
    expect(await pars()).toEqual(expected);
    await context.deps.db.update(maps).set({ parSteps: null });
    await seedDemo(context.deps, { reset: false });
    expect(await pars()).toEqual(expected);
  });
});
