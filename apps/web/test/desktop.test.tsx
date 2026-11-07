import { screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { detectPlatform, isDesktopShell } from "../src/desktop/platform.ts";
import { type DesktopRelease, formatSize, pickOffer } from "../src/desktop/release.ts";
import { respond } from "./support/api.ts";
import { renderApp } from "./support/app.tsx";
import { mapSummary } from "./support/fixtures.ts";

const MAC_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const WINDOWS_EDGE =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0";
const LINUX_FIREFOX = "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const CHROMEOS =
  "Mozilla/5.0 (X11; CrOS x86_64 15359.58.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

const RELEASE: DesktopRelease = {
  version: "0.2.0",
  publishedAt: "2026-11-08T10:00:00Z",
  assets: [
    { format: "dmg", platform: "macos", size: 6_864_864 },
    { format: "exe", platform: "windows", size: 2_516_707 },
    { format: "msi", platform: "windows", size: 3_403_776 },
    { format: "appimage", platform: "linux", size: 82_381_304 },
    { format: "deb", platform: "linux", size: 4_257_694 },
    { format: "rpm", platform: "linux", size: 4_262_720 },
  ],
};

describe("platformfelismerés", () => {
  test("a három asztali rendszert felismeri", () => {
    expect(detectPlatform({ userAgent: MAC_SAFARI, platform: "MacIntel", maxTouchPoints: 0 })).toBe(
      "macos",
    );
    expect(detectPlatform({ userAgent: WINDOWS_EDGE, platform: "Win32" })).toBe("windows");
    expect(detectPlatform({ userAgent: LINUX_FIREFOX, platform: "Linux x86_64" })).toBe("linux");
  });

  test("a User-Agent Client Hints platformját is figyelembe veszi", () => {
    const nav = { userAgent: "", userAgentData: { platform: "macOS", mobile: false } };
    expect(detectPlatform(nav)).toBe("macos");
    expect(detectPlatform({ userAgent: "", userAgentData: { platform: "Windows" } })).toBe(
      "windows",
    );
  });

  test("telefonon, tableten és ChromeOS-en nem ajánl letöltést", () => {
    expect(detectPlatform({ userAgent: ANDROID, platform: "Linux armv8l" })).toBeNull();
    expect(detectPlatform({ userAgent: IPHONE, platform: "iPhone" })).toBeNull();
    expect(detectPlatform({ userAgent: CHROMEOS, platform: "Linux x86_64" })).toBeNull();
    expect(detectPlatform({ userAgent: "", userAgentData: { mobile: true } })).toBeNull();
    expect(detectPlatform({ userAgent: "", userAgentData: { platform: "Chrome OS" } })).toBeNull();
  });

  test("a Macnek álcázott iPadet érintőpontjairól ismeri fel", () => {
    expect(detectPlatform({ userAgent: MAC_SAFARI, platform: "MacIntel", maxTouchPoints: 5 })).toBe(
      null,
    );
  });

  test("ismeretlen rendszeren nem ajánl semmit", () => {
    expect(detectPlatform({ userAgent: "Mozilla/5.0 (PlayStation 5)" })).toBeNull();
  });

  test("az asztali kliens a data-shell jelzőről ismerhető fel", () => {
    const root = document.createElement("html");
    expect(isDesktopShell(root)).toBe(false);
    root.dataset.shell = "desktop";
    expect(isDesktopShell(root)).toBe(true);
    expect(isDesktopShell(null)).toBe(false);
  });
});

describe("letöltési ajánlat", () => {
  test("rendszerenként a fő formátumot ajánlja, a többit a menübe teszi", () => {
    expect(pickOffer(RELEASE, "macos")?.primary.format).toBe("dmg");
    expect(pickOffer(RELEASE, "windows")?.primary.format).toBe("exe");
    const linux = pickOffer(RELEASE, "linux");
    expect(linux?.primary.format).toBe("appimage");
    expect(linux?.others.map((asset) => asset.format)).toEqual(["dmg", "exe", "msi", "deb", "rpm"]);
  });

  test("ha a fő formátum hiányzik, a rendszer másik fájlját adja, ha egy sincs, null", () => {
    const onlyMsi = { ...RELEASE, assets: RELEASE.assets.filter((a) => a.format === "msi") };
    expect(pickOffer(onlyMsi, "windows")?.primary.format).toBe("msi");
    expect(pickOffer(onlyMsi, "macos")).toBeNull();
  });

  test("a méretet magyar formában, megabájtban írja", () => {
    expect(formatSize(6_864_864)).toBe("6,9 MB");
    expect(formatSize(82_381_304)).toBe("82,4 MB");
  });
});

function pretend(userAgent: string, platform: string): void {
  vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(userAgent);
  vi.spyOn(window.navigator, "platform", "get").mockReturnValue(platform);
}

describe("letöltés a felületen", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete document.documentElement.dataset.shell;
  });

  test("a belépő oldal alján a felismert rendszerre ajánlja az appot", async () => {
    pretend(MAC_SAFARI, "MacIntel");
    renderApp("/login", "none");
    respond("GET", "/desktop", { release: RELEASE });
    const link = await screen.findByRole("link", { name: "Asztali alkalmazás macOS-re" });
    expect(link.getAttribute("href")).toBe("/api/desktop/download/dmg");
    expect(link.hasAttribute("download")).toBe(true);
    expect(screen.getByText("v0.2.0 · 6,9 MB")).toBeTruthy();
  });

  test("a további formátumok menüből érhetők el", async () => {
    pretend(LINUX_FIREFOX, "Linux x86_64");
    const { user } = renderApp("/login", "none");
    respond("GET", "/desktop", { release: RELEASE });
    await user.click(
      await screen.findByRole("button", { name: /más rendszerre vagy formátumban/i }),
    );
    const item = await screen.findByRole("menuitem", { name: /\.deb/ });
    expect(item.getAttribute("href")).toBe("/api/desktop/download/deb");
  });

  test("az asztali kliensben nem ajánlja önmagát, és nem is kérdezi a szervert", async () => {
    pretend(MAC_SAFARI, "MacIntel");
    document.documentElement.dataset.shell = "desktop";
    renderApp("/login", "none");
    respond("GET", "/desktop", { release: RELEASE });
    expect(await screen.findByRole("heading", { level: 1, name: "Bejelentkezés" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Asztali alkalmazás/ })).toBeNull();
  });

  test("ha nincs kiadás, nincs tábla", async () => {
    pretend(WINDOWS_EDGE, "Win32");
    renderApp("/login", "none");
    respond("GET", "/desktop", { release: null });
    expect(await screen.findByRole("heading", { level: 1, name: "Bejelentkezés" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Asztali alkalmazás/ })).toBeNull();
  });

  test("bejelentkezve a felhasználói menüben is letölthető", async () => {
    pretend(WINDOWS_EDGE, "Win32");
    const { user } = renderApp("/maps");
    respond("GET", "/desktop", { release: RELEASE });
    respond("GET", "/maps", { maps: [mapSummary] });
    await user.click(await screen.findByRole("button", { name: /Felhasználói menü/ }));
    const item = await screen.findByRole("menuitem", {
      name: "Asztali alkalmazás letöltése Windowsra",
    });
    expect(item.getAttribute("href")).toBe("/api/desktop/download/exe");
  });
});
