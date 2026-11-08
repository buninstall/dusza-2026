import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { createApp } from "../src/app.ts";
import { parseConfig } from "../src/config.ts";
import {
  createDesktopReleases,
  type DesktopReleases,
  FRESH_MS,
  type GithubRelease,
  isTrustedDownload,
  pickLatest,
  RETRY_MS,
} from "../src/services/desktop.ts";
import { createTestContext } from "./helpers.ts";
import { TEST_TIMEOUT_MS } from "./timeout.ts";

setDefaultTimeout(TEST_TIMEOUT_MS);

const REPO = "csapat/minescript";

function asset(id: number, name: string, size = 1000) {
  return {
    id,
    name,
    size,
    state: "uploaded",
    browser_download_url: `https://github.com/${REPO}/releases/download/x/${name}`,
  };
}

function release(tag: string, publishedAt: string | null, names: string[], draft = false) {
  return {
    tag_name: tag,
    draft,
    prerelease: false,
    published_at: publishedAt,
    assets: names.map((name, index) => asset(index + 1, name)),
  } satisfies GithubRelease;
}

const DESKTOP_FILES = [
  "MineScript.Desktop_0.2.0_universal.dmg",
  "MineScript.Desktop_0.2.0_x64-setup.exe",
  "MineScript.Desktop_0.2.0_x64_en-US.msi",
  "MineScript.Desktop_0.2.0_amd64.AppImage",
  "MineScript.Desktop_0.2.0_amd64.deb",
  "MineScript.Desktop-0.2.0-1.x86_64.rpm",
  "latest.json",
];

const RELEASES = [
  release("v1.0.0", "2026-11-09T10:00:00Z", ["minescript-macos-arm64"]),
  release("desktop-v0.3.0-ccccccc", null, ["MineScript.Desktop_0.3.0_universal.dmg"], true),
  release("desktop-v0.2.0-bbbbbbb", "2026-11-08T10:00:00Z", DESKTOP_FILES),
  release("desktop-v0.1.0-aaaaaaa", "2026-11-07T10:00:00Z", ["MineScript.Desktop_0.1.0.dmg"]),
];

type Call = { url: string; init: RequestInit | undefined };

function fakeGithub(respond: (url: string, init?: RequestInit) => Response) {
  const calls: Call[] = [];
  const fetch = (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(respond(url, init));
  };
  return { calls, fetch };
}

function listing(body: unknown = RELEASES) {
  return () => Response.json(body);
}

describe("asztali kiadás kiválasztása", () => {
  test("a legfrissebb közzétett desktop-v kiadást választja, a vázlatot és a v-kiadást nem", () => {
    const latest = pickLatest(RELEASES);
    expect(latest?.tag).toBe("desktop-v0.2.0-bbbbbbb");
    expect(latest?.version).toBe("0.2.0");
    expect(latest?.assets.map((item) => [item.format, item.platform])).toEqual([
      ["dmg", "macos"],
      ["exe", "windows"],
      ["msi", "windows"],
      ["appimage", "linux"],
      ["deb", "linux"],
      ["rpm", "linux"],
    ]);
  });

  test("a félig feltöltött és az ismeretlen fájlokat kihagyja", () => {
    const partial = release("desktop-v0.4.0-ddddddd", "2026-11-10T10:00:00Z", [
      "MineScript.Desktop_0.4.0_universal.dmg",
      "notes.txt",
    ]);
    const [first] = partial.assets;
    const uploading = { ...partial, assets: first ? [{ ...first, state: "open" }] : [] };
    expect(pickLatest([uploading, ...RELEASES])?.tag).toBe("desktop-v0.2.0-bbbbbbb");
  });

  test("ha nincs használható kiadás, null", () => {
    expect(pickLatest([])).toBeNull();
    expect(pickLatest([release("v1.0.0", "2026-11-09T10:00:00Z", ["a.dmg"])])).toBeNull();
  });

  test("csak a GitHub https címeire enged továbbítani", () => {
    expect(isTrustedDownload("https://github.com/a/b/releases/download/x/a.dmg")).toBe(true);
    expect(isTrustedDownload("https://release-assets.githubusercontent.com/a?sig=1")).toBe(true);
    expect(isTrustedDownload("http://github.com/a.dmg")).toBe(false);
    expect(isTrustedDownload("https://github.com.evil.example/a.dmg")).toBe(false);
    expect(isTrustedDownload("https://evilgithub.com/a.dmg")).toBe(false);
    expect(isTrustedDownload("nem url")).toBe(false);
  });
});

describe("asztali kiadások forrása", () => {
  test("token nélkül a nyilvános listát kéri és a nyilvános letöltési címet adja", async () => {
    const github = fakeGithub(listing());
    const source = createDesktopReleases({ repo: REPO, fetch: github.fetch, log: () => {} });
    const latest = await source.latest();
    const dmg = latest?.assets.find((item) => item.format === "dmg");
    expect(github.calls[0]?.url).toBe(`https://api.github.com/repos/${REPO}/releases?per_page=30`);
    const headers = github.calls[0]?.init?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    expect(dmg && (await source.resolve(dmg))).toBe(dmg?.url ?? "hiányzik");
  });

  test("az eredményt a frissességi időn belül nem kéri le újra, utána igen", async () => {
    let clock = 0;
    const github = fakeGithub(listing());
    const source = createDesktopReleases({
      repo: REPO,
      fetch: github.fetch,
      now: () => clock,
      log: () => {},
    });
    await Promise.all([source.latest(), source.latest()]);
    expect(github.calls).toHaveLength(1);
    clock = FRESH_MS - 1;
    await source.latest();
    expect(github.calls).toHaveLength(1);
    clock = FRESH_MS;
    await source.latest();
    expect(github.calls).toHaveLength(2);
  });

  test("ha a GitHub hibázik, a korábbi eredményt adja, és rövid idő múlva újrapróbál", async () => {
    let clock = 0;
    let isDown = false;
    const logged: string[] = [];
    const github = fakeGithub(() =>
      isDown ? new Response("hiba", { status: 502 }) : Response.json(RELEASES),
    );
    const source = createDesktopReleases({
      repo: REPO,
      fetch: github.fetch,
      now: () => clock,
      log: (message) => logged.push(message),
    });
    expect((await source.latest())?.version).toBe("0.2.0");
    isDown = true;
    clock = FRESH_MS;
    expect((await source.latest())?.version).toBe("0.2.0");
    expect(logged).toHaveLength(1);
    clock = FRESH_MS + RETRY_MS - 1;
    await source.latest();
    expect(github.calls).toHaveLength(2);
    clock = FRESH_MS + RETRY_MS;
    await source.latest();
    expect(github.calls).toHaveLength(3);
  });

  test("az érvénytelen GitHub-válasz nem dönti el, csak nincs kiadás", async () => {
    const github = fakeGithub(listing({ message: "Not Found" }));
    const source = createDesktopReleases({ repo: REPO, fetch: github.fetch, log: () => {} });
    expect(await source.latest()).toBeNull();
  });

  test("tokennel az asset API aláírt átirányítását adja tovább", async () => {
    const signed =
      "https://release-assets.githubusercontent.com/github-production-release-asset/1?sig=x";
    const github = fakeGithub((url) =>
      url.includes("/releases/assets/")
        ? new Response(null, { status: 302, headers: { location: signed } })
        : Response.json(RELEASES),
    );
    const source = createDesktopReleases({
      repo: REPO,
      token: "titok",
      fetch: github.fetch,
      log: () => {},
    });
    const dmg = (await source.latest())?.assets.find((item) => item.format === "dmg");
    expect(dmg && (await source.resolve(dmg))).toBe(signed);
    const call = github.calls.at(-1);
    expect(call?.url).toBe(`https://api.github.com/repos/${REPO}/releases/assets/1`);
    expect(call?.init?.redirect).toBe("manual");
    const headers = call?.init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer titok");
    expect(headers.Accept).toBe("application/octet-stream");
  });

  test("idegen vagy hiányzó átirányítási cím esetén nem ad címet", async () => {
    let location: string | null = "https://evil.example/a.dmg";
    const github = fakeGithub((url) =>
      url.includes("/releases/assets/")
        ? new Response(null, {
            status: location ? 302 : 404,
            headers: location ? { location } : {},
          })
        : Response.json(RELEASES),
    );
    const source = createDesktopReleases({
      repo: REPO,
      token: "titok",
      fetch: github.fetch,
      log: () => {},
    });
    const dmg = (await source.latest())?.assets.find((item) => item.format === "dmg");
    expect(dmg && (await source.resolve(dmg))).toBeNull();
    location = null;
    expect(dmg && (await source.resolve(dmg))).toBeNull();
  });
});

describe("asztali kiadás beállításai", () => {
  test("alapból a csapat repóját használja token nélkül", () => {
    expect(parseConfig([], {}).desktop).toEqual({ repo: "buninstall/dusza-2026", token: null });
  });

  test("a repó és a token környezeti változóból jön", () => {
    const env = { MINESCRIPT_DESKTOP_REPO: REPO, MINESCRIPT_GITHUB_TOKEN: " titok " };
    expect(parseConfig([], env).desktop).toEqual({ repo: REPO, token: "titok" });
  });

  test("kikapcsolható, és teszt módban sosem szól a GitHubnak", () => {
    expect(parseConfig([], { MINESCRIPT_DESKTOP_REPO: "off" }).desktop).toBeNull();
    expect(parseConfig(["--test-mode"], {}).desktop).toBeNull();
  });

  test("az érvénytelen repónevet elutasítja", () => {
    expect(() => parseConfig([], { MINESCRIPT_DESKTOP_REPO: "../../evil" })).toThrow(
      /MINESCRIPT_DESKTOP_REPO/,
    );
  });
});

describe("asztali letöltés API", () => {
  const SIGNED = "https://release-assets.githubusercontent.com/x?sig=1";

  function fakeSource(resolved: string | null): DesktopReleases {
    const latest = pickLatest(RELEASES);
    return {
      latest: () => Promise.resolve(latest),
      resolve: () => Promise.resolve(resolved),
      manifest: () => Promise.resolve(null),
      file: () => Promise.resolve({ status: "missing" }),
    };
  }

  test("a kiadás adatait belső azonosítók és címek nélkül adja", async () => {
    await using ctx = await createTestContext();
    const app = createApp({ ...ctx.deps, desktop: fakeSource(SIGNED) });
    const response = await app.request("/api/desktop");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      release: { version: string; assets: Record<string, unknown>[] };
    };
    expect(body.release.version).toBe("0.2.0");
    expect(body.release.assets[0]).toEqual({ format: "dmg", platform: "macos", size: 1000 });
  });

  test("forrás nélkül üres választ ad, a letöltés 404", async () => {
    await using ctx = await createTestContext();
    expect(await (await ctx.app.request("/api/desktop")).json()).toEqual({ release: null });
    expect((await ctx.app.request("/api/desktop/download/dmg")).status).toBe(404);
  });

  test("a letöltés átirányít, nem tárolható, és csak ismert formátumot fogad", async () => {
    await using ctx = await createTestContext();
    const app = createApp({ ...ctx.deps, desktop: fakeSource(SIGNED) });
    const response = await app.request("/api/desktop/download/dmg");
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(SIGNED);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await app.request("/api/desktop/download/zip")).status).toBe(400);
  });

  test("ha az aláírt cím nem kérhető le, 503", async () => {
    await using ctx = await createTestContext();
    const app = createApp({ ...ctx.deps, desktop: fakeSource(null) });
    const response = await app.request("/api/desktop/download/exe");
    expect(response.status).toBe(503);
  });
});

describe("asztali frissítő", () => {
  const TOKEN = "github_pat_test";
  const SIGNED = "https://release-assets.githubusercontent.com/signed";
  const MANIFEST = {
    version: "0.2.0",
    pub_date: "2026-11-08T10:00:00Z",
    platforms: {
      "darwin-aarch64-app": {
        url: "MineScript-Desktop_0.2.0_universal.app.tar.gz",
        signature: "sig-mac",
      },
      "windows-x86_64-nsis": {
        url: "MineScript.Desktop_0.2.0_x64-setup.exe",
        signature: "sig-win",
      },
    },
  };
  const UPDATER_RELEASES = [
    release("desktop-v0.2.0", "2026-11-08T10:00:00Z", [
      ...DESKTOP_FILES,
      "MineScript-Desktop_0.2.0_universal.app.tar.gz",
    ]),
  ];
  const idOf = (name: string) =>
    UPDATER_RELEASES[0]?.assets.find((item) => item.name === name)?.id ?? -1;

  function github(manifestBody: unknown = MANIFEST) {
    return fakeGithub((url) => {
      if (url.includes("/releases?")) return Response.json(UPDATER_RELEASES);
      const asset = /\/releases\/assets\/(\d+)$/.exec(url);
      if (asset) {
        return new Response(null, { status: 302, headers: { location: `${SIGNED}/${asset[1]}` } });
      }
      if (url === `${SIGNED}/${idOf("latest.json")}`) return Response.json(manifestBody);
      if (url.startsWith(`${SIGNED}/`)) {
        return new Response(`bytes-${url.slice(SIGNED.length + 1)}`, {
          headers: { "content-length": "7" },
        });
      }
      return new Response("nope", { status: 404 });
    });
  }

  function source(fake: ReturnType<typeof github>) {
    return createDesktopReleases({ repo: REPO, token: TOKEN, fetch: fake.fetch, log: () => {} });
  }

  test("a manifest letöltési címei a szerveren át mennek, a token nem kerül ki", async () => {
    await using ctx = await createTestContext();
    const fake = github();
    const app = createApp({ ...ctx.deps, desktop: source(fake) });
    const response = await app.request("http://127.0.0.1:8080/api/desktop/latest.json", {
      headers: { host: "csapat13.example.hu", "x-forwarded-proto": "https" },
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as typeof MANIFEST;
    expect(body.version).toBe("0.2.0");
    expect(body.platforms["darwin-aarch64-app"]).toEqual({
      url: "https://csapat13.example.hu/api/desktop/download/file/MineScript-Desktop_0.2.0_universal.app.tar.gz",
      signature: "sig-mac",
    });
    expect(JSON.stringify(body)).not.toContain(TOKEN);
    for (const call of fake.calls.filter((item) => item.url.startsWith(SIGNED))) {
      expect(new Headers(call.init?.headers).get("authorization")).toBeNull();
    }
  });

  test("a frissítő fájlja a szerveren át jön, átirányítás nélkül", async () => {
    await using ctx = await createTestContext();
    const app = createApp({ ...ctx.deps, desktop: source(github()) });
    const name = "MineScript-Desktop_0.2.0_universal.app.tar.gz";
    const response = await app.request(`/api/desktop/download/file/${name}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("content-type")).toBe("application/octet-stream");
    expect(await response.text()).toBe(`bytes-${idOf(name)}`);
    expect((await app.request("/api/desktop/download/file/latest.json")).status).toBe(404);
    expect((await app.request("/api/desktop/download/file/x.exe")).status).toBe(404);
  });

  test("hibás vagy hiányzó manifest esetén a frissítő 204-et kap", async () => {
    await using ctx = await createTestContext();
    const broken = createApp({ ...ctx.deps, desktop: source(github({ version: 1 })) });
    expect((await broken.request("/api/desktop/latest.json")).status).toBe(204);
    expect((await ctx.app.request("/api/desktop/latest.json")).status).toBe(204);
  });
});
