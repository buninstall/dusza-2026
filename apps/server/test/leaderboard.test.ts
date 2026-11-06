import { describe, expect, test } from "bun:test";
import { runs } from "../src/db/schema.ts";
import { createTestContext, json } from "./helpers.ts";

type Entry = { rank: number; username: string; gold: number; steps: number };

describe("ranglista", () => {
  test("felhasználónként a legjobb futás, arany DESC, lépés ASC, idő ASC", async () => {
    const context = await createTestContext();
    const owner = context.client();
    const anna = await owner.register("anna");
    const { map } = await json<{ map: { id: number; currentVersionId: number } }>(
      await owner.post("/api/maps", { title: "Verseny", content: "1 4\n>@@@" }),
    );
    const bela = await context.client().register("bela");
    const csaba = await context.client().register("csaba");

    const insert = (userId: number, gold: number, steps: number, createdAt: number) =>
      context.deps.db
        .insert(runs)
        .values({
          userId,
          mapVersionId: map.currentVersionId,
          source: "",
          sourceHash: "",
          gold,
          steps,
          outcomeKind: "ok",
          createdAt,
        })
        .run();

    insert(anna.user.id, 2, 10, 1);
    insert(anna.user.id, 2, 8, 2);
    insert(anna.user.id, 1, 3, 3);
    insert(bela.user.id, 3, 50, 4);
    insert(csaba.user.id, 2, 8, 5);

    const board = await json<{ entries: Entry[] }>(
      await owner.get(`/api/maps/${map.id}/leaderboard`),
    );
    expect(board.entries.map((e) => [e.rank, e.username, e.gold, e.steps])).toEqual([
      [1, "bela", 3, 50],
      [2, "anna", 2, 8],
      [3, "csaba", 2, 8],
    ]);
  });

  test("idegen verzióazonosító 404", async () => {
    const context = await createTestContext();
    const owner = context.client();
    await owner.register("dora");
    const first = await json<{ map: { id: number } }>(
      await owner.post("/api/maps", { title: "Egy", content: "1 1\n>" }),
    );
    const second = await json<{ map: { currentVersionId: number } }>(
      await owner.post("/api/maps", { title: "Kettő", content: "1 1\n>" }),
    );
    const response = await owner.get(
      `/api/maps/${first.map.id}/leaderboard?version=${second.map.currentVersionId}`,
    );
    expect(response.status).toBe(404);
  });
});
