import { describe, expect, test } from "bun:test";
import { count, eq } from "drizzle-orm";
import { runs, users } from "../src/db/schema.ts";
import { createTestContext, type ErrorBody, json, SPEC_MAP } from "./helpers.ts";

describe("futások", () => {
  test("a szintaktikailag hibás program 422, és nem kerül mentésre", async () => {
    await using context = await createTestContext();
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
    const [stored] = await context.deps.db.select({ value: count() }).from(runs);
    expect(stored?.value).toBe(0);
  });

  test("a befejezett futást a szerver számolja és menti", async () => {
    await using context = await createTestContext();
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

  test("a válasz megadja a helyezést és az egyéni csúcsot", async () => {
    await using context = await createTestContext();
    const owner = context.client();
    await owner.register("gazda");
    const { map } = await json<{ map: { currentVersionId: number } }>(
      await owner.post("/api/maps", { title: "Pálya", content: "1 3\n>@." }),
    );
    type Standing = { standing: { rank: number; players: number; isPersonalBest: boolean } };
    const post = async (client: typeof owner, source: string) =>
      json<Standing>(
        await client.post("/api/runs", { mapVersionId: map.currentVersionId, source }),
      );
    expect((await post(owner, "")).standing).toMatchObject({
      rank: 1,
      players: 1,
      isPersonalBest: true,
    });
    const rival = context.client();
    await rival.register("rivalis");
    expect((await post(rival, "step forward 1\nmine here")).standing).toMatchObject({
      rank: 1,
      players: 2,
      isPersonalBest: true,
    });
    expect((await post(owner, "print 1")).standing).toMatchObject({
      rank: 2,
      players: 2,
      isPersonalBest: false,
    });
  });

  test("nem létező térképverzió 404", async () => {
    await using context = await createTestContext();
    const user = context.client();
    await user.register("futtato");
    const response = await user.post("/api/runs", { mapVersionId: 9999, source: "" });
    expect(response.status).toBe(404);
  });

  test("bejelentkezés nélkül 401", async () => {
    await using context = await createTestContext();
    const response = await context.client().post("/api/runs", { mapVersionId: 1, source: "" });
    expect(response.status).toBe(401);
    expect((await context.client().get("/api/runs/1")).status).toBe(401);
  });
});

type RunDetailBody = {
  run: {
    id: number;
    mapId: number;
    mapTitle: string;
    mapVersionId: number;
    version: number;
    gold: number;
    steps: number;
    outcomeKind: string;
    errorCode: string | null;
    errorLine: number | null;
    createdAt: number;
    source: string;
    username: string;
    isOwn: boolean;
  };
  map: { content: string; lampMode: string };
};

describe("egy futás visszajátszáshoz", () => {
  const firstContent = "1 4\n>@.@\n";
  const source = "step forward 1\nmine here\nstep forward 9";

  async function recordedRun() {
    const context = await createTestContext();
    const owner = context.client();
    await owner.register("palyaepito");
    const { map } = await json<{ map: { id: number; currentVersionId: number } }>(
      await owner.post("/api/maps", { title: "Visszajátszás", content: firstContent }),
    );
    const runner = context.client();
    await runner.register("futo");
    const { run } = await json<{ run: { id: number } }>(
      await runner.post("/api/runs", { mapVersionId: map.currentVersionId, source }),
    );
    return {
      context,
      owner,
      runner,
      map,
      runId: run.id,
      [Symbol.asyncDispose]: () => context[Symbol.asyncDispose](),
    };
  }

  test("a tulajdonos megkapja a futást és a futott verzió tartalmát", async () => {
    await using setup = await recordedRun();
    const { context, runner, map, runId } = setup;
    const response = await runner.get(`/api/runs/${runId}`);
    expect(response.status).toBe(200);
    const body = await json<RunDetailBody>(response);
    expect(body).toEqual({
      run: {
        id: runId,
        mapId: map.id,
        mapTitle: "Visszajátszás",
        mapVersionId: map.currentVersionId,
        version: 1,
        gold: 1,
        steps: 3,
        outcomeKind: "runtimeError",
        errorCode: "E_BEDROCK_HIT",
        errorLine: 3,
        createdAt: 1_700_000_000_000,
        source,
        username: "futo",
        isOwn: true,
      },
      map: { content: firstContent, lampMode: "open" },
    });
    const replay = context.deps.engine.run(body.run.source, body.map.content);
    expect([replay.gold, replay.steps]).toEqual([body.run.gold, body.run.steps]);
  });

  test("új verzió után is a futott verzió tartalmát adja", async () => {
    await using setup = await recordedRun();
    const { owner, runner, map, runId } = setup;
    const edited = await owner.put(`/api/maps/${map.id}`, { content: "1 4\n>.@@\n" });
    expect((await json<{ createdNewVersion: boolean }>(edited)).createdNewVersion).toBe(true);
    const body = await json<RunDetailBody>(await runner.get(`/api/runs/${runId}`));
    expect(body.map.content).toBe(firstContent);
    expect(body.run.version).toBe(1);
    expect(body.run.mapVersionId).toBe(map.currentVersionId);
  });

  test("nyilvános térkép futását bárki visszanézheti, privátét csak az érintettek", async () => {
    await using setup = await recordedRun();
    const { context, owner, runner, map, runId } = setup;
    const stranger = context.client();
    await stranger.register("kivulallo");
    for (const client of [stranger, owner]) {
      const response = await client.get(`/api/runs/${runId}`);
      expect(response.status).toBe(200);
      const body = await json<RunDetailBody>(response);
      expect(body.run.username).toBe("futo");
      expect(body.run.isOwn).toBe(false);
    }
    expect((await owner.put(`/api/maps/${map.id}`, { visibility: "private" })).status).toBe(200);
    const hidden = await stranger.get(`/api/runs/${runId}`);
    expect(hidden.status).toBe(404);
    expect((await json<ErrorBody>(hidden)).error.code).toBe("NOT_FOUND");
    expect((await owner.get(`/api/runs/${runId}`)).status).toBe(200);
    expect((await runner.get(`/api/runs/${runId}`)).status).toBe(200);
    const admin = context.client();
    const { user } = await admin.register("rendszergazda");
    await context.deps.db.update(users).set({ role: "admin" }).where(eq(users.id, user.id));
    expect((await admin.get(`/api/runs/${runId}`)).status).toBe(200);
  });

  test("ismeretlen azonosító 404, hibás azonosító 400", async () => {
    await using setup = await recordedRun();
    const { runner, runId } = setup;
    for (const id of [runId + 1, 2_147_483_648]) {
      const response = await runner.get(`/api/runs/${id}`);
      expect(response.status).toBe(404);
      expect((await json<ErrorBody>(response)).error.code).toBe("NOT_FOUND");
    }
    for (const id of ["abc", "0", "-1", "1.5", "0x1", "%20"]) {
      const response = await runner.get(`/api/runs/${id}`);
      expect(response.status).toBe(400);
      expect((await json<ErrorBody>(response)).error.code).toBe("VALIDATION");
    }
  });

  test("a saját futások listája nem tartalmaz forrást", async () => {
    await using setup = await recordedRun();
    const { runner } = setup;
    const { runs: list } = await json<{ runs: Record<string, unknown>[] }>(
      await runner.get("/api/me/runs"),
    );
    expect(list).toHaveLength(1);
    expect(Object.keys(list[0] ?? {}).sort()).toEqual(
      [
        "createdAt",
        "errorCode",
        "errorLine",
        "gold",
        "id",
        "mapId",
        "mapTitle",
        "mapVersionId",
        "outcomeKind",
        "steps",
        "version",
      ].sort(),
    );
  });
});
