import { describe, expect, test } from "vitest";
import {
  detectFamily,
  downloadHref,
  isDesktopShell,
  orderForFamily,
} from "../src/desktop/platform.ts";

describe("asztali letöltés platformja", () => {
  test("a böngésző platformjából családot ad", () => {
    expect(detectFamily({ userAgentData: { platform: "macOS" } })).toBe("mac");
    expect(detectFamily({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" })).toBe(
      "windows",
    );
    expect(detectFamily({ userAgent: "Mozilla/5.0 (X11; Linux x86_64)" })).toBe("linux");
    expect(
      detectFamily({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" }),
    ).toBeNull();
    expect(detectFamily({ userAgent: "Mozilla/5.0 (Linux; Android 15)" })).toBeNull();
    expect(detectFamily(undefined)).toBeNull();
  });

  test("a saját platform kerül előre", () => {
    expect(orderForFamily(["mac", "windows", "windows-msi", "linux"], "windows")).toEqual([
      "windows",
      "windows-msi",
      "mac",
      "linux",
    ]);
    expect(orderForFamily(["mac", "linux"], null)).toEqual(["mac", "linux"]);
  });

  test("az asztali héjban nincs letöltés, a cím a szerveren át megy", () => {
    expect(isDesktopShell({ dataset: { shell: "desktop" } })).toBe(true);
    expect(isDesktopShell({ dataset: {} })).toBe(false);
    expect(downloadHref("linux-deb")).toBe("/api/desktop/download/linux-deb");
  });
});
