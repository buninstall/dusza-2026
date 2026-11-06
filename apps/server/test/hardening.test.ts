import { describe, expect, test } from "bun:test";
import { asc, eq } from "drizzle-orm";
import { MAX_BODY_BYTES } from "../src/app.ts";
import { createLoginLimiter, MAX_TRACKED_KEYS } from "../src/auth/rate-limit.ts";
import { parseConfig } from "../src/config.ts";
import { mapVersions, runs } from "../src/db/schema.ts";
import { DatabaseUrlError, parseDatabaseUrl } from "../src/db/url.ts";
import { attachmentDisposition } from "../src/lib/request.ts";
import { createTestContext, type ErrorBody, json, ORIGIN, SPEC_MAP } from "./helpers.ts";

type MapResponse = {
  map: { id: number; title: string; description: string; currentVersionId: number };
};
type Detail = {
  map: { currentVersionId: number };
  versions: { id: number; version: number }[];
};

async function rawPost(
  app: { request: (input: string, init: RequestInit) => Response | Promise<Response> },
  path: string,
  body: string,
  headers: Record<string, string> = {},
) {
  return app.request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: { Origin: ORIGIN, "Content-Type": "application/json", ...headers },
    body,
  });
}

function detailMessages(body: ErrorBody): string[] {
  return (body.error.details as { message: string }[]).map((detail) => detail.message);
}

describe("hibatűrés a kérések határán", () => {
  test("a hibás JSON 400 VALIDATION magyar üzenettel, nem 500", async () => {
    await using context = await createTestContext();
    const login = await rawPost(context.app, "/api/auth/login", "{nem json");
    expect(login.status).toBe(400);
    expect(await json<ErrorBody>(login)).toEqual({
      error: { code: "VALIDATION", message: "A kérés törzse nem érvényes JSON." },
    });
    const user = context.client();
    await user.register("jsonhiba");
    const map = await user.request("POST", "/api/maps", undefined, {
      "Content-Type": "application/json",
    });
    expect(map.status).toBe(400);
  });

  test("az 1 MiB-nál nagyobb kérés 413 PAYLOAD_TOO_LARGE", async () => {
    await using context = await createTestContext();
    const user = context.client();
    await user.register("nagykeres");
    const response = await user.post("/api/programs", {
      title: "Óriás",
      source: "a".repeat(MAX_BODY_BYTES),
    });
    expect(response.status).toBe(413);
    expect(response.headers.get("connection")).toBe("close");
    expect((await json<ErrorBody>(response)).error.code).toBe("PAYLOAD_TOO_LARGE");
    const fits = await user.post("/api/programs", { title: "Határ", source: "é".repeat(100_000) });
    expect(fits.status).toBe(201);
  });

  test("a párosítatlan helyettesítő kód 400, nem adatbázishiba", async () => {
    await using context = await createTestContext();
    const cookie = await sessionCookie(context.app, "surrogate");
    for (const [path, body] of [
      ["/api/maps", '{"title":"x\\ud800y","content":"1 1\\n>"}'],
      ["/api/maps", '{"title":"x","description":"\\udc00","content":"1 1\\n>"}'],
      ["/api/programs", '{"title":"p","source":"print 1\\ud83d"}'],
      ["/api/auth/register", '{"username":"surrogat2","password":"jelszo12\\ud800"}'],
    ] as const) {
      const response = await rawPost(context.app, path, body, { Cookie: cookie });
      expect(response.status).toBe(400);
      expect(detailMessages(await json<ErrorBody>(response))).toEqual([
        "A szöveg érvénytelen Unicode-karaktert (párosítatlan helyettesítő kódot) tartalmaz.",
      ]);
    }
  });

  test("a cím sortörései és vezérlőkarakterei szóközzé válnak, a láthatatlan cím üres", async () => {
    await using context = await createTestContext();
    const user = context.client();
    await user.register("cimteszt");
    const created = await user.post("/api/maps", {
      title: "  Első\nsor\t\u0007második\r\n ",
      description: "egy\r\nkettő\rhárom\u0000\tvége",
      content: "1 1\n>",
    });
    expect(created.status).toBe(201);
    const { map } = await json<MapResponse>(created);
    expect(map.title).toBe("Első sor második");
    expect(map.description).toBe("egy\nkettő\nhárom\tvége");
    const invisible = [[0x200b], [0x200e, 0x200f], [0x301], [0x20, 0xa0, 0x20], [0x0a, 0x09]];
    for (const title of invisible.map((codes) => String.fromCharCode(...codes))) {
      const response = await user.post("/api/maps", { title, content: "1 1\n>" });
      expect(response.status).toBe(400);
      expect(detailMessages(await json<ErrorBody>(response))).toEqual(["A cím nem lehet üres."]);
    }
    const emoji = await user.post("/api/programs", { title: "😀".repeat(40), source: "" });
    expect(emoji.status).toBe(201);
    const xss = "<img src=x onerror=alert(1)>";
    const stored = await json<MapResponse>(
      await user.post("/api/maps", {
        title: xss,
        description: "<script>x</script>",
        content: "1 1\n>",
      }),
    );
    expect(stored.map.title).toBe(xss);
    expect(stored.map.description).toBe("<script>x</script>");
  });

  test("minden mezőhiba magyar üzenetet ad", async () => {
    await using context = await createTestContext();
    const user = context.client();
    await user.register("magyarul");
    const cases: [string, unknown][] = [
      ["/api/maps", {}],
      ["/api/maps", { title: 5, content: null, visibility: "titkos", description: [] }],
      ["/api/programs", { title: "x" }],
      ["/api/runs", { mapVersionId: "1", source: 3 }],
      ["/api/runs", { mapVersionId: 1.5, source: "" }],
      ["/api/runs", { mapVersionId: 1e20, source: "" }],
      ["/api/auth/login", { username: 1, password: false }],
      ["/api/auth/register", []],
    ];
    for (const [path, body] of cases) {
      const response = await user.post(path, body);
      expect(response.status).toBe(400);
      for (const message of detailMessages(await json<ErrorBody>(response))) {
        expect(message).not.toMatch(/Invalid|expected|received|Too (big|small)/);
      }
    }
    const scope = await json<ErrorBody>(await user.get("/api/maps?scope=minden"));
    expect(detailMessages(scope)).toEqual(["A szűrő „all” vagy „mine” lehet."]);
  });

  test("az azonosító csak tizes számrendszerbeli pozitív egész", async () => {
    await using context = await createTestContext();
    const user = context.client();
    await user.register("azonositok");
    const { map } = await json<MapResponse>(
      await user.post("/api/maps", { title: "Egy", content: "1 1\n>" }),
    );
    expect((await user.get(`/api/maps/${map.id}`)).status).toBe(200);
    for (const id of ["0x1", "1e0", "%201", "1.0", "+1", "-1", "0", "01", "..%2f", "1%00"]) {
      const response = await user.get(`/api/maps/${id}`);
      expect(response.status).toBe(400);
      expect(detailMessages(await json<ErrorBody>(response))).toEqual([
        "Az azonosító pozitív egész szám kell legyen.",
      ]);
    }
    expect((await user.get("/api/maps/2147483648")).status).toBe(404);
    expect((await user.get("/api/maps/999999999999999")).status).toBe(404);
    expect((await user.get("/api/maps/9999999999999999")).status).toBe(400);
    expect((await user.get(`/api/maps/${map.id}/leaderboard?version=0x1`)).status).toBe(400);
    expect((await user.get(`/api/maps/${map.id}/leaderboard?version=`)).status).toBe(400);
    expect((await user.post("/api/runs", { mapVersionId: 2147483648, source: "" })).status).toBe(
      404,
    );
  });

  test("az export fájlneve nem enged fejléc-befecskendezést", async () => {
    await using context = await createTestContext();
    const user = context.client();
    await user.register("exportalo");
    const { map } = await json<MapResponse>(
      await user.post("/api/maps", { title: 'Idéző "x"\r\nSet-Cookie: a=1; ő', content: "1 1\n>" }),
    );
    const response = await user.get(`/api/maps/${map.id}/export`);
    const disposition = response.headers.get("content-disposition") ?? "";
    expect(disposition).toBe(
      "attachment; filename=\"Idezo-x-Set-Cookie-a1-o.txt\"; filename*=UTF-8''Id%C3%A9z%C5%91%20%22x%22%20Set-Cookie%3A%20a%3D1%3B%20%C5%91.txt",
    );
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(attachmentDisposition("\r\n\"';", "ms")).toBe(
      "attachment; filename=\"terkep.ms\"; filename*=UTF-8''%0D%0A%22'%3B.ms",
    );
  });
});

async function sessionCookie(
  app: { request: (input: string, init: RequestInit) => Response | Promise<Response> },
  username: string,
): Promise<string> {
  const response = await rawPost(
    app,
    "/api/auth/register",
    JSON.stringify({ username, password: "jelszo1234" }),
  );
  return (response.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
}

describe("párhuzamos kérések", () => {
  test("párhuzamos mentéskor a sorrendi mentéssel azonos verziók, egyedi sorszámok", async () => {
    await using context = await createTestContext();
    const owner = context.client();
    await owner.register("verziozo");
    const { map } = await json<MapResponse>(
      await owner.post("/api/maps", { title: "Verziók", content: "1 4\n>.@." }),
    );
    expect(
      (await owner.post("/api/runs", { mapVersionId: map.currentVersionId, source: "" })).status,
    ).toBe(201);
    const edits = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        owner.put(`/api/maps/${map.id}`, { content: `1 4\n>${index % 2 ? "@." : ".@"}@` }),
      ),
    );
    expect(edits.map((response) => response.status)).toEqual(Array(10).fill(200));
    const created = await Promise.all(
      edits.map(
        async (response) =>
          (await json<{ createdNewVersion: boolean }>(response)).createdNewVersion,
      ),
    );
    expect(created.filter(Boolean)).toHaveLength(1);
    const detail = await json<Detail>(await owner.get(`/api/maps/${map.id}`));
    expect(detail.versions.map((version) => version.version)).toEqual([1, 2]);
    expect(detail.map.currentVersionId).toBe(detail.versions.at(-1)?.id ?? -1);
  });

  test("futás és mentés versenyében minden futás a saját verziójának tartalmán számolt", async () => {
    await using context = await createTestContext();
    const owner = context.client();
    await owner.register("versenyzo");
    const { map } = await json<MapResponse>(
      await owner.post("/api/maps", { title: "Verseny", content: "1 3\n>@." }),
    );
    const source = "step forward 1\nmine here";
    for (let round = 0; round < 6; round += 1) {
      const detail = await json<Detail>(await owner.get(`/api/maps/${map.id}`));
      await Promise.all([
        owner.put(`/api/maps/${map.id}`, { content: round % 2 ? "1 3\n>@." : "1 3\n>.@" }),
        owner.post("/api/runs", { mapVersionId: detail.map.currentVersionId, source }),
        owner.post("/api/runs", { mapVersionId: detail.map.currentVersionId, source }),
      ]);
    }
    const recorded = await context.deps.db
      .select({ gold: runs.gold, steps: runs.steps, content: mapVersions.content })
      .from(runs)
      .innerJoin(mapVersions, eq(mapVersions.id, runs.mapVersionId))
      .orderBy(asc(runs.id));
    expect(recorded.length).toBe(12);
    for (const run of recorded) {
      const rerun = context.deps.engine.run(source, run.content);
      expect([run.gold, run.steps]).toEqual([rerun.gold, rerun.steps]);
    }
    const versions = await context.deps.db
      .select({ version: mapVersions.version })
      .from(mapVersions)
      .where(eq(mapVersions.mapId, map.id))
      .orderBy(asc(mapVersions.version));
    expect(versions.map((row) => row.version)).toEqual(versions.map((_, index) => index + 1));
  });

  test("ugyanarra a névre párhuzamosan csak egy regisztráció sikerül", async () => {
    await using context = await createTestContext();
    const responses = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        context.client().post("/api/auth/register", {
          username: index % 2 ? "Ugyanaz" : "ugyanaz",
          password: "jelszo1234",
        }),
      ),
    );
    const statuses = responses.map((response) => response.status).sort();
    expect(statuses).toEqual([201, 409, 409, 409, 409, 409, 409, 409]);
  });

  test("20 párhuzamos futás mind rögzül, a ranglista stabil", async () => {
    await using context = await createTestContext();
    const owner = context.client();
    await owner.register("futtato");
    const { map } = await json<MapResponse>(
      await owner.post("/api/maps", { title: "Tömeg", content: SPEC_MAP }),
    );
    const responses = await Promise.all(
      Array.from({ length: 20 }, () =>
        owner.post("/api/runs", { mapVersionId: map.currentVersionId, source: "turn by 1" }),
      ),
    );
    expect(responses.map((response) => response.status)).toEqual(Array(20).fill(201));
    const board = await json<{ entries: { runId: number }[] }>(
      await owner.get(`/api/maps/${map.id}/leaderboard`),
    );
    const firstRun = await json<{ run: { id: number } }>(responses[0] ?? new Response("{}"));
    expect(board.entries).toHaveLength(1);
    expect(board.entries[0]?.runId).toBeLessThanOrEqual(firstRun.run.id);
  });

  test("a futás közben törölt verzióra 404 a válasz", async () => {
    await using context = await createTestContext();
    const owner = context.client();
    await owner.register("torlo");
    const { map } = await json<MapResponse>(
      await owner.post("/api/maps", { title: "Eltűnő", content: "1 1\n>" }),
    );
    const version = (
      await context.deps.db
        .select()
        .from(mapVersions)
        .where(eq(mapVersions.id, map.currentVersionId))
    )[0];
    expect(version).toBeDefined();
    await owner.delete(`/api/maps/${map.id}`);
    const { executeAndRecord } = await import("../src/services/runs.ts");
    if (!version) {
      return;
    }
    const outcome = await executeAndRecord(context.deps.db, context.deps.engine, {
      userId: 1,
      version,
      source: "",
      now: 0,
    });
    expect(outcome.kind).toBe("missing");
  });
});

describe("indítási beállítások és korlátok", () => {
  test("a bejelentkezési korlát memóriája korlátos", () => {
    let clock = 0;
    const limiter = createLoginLimiter({ limit: 5, windowMs: 1000, now: () => clock });
    for (let index = 0; index < MAX_TRACKED_KEYS; index += 1) {
      limiter.record(`ip|nev${index}`);
    }
    expect(limiter.size).toBe(MAX_TRACKED_KEYS);
    limiter.record("ip|nev0");
    expect(limiter.size).toBe(MAX_TRACKED_KEYS);
    clock = 5000;
    limiter.record("ip|uj");
    expect(limiter.size).toBe(1);
    expect(limiter.isLimited("ip|uj")).toBe(false);
  });

  test("a port csak számjegyekből állhat, a hibás százalékos kódolás magyar hiba", () => {
    const env = { DATABASE_URL: "mysql://root@127.0.0.1/minescript" };
    for (const port of ["8080abc", "1e3", " 80", "0x50", "65536", ""]) {
      expect(() => parseConfig(["--port", port], env)).toThrow(`Érvénytelen port: ${port}`);
    }
    expect(parseConfig(["--port", "08080"], env).port).toBe(8080);
    for (const url of ["mysql://%zz@127.0.0.1/db", "mysql://root:%E0%A4%A@127.0.0.1/db"]) {
      expect(() => parseDatabaseUrl(url)).toThrow(DatabaseUrlError);
      expect(() => parseDatabaseUrl(url)).toThrow("hibás százalékos kódolást");
    }
  });

  test("az ismeretlen, hiányos vagy fölösleges kapcsoló magyar hibát ad", () => {
    const env = { DATABASE_URL: "mysql://root@127.0.0.1/minescript" };
    for (const argv of [["--xyz"], ["--port"], ["extra"], ["--no-open=igen"]]) {
      expect(() => parseConfig(argv, env)).toThrow(
        `Hibás parancssori kapcsoló: ${argv.join(" ")}. Használható kapcsolók:`,
      );
    }
  });
});
