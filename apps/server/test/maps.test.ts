import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { runs, users } from "../src/db/schema.ts";
import { createTestContext, type ErrorBody, json, SPEC_MAP } from "./helpers.ts";

type MapResponse = { map: { id: number; currentVersionId: number } };
type DetailResponse = {
  version: { id: number; version: number; content: string };
  versions: { id: number; version: number }[];
  info: { goldTotal: number; reachableGold: number };
  canEdit: boolean;
};

describe("térképek", () => {
  test("a hibás térkép 422 a diagnosztikákkal", async () => {
    const { client } = await createTestContext();
    const user = client();
    await user.register("terkepesz");
    const response = await user.post("/api/maps", { title: "Hibás", content: "1 2\n><" });
    expect(response.status).toBe(422);
    const body = await json<ErrorBody>(response);
    expect(body.error.code).toBe("MAP_INVALID");
    const details = body.error.details as { code: string; span: { line: number } }[];
    expect(details.map((d) => [d.code, d.span.line])).toEqual([["MAP_MULTIPLE_ROBOTS", 2]]);
  });

  test("érvényes térkép mentése, lekérése és exportja", async () => {
    const { client } = await createTestContext();
    const user = client();
    await user.register("terkepesz");
    const created = await user.post("/api/maps", {
      title: "Példa bánya",
      content: SPEC_MAP.replaceAll("\n", "\r\n"),
    });
    expect(created.status).toBe(201);
    const { map } = await json<MapResponse>(created);

    const detail = await json<DetailResponse>(await user.get(`/api/maps/${map.id}`));
    expect(detail.version.content).toBe(SPEC_MAP);
    expect(detail.info).toMatchObject({ goldTotal: 2, reachableGold: 2 });
    expect(detail.canEdit).toBe(true);

    const exported = await user.get(`/api/maps/${map.id}/export`);
    expect(exported.headers.get("content-type")).toContain("text/plain");
    expect(exported.headers.get("content-disposition")).toContain("attachment");
    expect(exported.headers.get("content-disposition")).toContain("Pelda-banya.txt");
    expect(await exported.text()).toBe(SPEC_MAP);

    const list = await json<{ maps: { id: number }[] }>(await user.get("/api/maps?scope=mine"));
    expect(list.maps.map((m) => m.id)).toEqual([map.id]);
  });

  test("a privát térképet csak a tulajdonos és az admin látja", async () => {
    const context = await createTestContext();
    const owner = context.client();
    await owner.register("tulaj");
    const { map } = await json<MapResponse>(
      await owner.post("/api/maps", { title: "Titok", content: "1 1\n>", visibility: "private" }),
    );
    const stranger = context.client();
    await stranger.register("idegen");
    expect((await stranger.get(`/api/maps/${map.id}`)).status).toBe(404);
    expect((await stranger.get(`/api/maps/${map.id}/leaderboard`)).status).toBe(404);
    const strangerList = await json<{ maps: unknown[] }>(await stranger.get("/api/maps"));
    expect(strangerList.maps).toHaveLength(0);

    const admin = context.client();
    const { user } = await admin.register("fonok");
    context.deps.db.update(users).set({ role: "admin" }).where(eq(users.id, user.id)).run();
    expect((await admin.get(`/api/maps/${map.id}`)).status).toBe(200);
  });

  test("más térképét nem lehet módosítani vagy törölni", async () => {
    const context = await createTestContext();
    const owner = context.client();
    await owner.register("tulaj");
    const { map } = await json<MapResponse>(
      await owner.post("/api/maps", { title: "Közös", content: "1 1\n>" }),
    );
    const other = context.client();
    await other.register("masik");
    expect((await other.put(`/api/maps/${map.id}`, { title: "Enyém" })).status).toBe(403);
    expect((await other.delete(`/api/maps/${map.id}`)).status).toBe(403);
    expect((await owner.delete(`/api/maps/${map.id}`)).status).toBe(200);
    expect((await owner.get(`/api/maps/${map.id}`)).status).toBe(404);
  });

  test("D14: futás nélkül helyben módosul, futás után új verzió jön létre", async () => {
    const context = await createTestContext();
    const owner = context.client();
    const { user } = await owner.register("verziozo");
    const { map } = await json<MapResponse>(
      await owner.post("/api/maps", { title: "Verziók", content: "1 2\n>@" }),
    );
    const firstVersionId = map.currentVersionId;

    const inPlace = await owner.put(`/api/maps/${map.id}`, { content: "1 3\n>.@" });
    expect(inPlace.status).toBe(200);
    expect((await json<{ createdNewVersion: boolean }>(inPlace)).createdNewVersion).toBe(false);
    let detail = await json<DetailResponse>(await owner.get(`/api/maps/${map.id}`));
    expect(detail.version.id).toBe(firstVersionId);
    expect(detail.version.content).toBe("1 3\n>.@\n");

    context.deps.db
      .insert(runs)
      .values({
        userId: user.id,
        mapVersionId: firstVersionId,
        source: "",
        sourceHash: "",
        gold: 0,
        steps: 0,
        outcomeKind: "ok",
        createdAt: context.deps.now(),
      })
      .run();

    const versioned = await owner.put(`/api/maps/${map.id}`, { content: "1 4\n>..@" });
    expect((await json<{ createdNewVersion: boolean }>(versioned)).createdNewVersion).toBe(true);
    detail = await json<DetailResponse>(await owner.get(`/api/maps/${map.id}`));
    expect(detail.version.version).toBe(2);
    expect(detail.versions.map((v) => v.version)).toEqual([1, 2]);

    const oldBoard = await json<{ entries: unknown[] }>(
      await owner.get(`/api/maps/${map.id}/leaderboard?version=${firstVersionId}`),
    );
    const newBoard = await json<{ entries: unknown[] }>(
      await owner.get(`/api/maps/${map.id}/leaderboard`),
    );
    expect(oldBoard.entries).toHaveLength(1);
    expect(newBoard.entries).toHaveLength(0);
  });

  test("az azonos tartalmú mentés nem hoz létre új verziót", async () => {
    const context = await createTestContext();
    const owner = context.client();
    await owner.register("ismetlo");
    const { map } = await json<MapResponse>(
      await owner.post("/api/maps", { title: "Ugyanaz", content: "1 1\n>" }),
    );
    const response = await owner.put(`/api/maps/${map.id}`, { content: "1 1\r\n>\r\n" });
    expect((await json<{ createdNewVersion: boolean }>(response)).createdNewVersion).toBe(false);
  });

  test("a hibás azonosító 400", async () => {
    const { client } = await createTestContext();
    const user = client();
    await user.register("azonosito");
    expect((await user.get("/api/maps/abc")).status).toBe(400);
  });
});
