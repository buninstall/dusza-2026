import { describe, expect, test } from "bun:test";
import { createApp } from "../src/app.ts";
import type { Deps } from "../src/env.ts";
import {
  createDesktopReleases,
  DESKTOP_CACHE_MS,
  desktopReleasesFromEnv,
} from "../src/services/desktop.ts";

const TOKEN = "github_pat_test";
const SIGNED = "https://release-assets.githubusercontent.com/signed";
const manifest = {
  version: "0.1.42",
  notes: "feat: valami",
  pub_date: "2026-11-07T18:00:00Z",
  platforms: {
    "darwin-aarch64-app": {
      url: "MineScript-Desktop_0.1.42_universal.app.tar.gz",
      signature: "sig-mac",
    },
    "windows-x86_64-nsis": {
      url: "MineScript-Desktop_0.1.42_x64-setup.exe",
      signature: "sig-win",
    },
  },
};
const assets = [
  { id: 1, name: "latest.json" },
  { id: 2, name: "MineScript-Desktop_0.1.42_universal.app.tar.gz" },
  { id: 3, name: "MineScript-Desktop_0.1.42_x64-setup.exe" },
  { id: 4, name: "MineScript-Desktop_0.1.42_universal.dmg" },
  { id: 5, name: "minescript-desktop_0.1.42_amd64.AppImage" },
];
const releases = [
  { tag_name: "desktop-v0.1.43", draft: true, prerelease: false, published_at: null, assets },
  { tag_name: "v1.0.0", draft: false, prerelease: false, published_at: null, assets: [] },
  {
    tag_name: "desktop-v0.1.42",
    draft: false,
    prerelease: false,
    published_at: "2026-11-07T18:00:00Z",
    assets,
  },
];

type ErrorBody = { error: { code: string } };
type Call = { url: string; init?: RequestInit | undefined };

function fakeGithub(options: { releases?: unknown[]; status?: number } = {}) {
  const calls: Call[] = [];
  const fetch = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url.endsWith("/releases?per_page=30")) {
      return Response.json(options.releases ?? releases, { status: options.status ?? 200 });
    }
    const asset = url.match(/\/releases\/assets\/(\d+)$/);
    if (asset) {
      return new Response(null, { status: 302, headers: { location: `${SIGNED}/${asset[1]}` } });
    }
    if (url === `${SIGNED}/1`) {
      return Response.json(manifest);
    }
    if (url.startsWith(`${SIGNED}/`)) {
      return new Response(`bytes-${url.slice(SIGNED.length + 1)}`, {
        headers: { "content-length": "7" },
      });
    }
    return new Response("nope", { status: 404 });
  };
  return { calls, fetch };
}

function appWith(desktop: Deps["desktop"]) {
  const deps = { now: () => 0, desktop } as unknown as Deps;
  return createApp(deps, { logError: () => undefined });
}

function get(app: ReturnType<typeof appWith>, path: string, headers: Record<string, string> = {}) {
  return app.request(`http://127.0.0.1:8080${path}`, { headers });
}

describe("asztali kliens kiadásai", () => {
  test("a manifest letöltési címei a szerveren át mennek, a token nem kerül ki", async () => {
    const github = fakeGithub();
    const app = appWith(createDesktopReleases({ repo: "o/r", token: TOKEN, fetch: github.fetch }));
    const response = await get(app, "/api/desktop/latest.json", {
      host: "csapat13.example.hu",
      "x-forwarded-proto": "https",
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as typeof manifest;
    expect(body.version).toBe("0.1.42");
    expect(body.platforms["darwin-aarch64-app"]).toEqual({
      url: "https://csapat13.example.hu/api/desktop/download/file/MineScript-Desktop_0.1.42_universal.app.tar.gz",
      signature: "sig-mac",
    });
    expect(JSON.stringify(body)).not.toContain(TOKEN);
    const apiCalls = github.calls.filter((call) => call.url.startsWith("https://api.github.com"));
    expect(apiCalls.length).toBeGreaterThan(0);
    for (const call of apiCalls) {
      expect(new Headers(call.init?.headers).get("authorization")).toBe(`Bearer ${TOKEN}`);
    }
    const signed = github.calls.find((call) => call.url.startsWith(SIGNED));
    expect(new Headers(signed?.init?.headers).get("authorization")).toBeNull();
  });

  test("a vázlat és a nem asztali kiadás kimarad", async () => {
    const github = fakeGithub();
    const releasesApi = createDesktopReleases({ repo: "o/r", token: TOKEN, fetch: github.fetch });
    expect((await releasesApi.info())?.version).toBe("0.1.42");
  });

  test("a platform-letöltés a GitHub aláírt címére irányít", async () => {
    const app = appWith(
      createDesktopReleases({ repo: "o/r", token: TOKEN, fetch: fakeGithub().fetch }),
    );
    const mac = await get(app, "/api/desktop/download/mac");
    expect(mac.status).toBe(302);
    expect(mac.headers.get("location")).toBe(`${SIGNED}/4`);
    const linux = await get(app, "/api/desktop/download/linux");
    expect(linux.headers.get("location")).toBe(`${SIGNED}/5`);
  });

  test("a frissítő a fájlt a szerveren át kapja, átirányítás nélkül", async () => {
    const github = fakeGithub();
    const app = appWith(createDesktopReleases({ repo: "o/r", token: TOKEN, fetch: github.fetch }));
    const file = await get(
      app,
      "/api/desktop/download/file/MineScript-Desktop_0.1.42_x64-setup.exe",
    );
    expect(file.status).toBe(200);
    expect(file.headers.get("location")).toBeNull();
    expect(file.headers.get("content-type")).toBe("application/octet-stream");
    expect(await file.text()).toBe("bytes-3");
    const download = github.calls.find((call) => call.url === `${SIGNED}/3`);
    expect(new Headers(download?.init?.headers).get("authorization")).toBeNull();
  });

  test("ismeretlen platform és fájl 404, hiányzó csomag is", async () => {
    const app = appWith(
      createDesktopReleases({ repo: "o/r", token: TOKEN, fetch: fakeGithub().fetch }),
    );
    expect((await get(app, "/api/desktop/download/amiga")).status).toBe(404);
    expect((await get(app, "/api/desktop/download/file/latest.json")).status).toBe(404);
    expect((await get(app, "/api/desktop/download/file/x.exe")).status).toBe(404);
    expect((await get(app, "/api/desktop/download/linux-rpm")).status).toBe(404);
  });

  test("az info a platformonkénti fájlneveket adja", async () => {
    const app = appWith(
      createDesktopReleases({ repo: "o/r", token: TOKEN, fetch: fakeGithub().fetch }),
    );
    const body = await (await get(app, "/api/desktop/info")).json();
    expect(body).toEqual({
      version: "0.1.42",
      publishedAt: "2026-11-07T18:00:00Z",
      files: {
        mac: "MineScript-Desktop_0.1.42_universal.dmg",
        windows: "MineScript-Desktop_0.1.42_x64-setup.exe",
        "windows-msi": null,
        linux: "minescript-desktop_0.1.42_amd64.AppImage",
        "linux-deb": null,
        "linux-rpm": null,
      },
    });
  });

  test("kiadás nélkül a frissítő 204-et kap", async () => {
    const app = appWith(
      createDesktopReleases({
        repo: "o/r",
        token: TOKEN,
        fetch: fakeGithub({ releases: [] }).fetch,
      }),
    );
    expect((await get(app, "/api/desktop/latest.json")).status).toBe(204);
    expect((await get(app, "/api/desktop/info")).status).toBe(404);
  });

  test("GitHub-hiba 503", async () => {
    const app = appWith(
      createDesktopReleases({
        repo: "o/r",
        token: TOKEN,
        fetch: fakeGithub({ status: 401 }).fetch,
      }),
    );
    const response = await get(app, "/api/desktop/latest.json");
    expect(response.status).toBe(503);
    expect(((await response.json()) as ErrorBody).error.code).toBe("DESKTOP_UNAVAILABLE");
  });

  test("a kiadáslista gyorsítótárazott", async () => {
    let clock = 0;
    const github = fakeGithub();
    const releasesApi = createDesktopReleases({
      repo: "o/r",
      token: TOKEN,
      fetch: github.fetch,
      now: () => clock,
    });
    await Promise.all([releasesApi.info(), releasesApi.info()]);
    await releasesApi.info();
    const listings = () => github.calls.filter((call) => call.url.endsWith("per_page=30")).length;
    expect(listings()).toBe(1);
    clock += DESKTOP_CACHE_MS + 1;
    await releasesApi.info();
    expect(listings()).toBe(2);
  });

  test("token nélkül nincs beállítva", async () => {
    expect(desktopReleasesFromEnv({})).toBeUndefined();
    expect(desktopReleasesFromEnv({ DESKTOP_RELEASES_TOKEN: "  " })).toBeUndefined();
    expect(desktopReleasesFromEnv({ DESKTOP_RELEASES_TOKEN: "x" })).toBeDefined();
    const response = await get(appWith(undefined), "/api/desktop/latest.json");
    expect(response.status).toBe(404);
    expect(((await response.json()) as ErrorBody).error.code).toBe("DESKTOP_NOT_CONFIGURED");
  });
});
