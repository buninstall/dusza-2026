export type DesktopPlatform = "macos" | "windows" | "linux";

export type NavigatorLike = {
  userAgent: string;
  platform?: string | undefined;
  maxTouchPoints?: number | undefined;
  userAgentData?: { platform?: string | undefined; mobile?: boolean | undefined } | undefined;
};

const NOT_DESKTOP = /android|iphone|ipad|ipod|mobile|cros|chrome os/i;
const TOUCH_MAC_POINTS = 1;

export function isDesktopShell(root: { dataset: DOMStringMap } | null): boolean {
  return root?.dataset.shell === "desktop";
}

export function detectPlatform(nav: NavigatorLike): DesktopPlatform | null {
  if (nav.userAgentData?.mobile) {
    return null;
  }
  const source = [nav.userAgentData?.platform, nav.platform, nav.userAgent].join(" ");
  if (NOT_DESKTOP.test(source)) {
    return null;
  }
  if (/windows|win32|win64/i.test(source)) {
    return "windows";
  }
  if (/mac/i.test(source)) {
    return (nav.maxTouchPoints ?? 0) > TOUCH_MAC_POINTS ? null : "macos";
  }
  if (/linux|x11/i.test(source)) {
    return "linux";
  }
  return null;
}

export function currentPlatform(): DesktopPlatform | null {
  if (typeof document === "undefined" || typeof navigator === "undefined") {
    return null;
  }
  return isDesktopShell(document.documentElement) ? null : detectPlatform(navigator);
}
