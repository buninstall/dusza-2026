import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { eq, isNull } from "drizzle-orm";
import { maps, mapVersions, programs, runs, users } from "../src/db/schema.ts";
import { CROWD_MAPS_PER_PLAYER, crowdPlayers, crowdTitle, ensureCrowd } from "../src/seed/crowd.ts";
import { seedDemo } from "../src/seed/index.ts";
import { TUTORIAL_MAPS } from "../src/seed/maps.ts";
import { backfillDifficulty } from "../src/services/maps.ts";
import { PROGRAM_LIMIT } from "../src/services/programs.ts";
import { createTestContext, type ErrorBody, json, type TestClient } from "./helpers.ts";
import { TEST_TIMEOUT_MS } from "./timeout.ts";

setDefaultTimeout(TEST_TIMEOUT_MS);

type Summary = {
  id: number;
  title: string;
  ownerName: string;
  rows: number;
  cols: number;
  goldTotal: number;
  isStory: boolean;
  isFavorite: boolean;
  favoriteCount: number;
  difficulty: string | null;
  stars: number | null;
};

type Page<T, K extends string> = {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
} & Record<K, T[]>;

type MapPage = Page<Summary, "maps">;

const CORRIDOR = "1 6\n>.@.@.\n";

function mapOf(width: number, gold: number): string {
  const cells = `>${"@".repeat(gold)}${".".repeat(Math.max(0, width - gold - 1))}`;
  return `1 ${width}\n${cells}\n`;
}

async function createMap(
  client: TestClient,
  input: { title: string; content: string; description?: string; visibility?: string },
): Promise<number> {
  const response = await client.post("/api/maps", input);
  expect(response.status).toBe(201);
  return (await json<{ map: { id: number } }>(response)).map.id;
}

async function sandbox(client: TestClient, query: string): Promise<MapPage> {
  const response = await client.get(`/api/maps?world=sandbox&${query}`);
  expect(response.status).toBe(200);
  return json<MapPage>(response);
}

describe("lapozott térképlista", () => {
  test("oldalakra bont, a túl nagy oldalszámot az utolsóra igazítja", async () => {
    await using context = await createTestContext();
    const author = context.client();
    await author.register("lapozo");
    const ids: number[] = [];
    for (let index = 0; index < 7; index += 1) {
      context.advance(1000);
      ids.push(await createMap(author, { title: `Pálya ${index + 1}`, content: CORRIDOR }));
    }
    const second = await sandbox(author, "sort=order&pageSize=3&page=2");
    expect(second).toMatchObject({ page: 2, pageSize: 3, total: 7, pageCount: 3 });
    expect(second.maps.map((map) => map.id)).toEqual(ids.slice(3, 6));
    const beyond = await sandbox(author, "sort=order&pageSize=3&page=99");
    expect(beyond.page).toBe(3);
    expect(beyond.maps.map((map) => map.id)).toEqual(ids.slice(6));
    const recent = await sandbox(author, "sort=recent&pageSize=2");
    expect(recent.maps.map((map) => map.id)).toEqual(ids.slice(5).reverse());
  });

  test("keres a címben, a szerzőben és a leírásban, a % jel nem helyettesítő", async () => {
    await using context = await createTestContext();
    const author = context.client();
    await author.register("kereso_kati");
    await createMap(author, { title: "Ércér", content: CORRIDOR });
    context.advance(1);
    await createMap(author, { title: "Mély akna", content: CORRIDOR, description: "100% arany" });
    context.advance(1);
    await createMap(author, { title: "Kút", content: CORRIDOR });
    const other = context.client();
    await other.register("masik");
    expect((await sandbox(other, "q=ERCER")).maps.map((m) => m.title)).toEqual(["Ércér"]);
    expect((await sandbox(other, "q=kati")).total).toBe(3);
    expect((await sandbox(other, `q=${encodeURIComponent("100%")}`)).total).toBe(1);
    expect((await sandbox(other, `q=${encodeURIComponent("%")}`)).total).toBe(1);
    expect((await sandbox(other, `q=${encodeURIComponent("  kút  ")}`)).total).toBe(1);
  });

  test("nehézség szerint szűr, méret, arany és népszerűség szerint rendez", async () => {
    await using context = await createTestContext();
    const author = context.client();
    await author.register("rendezo");
    const small = await createMap(author, { title: "Kicsi", content: mapOf(3, 1) });
    context.advance(1);
    const wide = await createMap(author, { title: "Széles", content: mapOf(12, 2) });
    context.advance(1);
    const rich = await createMap(author, { title: "Gazdag", content: mapOf(8, 6) });
    expect((await sandbox(author, "sort=size")).maps[0]?.id).toBe(wide);
    expect((await sandbox(author, "sort=gold")).maps[0]?.id).toBe(rich);
    const fan = context.client();
    await fan.register("rajongo");
    await fan.put(`/api/maps/${small}/favorite`, {});
    expect((await sandbox(author, "sort=popular")).maps[0]?.id).toBe(small);
    const easy = await sandbox(author, "level=easy");
    expect(easy.maps.every((map) => map.difficulty === "easy")).toBe(true);
    const all = await sandbox(author, "");
    expect(easy.total + (await sandbox(author, "level=medium")).total).toBeLessThanOrEqual(
      all.total,
    );
  });

  test("a rossz lapozási paraméter magyar 400-at ad", async () => {
    await using context = await createTestContext();
    const user = context.client();
    await user.register("rossz_lap");
    for (const query of ["page=0", "pageSize=61", "page=abc", "sort=nincs", "world=mars"]) {
      const response = await user.get(`/api/maps?${query}`);
      expect(response.status).toBe(400);
      const body = await json<ErrorBody>(response);
      expect(body.error.code).toBe("VALIDATION");
    }
    const tooLong = await user.get(`/api/maps?q=${"a".repeat(81)}`);
    expect(tooLong.status).toBe(400);
  });
});

describe("kedvencek", () => {
  test("idempotens be- és kikapcsolás, számláló és saját kedvenc-lista", async () => {
    await using context = await createTestContext();
    const author = context.client();
    await author.register("alkoto");
    const mapId = await createMap(author, { title: "Kedvenc", content: CORRIDOR });
    await createMap(author, { title: "Másik", content: CORRIDOR });
    const fan = context.client();
    await fan.register("rajongo");
    const first = await json<{ isFavorite: boolean; favoriteCount: number }>(
      await fan.put(`/api/maps/${mapId}/favorite`, {}),
    );
    expect(first).toEqual({ isFavorite: true, favoriteCount: 1 });
    const again = await json<{ favoriteCount: number }>(
      await fan.put(`/api/maps/${mapId}/favorite`, {}),
    );
    expect(again.favoriteCount).toBe(1);
    await author.put(`/api/maps/${mapId}/favorite`, {});
    const favorites = await sandbox(fan, "scope=favorites");
    expect(favorites.maps.map((map) => [map.id, map.isFavorite, map.favoriteCount])).toEqual([
      [mapId, true, 2],
    ]);
    const detail = await json<{ isFavorite: boolean }>(await fan.get(`/api/maps/${mapId}`));
    expect(detail.isFavorite).toBe(true);
    const removed = await json<{ isFavorite: boolean; favoriteCount: number }>(
      await fan.delete(`/api/maps/${mapId}/favorite`),
    );
    expect(removed).toEqual({ isFavorite: false, favoriteCount: 1 });
    await fan.delete(`/api/maps/${mapId}/favorite`);
    expect((await sandbox(fan, "scope=favorites")).total).toBe(0);
    const [row] = await context.deps.db
      .select({ value: maps.favoriteCount })
      .from(maps)
      .where(eq(maps.id, mapId));
    expect(row?.value).toBe(1);
  });

  test("más privát térképe és a napi kihívás nem tehető kedvencbe", async () => {
    await using context = await createTestContext();
    const owner = context.client();
    await owner.register("titkos");
    const hidden = await createMap(owner, {
      title: "Rejtek",
      content: CORRIDOR,
      visibility: "private",
    });
    const stranger = context.client();
    await stranger.register("kivancsi");
    expect((await stranger.put(`/api/maps/${hidden}/favorite`, {})).status).toBe(404);
    expect((await stranger.put("/api/maps/999999/favorite", {})).status).toBe(404);
    const daily = await json<{ map: { id: number } }>(await stranger.get("/api/maps/daily"));
    const response = await stranger.put(`/api/maps/${daily.map.id}/favorite`, {});
    expect(response.status).toBe(409);
    expect((await json<ErrorBody>(response)).error.code).toBe("DAILY_FAVORITE");
  });
});

describe("történet, statisztika, egyeztetés, következő pálya", () => {
  test("a történet külön végponton jön, a homokozó nem tartalmazza", async () => {
    await using context = await createTestContext();
    await seedDemo(context.deps, { reset: false });
    const demo = context.client();
    await demo.post("/api/auth/login", { username: "demo1", password: "demo2026" });
    const story = await json<{ maps: Summary[] }>(await demo.get("/api/maps/story"));
    expect(story.maps.map((map) => map.title)).toEqual(TUTORIAL_MAPS.map((map) => map.title));
    expect(story.maps.every((map) => map.isStory)).toBe(true);
    const sandboxPage = await sandbox(demo, "pageSize=60");
    expect(sandboxPage.maps.some((map) => map.isStory)).toBe(false);
    const stats = await json<{ maps: number; authors: number }>(await demo.get("/api/maps/stats"));
    expect(stats).toEqual({ maps: sandboxPage.total, authors: 2 });
    const first = story.maps[0];
    const second = story.maps[1];
    const detail = await json<{ next: { id: number } | null }>(
      await demo.get(`/api/maps/${first?.id ?? 0}`),
    );
    expect(detail.next?.id).toBe(second?.id);
    const last = story.maps.at(-1);
    const end = await json<{ next: unknown }>(await demo.get(`/api/maps/${last?.id ?? 0}`));
    expect(end.next).toBeNull();
  });

  test("a homokozóban a következő pálya a létrehozás sorrendje szerint jön", async () => {
    await using context = await createTestContext();
    const author = context.client();
    await author.register("sorozat");
    const first = await createMap(author, { title: "Első", content: CORRIDOR });
    context.advance(1);
    const second = await createMap(author, { title: "Második", content: CORRIDOR });
    const next = await json<{ next: { id: number; title: string } | null }>(
      await author.get(`/api/maps/${first}`),
    );
    expect(next.next).toEqual({ id: second, title: "Második" });
    const none = await json<{ next: unknown }>(await author.get(`/api/maps/${second}`));
    expect(none.next).toBeNull();
  });

  test("a tartalom-egyeztetés kanonikus alakra illeszt, a hibásra null", async () => {
    await using context = await createTestContext();
    const author = context.client();
    await author.register("egyezteto");
    const mapId = await createMap(author, { title: "Folyosó", content: CORRIDOR });
    const response = await author.post("/api/maps/match", {
      contents: [CORRIDOR.replaceAll("\n", "\r\n"), "nem térkép", "1 2\n>.\n"],
    });
    expect(response.status).toBe(200);
    expect(await json<{ ids: unknown[] }>(response)).toEqual({ ids: [mapId, null, null] });
    const tooMany = await author.post("/api/maps/match", {
      contents: Array.from({ length: 65 }, () => CORRIDOR),
    });
    expect(tooMany.status).toBe(400);
  });
});

describe("programtár és futásnapló", () => {
  test("keres a címben és a forrásban, a címtalálat előre kerül, lapoz", async () => {
    await using context = await createTestContext();
    const user = context.client();
    await user.register("programozo");
    const save = (title: string, source: string) => user.post("/api/programs", { title, source });
    await save("Csiga", "turn by 1\nprint 1\n");
    context.advance(1);
    await save("Fal mellett", "step forward 1\nmine here");
    context.advance(1);
    await save("Lépegető", "step forward 2");
    const hits = await json<Page<{ title: string; lines: number }, "programs">>(
      await user.get("/api/programs?q=step"),
    );
    expect(hits.programs.map((program) => program.title)).toEqual(["Lépegető", "Fal mellett"]);
    const titled = await json<Page<{ title: string }, "programs">>(
      await user.get("/api/programs?q=fal"),
    );
    expect(titled.programs.map((program) => program.title)).toEqual(["Fal mellett"]);
    const paged = await json<
      Page<{ title: string; lines: number }, "programs"> & { quota: { used: number } }
    >(await user.get("/api/programs?pageSize=2&page=2&sort=title"));
    expect(paged).toMatchObject({ total: 3, pageCount: 2, quota: { used: 3 } });
    expect(paged.programs.map((program) => program.title)).toEqual(["Lépegető"]);
    const all = await json<Page<{ title: string; lines: number }, "programs">>(
      await user.get("/api/programs"),
    );
    expect(Object.fromEntries(all.programs.map((p) => [p.title, p.lines]))).toEqual({
      Csiga: 2,
      "Fal mellett": 2,
      Lépegető: 1,
    });
  });

  test("a programtár kvótája felett 409 PROGRAM_LIMIT", async () => {
    await using context = await createTestContext();
    const user = context.client();
    const { user: account } = await user.register("gyujto");
    await context.deps.db.insert(programs).values(
      Array.from({ length: PROGRAM_LIMIT }, (_, index) => ({
        ownerId: account.id,
        title: `Program ${index}`,
        source: "print 1",
        updatedAt: index,
      })),
    );
    const response = await user.post("/api/programs", { title: "Egy túl sok", source: "" });
    expect(response.status).toBe(409);
    expect((await json<ErrorBody>(response)).error.code).toBe("PROGRAM_LIMIT");
  });

  test("a saját futások lapozva, a legfrissebb elöl", async () => {
    await using context = await createTestContext();
    const user = context.client();
    await user.register("futo");
    const mapId = await createMap(user, { title: "Futópálya", content: CORRIDOR });
    const detail = await json<{ version: { id: number } }>(await user.get(`/api/maps/${mapId}`));
    for (let index = 1; index <= 5; index += 1) {
      context.advance(1);
      await user.post("/api/runs", {
        mapVersionId: detail.version.id,
        source: `step forward ${index}`,
      });
    }
    const page = await json<Page<{ steps: number }, "runs">>(
      await user.get("/api/me/runs?pageSize=2&page=1"),
    );
    expect(page).toMatchObject({ total: 5, pageCount: 3 });
    expect(page.runs).toHaveLength(2);
    const last = await json<Page<{ steps: number }, "runs">>(
      await user.get("/api/me/runs?pageSize=2&page=3"),
    );
    expect(last.runs).toHaveLength(1);
    expect((await user.get("/api/me/runs?pageSize=101")).status).toBe(400);
  });
});

describe("felhasználók lapozva", () => {
  test("az admin lista lapoz, keres a névben, és megadja az adminok számát", async () => {
    await using context = await createTestContext();
    const admin = context.client();
    const { user: boss } = await admin.register("fonok");
    await context.deps.db.update(users).set({ role: "admin" }).where(eq(users.id, boss.id));
    for (let index = 1; index <= 11; index += 1) {
      await context.client().register(`banyasz_${String(index).padStart(2, "0")}`);
    }
    const first = await json<Page<{ username: string }, "users"> & { admins: number }>(
      await admin.get("/api/admin/users?pageSize=9"),
    );
    expect(first).toMatchObject({ total: 12, pageCount: 2, admins: 1 });
    expect(first.users[0]?.username).toBe("fonok");
    const second = await json<Page<{ username: string }, "users">>(
      await admin.get("/api/admin/users?pageSize=9&page=2"),
    );
    expect(second.users.map((user) => user.username)).toEqual([
      "banyasz_09",
      "banyasz_10",
      "banyasz_11",
    ]);
    const found = await json<Page<{ username: string }, "users">>(
      await admin.get("/api/admin/users?q=SZ_1"),
    );
    expect(found.users.map((user) => user.username)).toEqual(["banyasz_10", "banyasz_11"]);
    expect((await admin.get("/api/admin/users?pageSize=101")).status).toBe(400);
  }, 60_000);
});

describe("homokozó-tömeg a seedben", () => {
  test("száz bányász háromszáz pályája, idempotensen, belépés nélkül", async () => {
    await using context = await createTestContext();
    await seedDemo(context.deps, { reset: false });
    const report = await ensureCrowd(context.deps, context.deps.now());
    const players = crowdPlayers();
    expect(report.players).toBe(players.length);
    expect(report.maps).toBe(players.length * CROWD_MAPS_PER_PLAYER);
    expect(report.runs).toBeGreaterThan(0);
    expect(report.favorites).toBeGreaterThan(0);
    expect(await ensureCrowd(context.deps, context.deps.now())).toEqual({
      players: 0,
      maps: 0,
      favorites: 0,
      runs: 0,
    });
    for (const tutorial of TUTORIAL_MAPS) {
      const board = await context.deps.db
        .select({ userId: runs.userId })
        .from(runs)
        .innerJoin(mapVersions, eq(mapVersions.id, runs.mapVersionId))
        .innerJoin(maps, eq(maps.id, mapVersions.mapId))
        .where(eq(maps.title, tutorial.title));
      expect(board.length, tutorial.title).toBeGreaterThan(0);
    }
    const [first] = players;
    const login = await context
      .client()
      .post("/api/auth/login", { username: first?.username ?? "", password: "demo2026" });
    expect(login.status).toBe(401);
    const missing = await context.deps.db
      .select({ id: mapVersions.id })
      .from(mapVersions)
      .where(isNull(mapVersions.difficulty));
    expect(missing).toHaveLength(0);
    const demo = context.client();
    await demo.post("/api/auth/login", { username: "demo1", password: "demo2026" });
    const page = await sandbox(demo, "pageSize=8");
    expect(page.pageCount).toBeGreaterThan(30);
    expect(new Set(players.map((_, index) => crowdTitle(index))).size).toBe(players.length);
    const [crowdUser] = await context.deps.db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.username, first?.username ?? ""));
    expect(crowdUser?.role).toBe("user");
  }, 120_000);

  test("a hiányzó nehézséget induláskor pótolja", async () => {
    await using context = await createTestContext();
    const author = context.client();
    await author.register("potlo");
    await createMap(author, { title: "Régi", content: CORRIDOR });
    await context.deps.db.update(mapVersions).set({ difficulty: null });
    expect(await backfillDifficulty(context.deps.db, context.deps.engine)).toBe(1);
    const [version] = await context.deps.db
      .select({ difficulty: mapVersions.difficulty })
      .from(mapVersions);
    expect(version?.difficulty).toBe("easy");
  });
});
