export type DesktopPlatform =
  | "mac"
  | "windows"
  | "windows-msi"
  | "linux"
  | "linux-deb"
  | "linux-rpm";

export const DESKTOP_PLATFORM_ORDER: readonly DesktopPlatform[] = [
  "mac",
  "windows",
  "windows-msi",
  "linux",
  "linux-deb",
  "linux-rpm",
];

type NavigatorLike = { userAgent?: string; userAgentData?: { platform?: string } };

export function detectFamily(nav: NavigatorLike | undefined): "mac" | "windows" | "linux" | null {
  const hint = `${nav?.userAgentData?.platform ?? ""} ${nav?.userAgent ?? ""}`.toLowerCase();
  if (/iphone|ipad|android/.test(hint)) return null;
  if (/mac/.test(hint)) return "mac";
  if (/win/.test(hint)) return "windows";
  if (/linux|x11|cros/.test(hint)) return "linux";
  return null;
}

export function orderForFamily(
  available: readonly DesktopPlatform[],
  family: ReturnType<typeof detectFamily>,
): DesktopPlatform[] {
  const own = family ? available.filter((platform) => platform.startsWith(family)) : [];
  return [...own, ...available.filter((platform) => !own.includes(platform))];
}

export function isDesktopShell(root: { dataset: DOMStringMap } | undefined): boolean {
  return root?.dataset.shell === "desktop";
}

export function downloadHref(platform: DesktopPlatform): string {
  return `/api/desktop/download/${platform}`;
}
