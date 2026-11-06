import {
  type APIRequestContext,
  expect,
  request as playwrightRequest,
  test,
} from "@playwright/test";
import { DEMO, login } from "./helpers.ts";

type MapSummary = { id: number; title: string; versionId: number };

const suffix = Date.now().toString(36);

async function apiContext(baseURL: string): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
}

async function signedIn(
  baseURL: string,
  username: string,
  password: string,
  register = false,
): Promise<APIRequestContext> {
  const api = await apiContext(baseURL);
  if (register) {
    const created = await api.post("/api/auth/register", { data: { username, password } });
    expect(created.status()).toBe(201);
  }
  const response = await api.post("/api/auth/login", { data: { username, password } });
  expect(response.status()).toBe(200);
  return api;
}

async function mapByTitle(api: APIRequestContext, title: string): Promise<MapSummary> {
  const body = (await (await api.get("/api/maps")).json()) as { maps: MapSummary[] };
  const found = body.maps.find((map) => map.title === title);
  if (!found) throw new Error(`Nincs ilyen térkép: ${title}`);
  return found;
}

function keysOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysOf);
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, inner]) => [key, ...keysOf(inner)]);
  }
  return [];
}

test.describe("hitelesítés és jogosultság", () => {
  const PROTECTED = [
    "/api/auth/me",
    "/api/maps",
    "/api/maps/1",
    "/api/maps/1/export",
    "/api/maps/1/leaderboard",
    "/api/programs",
    "/api/runs/1",
    "/api/me/runs",
    "/api/admin/users",
  ];

  for (const path of PROTECTED) {
    test(`${path} bejelentkezés nélkül 401`, async ({ baseURL }) => {
      const api = await apiContext(baseURL ?? "");
      expect((await api.get(path)).status()).toBe(401);
    });
  }

  test("bejelentkezés nélkül a futás mentése 401", async ({ baseURL }) => {
    const api = await apiContext(baseURL ?? "");
    const response = await api.post("/api/runs", { data: { mapVersionId: 1, source: "" } });
    expect(response.status()).toBe(401);
  });

  test("bejelentkezés nélkül a felület a bejelentkezésre irányít", async ({ page }) => {
    await page.goto("/maps");
    await expect(page).toHaveURL(/\/login/);
  });

  test("idegen Origin fejlécű módosító kérést a szerver 403-mal elutasít", async ({ baseURL }) => {
    const api = await playwrightRequest.newContext({
      baseURL: baseURL ?? "",
      extraHTTPHeaders: { Origin: "http://tamado.example" },
    });
    const response = await api.post("/api/auth/login", { data: DEMO });
    expect(response.status()).toBe(403);
  });

  test("Origin fejléc nélküli módosító kérést a szerver 403-mal elutasít", async ({ baseURL }) => {
    const api = await playwrightRequest.newContext({ baseURL: baseURL ?? "" });
    expect((await api.post("/api/auth/login", { data: DEMO })).status()).toBe(403);
  });

  test("kijelentkezés után a régi munkamenet-süti érvénytelen", async ({ baseURL }) => {
    const api = await signedIn(baseURL ?? "", DEMO.username, DEMO.password);
    const cookie = (await api.storageState()).cookies.find((item) => item.name === "ms_session");
    expect(cookie).toBeDefined();
    expect((await api.post("/api/auth/logout")).status()).toBe(200);
    const replay = await apiContext(baseURL ?? "");
    const response = await replay.get("/api/auth/me", {
      headers: { Cookie: `ms_session=${cookie?.value}` },
    });
    expect(response.status()).toBe(401);
  });

  test("más felhasználó privát térképe nem olvasható, nem exportálható és nem törölhető (IDOR)", async ({
    baseURL,
  }) => {
    const owner = await signedIn(baseURL ?? "", `e2etulaj${suffix}`, "jelszo-tulaj-1", true);
    const created = await owner.post("/api/maps", {
      data: { title: "Privát térkép", visibility: "private", content: "1 2\n>@\n" },
    });
    expect(created.status()).toBe(201);
    const createdBody = (await created.json()) as { map?: { id: number }; id?: number };
    const mapId = createdBody.map?.id ?? createdBody.id;
    expect(typeof mapId).toBe("number");
    const other = await signedIn(baseURL ?? "", `e2emasik${suffix}`, "jelszo-masik-1", true);
    expect((await other.get(`/api/maps/${mapId}`)).status()).toBe(404);
    expect((await other.get(`/api/maps/${mapId}/export`)).status()).toBe(404);
    expect((await other.get(`/api/maps/${mapId}/leaderboard`)).status()).toBe(404);
    expect([403, 404]).toContain((await other.delete(`/api/maps/${mapId}`)).status());
    expect((await owner.get(`/api/maps/${mapId}`)).status()).toBe(200);
  });

  test("privát pályán futott futás részletei másnak nem kérhetők le, nyilvánoson megoszthatók", async ({
    baseURL,
  }) => {
    const owner = await signedIn(baseURL ?? "", `e2efutas${suffix}`, "jelszo-futas-1", true);
    const created = await owner.post("/api/maps", {
      data: { title: "Privát futópálya", visibility: "private", content: "1 2\n>@\n" },
    });
    expect(created.status()).toBe(201);
    const createdBody = (await created.json()) as { map: { id: number } };
    const detail = (await (await owner.get(`/api/maps/${createdBody.map.id}`)).json()) as {
      version: { id: number };
    };
    const privateRun = await owner.post("/api/runs", {
      data: { mapVersionId: detail.version.id, source: "" },
    });
    expect(privateRun.status()).toBe(201);
    const privateRunId = ((await privateRun.json()) as { run: { id: number } }).run.id;

    const demo = await signedIn(baseURL ?? "", DEMO.username, DEMO.password);
    const map = await mapByTitle(demo, "1. Egyenes folyosó");
    const publicRun = await demo.post("/api/runs", {
      data: { mapVersionId: map.versionId, source: "" },
    });
    expect(publicRun.status()).toBe(201);
    const publicRunId = ((await publicRun.json()) as { run: { id: number } }).run.id;

    const other = await signedIn(baseURL ?? "", `e2eidegen${suffix}`, "jelszo-idegen-1", true);
    expect((await other.get(`/api/runs/${privateRunId}`)).status()).toBe(404);
    expect((await owner.get(`/api/runs/${privateRunId}`)).status()).toBe(200);
    expect((await other.get(`/api/runs/${publicRunId}`)).status()).toBe(200);
  });

  test("közönséges felhasználó nem éri el az adminisztrációs végpontot", async ({ baseURL }) => {
    const user = await signedIn(baseURL ?? "", `e2enemadmin${suffix}`, "jelszo-nemadmin-1", true);
    expect([403, 404]).toContain((await user.get("/api/admin/users")).status());
  });
});

test.describe("ranglista-integritás", () => {
  test("a kliens által küldött arany- és lépésszámot a szerver figyelmen kívül hagyja", async ({
    baseURL,
  }) => {
    const api = await signedIn(baseURL ?? "", `e2ecsalo${suffix}`, "jelszo-csalo-1", true);
    const map = await mapByTitle(api, "1. Egyenes folyosó");
    const response = await api.post("/api/runs", {
      data: { mapVersionId: map.versionId, source: "", gold: 999, steps: 1 },
    });
    if (response.status() === 201) {
      const body = (await response.json()) as { run: { gold: number; steps: number } };
      expect(body.run).toMatchObject({ gold: 0, steps: 0 });
    } else {
      expect(response.status()).toBe(400);
    }
    const board = await api.get(`/api/maps/${map.id}/leaderboard`);
    expect(board.status()).toBe(200);
    expect(JSON.stringify(await board.json())).not.toContain("999");
  });

  test("a szerver a forrásból számol: futásidejű hibánál a hibakód és a hibasor a motoré", async ({
    baseURL,
  }) => {
    const api = await signedIn(baseURL ?? "", DEMO.username, DEMO.password);
    const map = await mapByTitle(api, "1. Egyenes folyosó");
    const response = await api.post("/api/runs", {
      data: { mapVersionId: map.versionId, source: "print 1\nprint x\n" },
    });
    expect(response.status()).toBe(201);
    const body = (await response.json()) as {
      run: { steps: number; errorCode: string; errorLine: number };
      console: string[];
    };
    expect(body.run).toMatchObject({ steps: 2, errorCode: "E_UNINITIALIZED", errorLine: 2 });
    expect(body.console).toEqual(["1"]);
  });

  test("szintaktikailag hibás program futása 422, és nem kerül a futások közé", async ({
    baseURL,
  }) => {
    const api = await signedIn(baseURL ?? "", `e2eszintaxis${suffix}`, "jelszo-szintaxis-1", true);
    const map = await mapByTitle(api, "1. Egyenes folyosó");
    const response = await api.post("/api/runs", {
      data: { mapVersionId: map.versionId, source: "step  forward 1\n" },
    });
    expect(response.status()).toBe(422);
    const runs = (await (await api.get("/api/me/runs")).json()) as { runs: unknown[] };
    expect(runs.runs).toHaveLength(0);
  });

  test("az 1000 soros limitet a szerver is alkalmazza", async ({ baseURL }) => {
    const api = await signedIn(baseURL ?? "", DEMO.username, DEMO.password);
    const map = await mapByTitle(api, "1. Egyenes folyosó");
    const response = await api.post("/api/runs", {
      data: { mapVersionId: map.versionId, source: "while true\n    print 1\n" },
    });
    expect(response.status()).toBe(201);
    const body = (await response.json()) as {
      run: { steps: number; errorCode: string; errorLine: number };
    };
    expect(body.run).toMatchObject({
      steps: 1000,
      errorCode: "INSTRUCTION_COUNT_LIMIT_EXCEEDED",
      errorLine: 1,
    });
  });
});

test.describe("jelszó, munkamenet, hibaválaszok", () => {
  test("a munkamenet-süti HttpOnly és SameSite=Lax", async ({ baseURL }) => {
    const api = await apiContext(baseURL ?? "");
    const response = await api.post("/api/auth/login", { data: DEMO });
    const header = response
      .headersArray()
      .filter((item) => item.name.toLowerCase() === "set-cookie")
      .map((item) => item.value)
      .find((value) => value.startsWith("ms_session="));
    expect(header).toBeDefined();
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=Lax/i);
  });

  test("a bejelentkezési válasz és a /me nem tartalmaz jelszót vagy jelszó-hasht", async ({
    baseURL,
  }) => {
    const api = await apiContext(baseURL ?? "");
    const loginBody = await (await api.post("/api/auth/login", { data: DEMO })).json();
    const meBody = await (await api.get("/api/auth/me")).json();
    for (const body of [loginBody, meBody]) {
      expect(JSON.stringify(body)).not.toContain(DEMO.password);
      expect(keysOf(body).filter((key) => /pass|hash|salt/i.test(key))).toEqual([]);
    }
  });

  test("a jelszó nem kerül a böngésző tárolóiba", async ({ page }) => {
    await login(page);
    const stored = await page.evaluate(() =>
      JSON.stringify({ local: { ...window.localStorage }, session: { ...window.sessionStorage } }),
    );
    expect(stored).not.toContain(DEMO.password);
    expect(page.url()).not.toContain(DEMO.password);
  });

  test("ötödik hibás jelszó után a belépés 429-cel korlátozott", async ({ baseURL }) => {
    const api = await apiContext(baseURL ?? "");
    const username = `e2ebrute${suffix}`;
    await api.post("/api/auth/register", { data: { username, password: "helyes-jelszo-1" } });
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await api.post("/api/auth/login", {
        data: { username, password: "rossz-jelszo-1" },
      });
      statuses.push(response.status());
    }
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses[5]).toBe(429);
  });

  const INJECTIONS = [
    "' OR '1'='1",
    "admin'--",
    '"; DROP TABLE users; --',
    "$(rm -rf /)",
    '{"$gt":""}',
  ];
  for (const username of INJECTIONS) {
    test(`injektálás-jellegű felhasználónév (${username}) érthető 400-at kap, nem 500-at`, async ({
      baseURL,
    }) => {
      const api = await apiContext(baseURL ?? "");
      const response = await api.post("/api/auth/login", {
        data: { username, password: "x".repeat(8) },
      });
      expect(response.status()).toBe(400);
      const text = await response.text();
      expect(text).not.toMatch(/\bat \S+\.(ts|js):\d+|node_modules|[A-Z]:\\|SQL syntax|ER_/);
    });
  }

  test("hibás JSON törzsre 400 jön, stack trace és belső útvonal nélkül", async ({ baseURL }) => {
    const api = await apiContext(baseURL ?? "");
    const response = await api.post("/api/auth/login", {
      headers: { "Content-Type": "application/json" },
      data: "{nem json",
    });
    expect(response.status()).toBe(400);
    expect(await response.text()).not.toMatch(/\bat \S+\.(ts|js):\d+|node_modules|[A-Z]:\\/);
  });

  test("túl nagy kéréstörzset a szerver elutasít, és utána is működik", async ({ baseURL }) => {
    const api = await signedIn(baseURL ?? "", DEMO.username, DEMO.password);
    const outcome = await api
      .post("/api/runs", { data: { mapVersionId: 1, source: "print 1\n".repeat(200_000) } })
      .then((response) => String(response.status()))
      .catch((error: Error) =>
        /ECONNRESET|EPIPE|socket hang up/.test(error.message) ? "reset" : error.message,
      );
    expect(["400", "413", "reset"]).toContain(outcome);
    const health = await (await apiContext(baseURL ?? "")).get("/api/health");
    expect(health.status()).toBe(200);
  });

  test("a válaszokban ott vannak a biztonsági fejlécek", async ({ baseURL }) => {
    const api = await apiContext(baseURL ?? "");
    const headers = (await api.get("/")).headers();
    expect(headers["content-security-policy"]).toContain("default-src 'self'");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["access-control-allow-origin"]).toBeUndefined();
  });
});

test.describe("XSS", () => {
  const PAYLOAD = '"><img src=x onerror="window.__xss=1"><script>window.__xss=2</script>';

  test("a térkép címében és leírásában lévő HTML szövegként jelenik meg, nem fut le", async ({
    page,
    baseURL,
  }) => {
    const api = await signedIn(baseURL ?? "", DEMO.username, DEMO.password);
    const title = `XSS ${suffix} ${PAYLOAD}`.slice(0, 60);
    const created = await api.post("/api/maps", {
      data: { title, description: PAYLOAD, visibility: "private", content: "1 2\n>@\n" },
    });
    expect(created.status()).toBe(201);
    await login(page);
    await expect(page.getByText(`XSS ${suffix}`, { exact: false }).first()).toBeVisible();
    expect(await page.evaluate(() => (window as { __xss?: number }).__xss)).toBeUndefined();
    expect(await page.locator("img[src='x']").count()).toBe(0);
  });

  test("javascript: séma a felhasználónévben nem megengedett", async ({ baseURL }) => {
    const api = await apiContext(baseURL ?? "");
    const response = await api.post("/api/auth/register", {
      data: { username: "javascript:alert(1)", password: "jelszo-xss-1" },
    });
    expect(response.status()).toBe(400);
  });
});
