import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { count, eq } from "drizzle-orm";
import { runs, users } from "../src/db/schema.ts";
import { createTestContext, type ErrorBody, json, SPEC_MAP } from "./helpers.ts";
import { TEST_TIMEOUT_MS } from "./timeout.ts";

setDefaultTimeout(TEST_TIMEOUT_MS);

type Created = { map: { id: number; currentVersionId: number } };

describe("a kiírás 3.1–3.5 pontjai a szerveren", () => {
  test("bejelentkezés nélkül minden játékfunkció 401", async () => {
    await using context = await createTestContext();
    const guest = context.client();
    const calls: [string, string, unknown?][] = [
      ["GET", "/api/maps"],
      ["GET", "/api/maps/1"],
      ["GET", "/api/maps/1/export"],
      ["GET", "/api/maps/1/leaderboard"],
      ["POST", "/api/maps", { title: "x", content: SPEC_MAP }],
      ["PUT", "/api/maps/1", { title: "x" }],
      ["DELETE", "/api/maps/1"],
      ["GET", "/api/programs"],
      ["POST", "/api/programs", { title: "x", source: "" }],
      ["POST", "/api/runs", { mapVersionId: 1, source: "" }],
      ["GET", "/api/runs/1"],
      ["GET", "/api/me/runs"],
      ["GET", "/api/story/leaderboard"],
      ["GET", "/api/admin/users"],
    ];
    for (const [method, path, body] of calls) {
      const response = await guest.request(method, path, body);
      expect({ path, status: response.status }).toEqual({ path, status: 401 });
      expect((await json<ErrorBody>(response)).error.code).toBe("UNAUTHENTICATED");
    }
  });

  test("más privát térképén nem lehet futtatni, exportálni, és a futása sem nézhető vissza", async () => {
    await using context = await createTestContext();
    const owner = context.client();
    await owner.register("titkos");
    const { map } = await json<Created>(
      await owner.post("/api/maps", { title: "Rejtek", content: SPEC_MAP, visibility: "private" }),
    );
    const ownRun = await json<{ run: { id: number } }>(
      await owner.post("/api/runs", { mapVersionId: map.currentVersionId, source: "" }),
    );
    const stranger = context.client();
    await stranger.register("kivancsi");
    const run = await stranger.post("/api/runs", {
      mapVersionId: map.currentVersionId,
      source: "",
    });
    expect(run.status).toBe(404);
    expect((await stranger.get(`/api/maps/${map.id}/export`)).status).toBe(404);
    expect(
      (await stranger.get(`/api/maps/${map.id}/leaderboard?version=${map.currentVersionId}`))
        .status,
    ).toBe(404);
    expect((await stranger.get(`/api/runs/${ownRun.run.id}`)).status).toBe(404);
    const [stored] = await context.deps.db.select({ value: count() }).from(runs);
    expect(stored?.value).toBe(1);
  });

  test("csak szabályos térkép menthető, és a hibás tartalom nem kerül az adatbázisba", async () => {
    await using context = await createTestContext();
    const user = context.client();
    await user.register("tervezo");
    const invalid = [
      "0 1\n",
      "1 16\n>...............\n",
      "16 1\n>\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n",
      "1 3\n...\n",
      "1 3\n>.<\n",
      "1 3\n>.x\n",
      "2 3\n>..\n",
      "1 3\n>.\n",
      "1  3\n>..\n",
      "1x3\n>..\n",
      "",
    ];
    for (const content of invalid) {
      const response = await user.post("/api/maps", { title: "Rossz", content });
      expect({ content, status: response.status }).toEqual({ content, status: 422 });
      expect((await json<ErrorBody>(response)).error.code).toBe("MAP_INVALID");
    }
    const listed = await json<{ maps: unknown[] }>(await user.get("/api/maps?scope=mine"));
    expect(listed.maps).toHaveLength(0);
  });

  test("az import kanonikus alakra hoz, az export pontosan a kiírás formátuma", async () => {
    await using context = await createTestContext();
    const user = context.client();
    await user.register("exportalo");
    const imported = "3 15\r\n....@..........\r\n.#############.\r\n.......@...>...";
    const created = await user.post("/api/maps", { title: "Példa", content: imported });
    expect(created.status).toBe(201);
    const { map } = await json<Created>(created);
    const exported = await user.get(`/api/maps/${map.id}/export`);
    expect(exported.status).toBe(200);
    expect(exported.headers.get("content-type")).toContain("text/plain");
    expect(await exported.text()).toBe(SPEC_MAP);
  });

  test("a futásidejű hiba és a lépéslimit is rögzül, a leállított futást a kliens nem küldi", async () => {
    await using context = await createTestContext();
    const user = context.client();
    await user.register("hibazo");
    const { map } = await json<Created>(
      await user.post("/api/maps", { title: "Hibák", content: SPEC_MAP }),
    );
    const bedrock = await json<{
      run: { outcomeKind: string; errorCode: string; errorLine: number; steps: number };
    }>(
      await user.post("/api/runs", {
        mapVersionId: map.currentVersionId,
        source: "step forward 1\nturn by 3\nstep forward 1\n",
      }),
    );
    expect(bedrock.run).toMatchObject({
      outcomeKind: "runtimeError",
      errorCode: "E_BEDROCK_HIT",
      errorLine: 3,
      steps: 3,
    });
    const limit = await json<{ run: { errorCode: string; steps: number } }>(
      await user.post("/api/runs", {
        mapVersionId: map.currentVersionId,
        source: "while true\n    turn by 1\n",
      }),
    );
    expect(limit.run).toMatchObject({ errorCode: "INSTRUCTION_COUNT_LIMIT_EXCEEDED", steps: 1000 });
  });

  test("a ranglista több aranyat, majd kevesebb lépést tesz előre, felhasználónként a legjobbal", async () => {
    await using context = await createTestContext();
    const owner = context.client();
    await owner.register("palyaepito");
    const { map } = await json<Created>(
      await owner.post("/api/maps", { title: "Verseny", content: "1 4\n>@.@\n" }),
    );
    const play = async (name: string, sources: string[]) => {
      const player = context.client();
      await player.register(name);
      for (const source of sources) {
        expect(
          (await player.post("/api/runs", { mapVersionId: map.currentVersionId, source })).status,
        ).toBe(201);
      }
    };
    await play("lassu", ["step forward 1\nmine here\nstep forward 1\nstep forward 1\nmine here\n"]);
    await play("gyors", [
      "step forward 1\nmine here\nstep forward 2\nmine here\n",
      "step forward 1\nmine here\n",
    ]);
    await play("felig", ["step forward 1\nmine here\n"]);
    const board = await json<{
      entries: { username: string; gold: number; steps: number; rank: number }[];
    }>(await owner.get(`/api/maps/${map.id}/leaderboard`));
    expect(
      board.entries.map(({ username, gold, steps, rank }) => ({ username, gold, steps, rank })),
    ).toEqual([
      { username: "gyors", gold: 2, steps: 4, rank: 1 },
      { username: "lassu", gold: 2, steps: 5, rank: 2 },
      { username: "felig", gold: 1, steps: 2, rank: 3 },
    ]);
  });

  test("a lefokozott admin azonnal elveszti a felhasználókezelést", async () => {
    await using context = await createTestContext();
    const first = context.client();
    const { user: boss } = await first.register("fonok");
    const second = context.client();
    const { user: deputy } = await second.register("helyettes");
    await context.deps.db.update(users).set({ role: "admin" }).where(eq(users.id, boss.id));
    await context.deps.db.update(users).set({ role: "admin" }).where(eq(users.id, deputy.id));
    expect((await second.get("/api/admin/users")).status).toBe(200);
    const demoted = await first.request("PATCH", `/api/admin/users/${deputy.id}`, { role: "user" });
    expect(demoted.status).toBe(200);
    expect((await second.get("/api/admin/users")).status).toBe(403);
  });
});
