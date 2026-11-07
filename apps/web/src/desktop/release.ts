import { queryOptions, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "../components/ui/Toast.tsx";
import { hu } from "../i18n/hu.ts";
import { api, call } from "../lib/api.ts";
import { currentPlatform, type DesktopPlatform } from "./platform.ts";

const STALE_MS = 10 * 60_000;
const BYTES_PER_MB = 1_000_000;

async function fetchDesktopRelease() {
  const { release } = await call(api.desktop.$get());
  return release;
}

export type DesktopRelease = NonNullable<Awaited<ReturnType<typeof fetchDesktopRelease>>>;
export type DesktopAsset = DesktopRelease["assets"][number];
export type DesktopFormat = DesktopAsset["format"];

export type DesktopOffer = {
  platform: DesktopPlatform;
  version: string;
  primary: DesktopAsset;
  others: DesktopAsset[];
};

const PRIMARY: Record<DesktopPlatform, DesktopFormat> = {
  macos: "dmg",
  windows: "exe",
  linux: "appimage",
};

export const desktopReleaseQuery = queryOptions({
  queryKey: ["desktop-release"],
  queryFn: fetchDesktopRelease,
  staleTime: STALE_MS,
  retry: false,
});

export function pickOffer(release: DesktopRelease, platform: DesktopPlatform): DesktopOffer | null {
  const primary =
    release.assets.find((asset) => asset.format === PRIMARY[platform]) ??
    release.assets.find((asset) => asset.platform === platform);
  if (!primary) {
    return null;
  }
  const others = release.assets.filter((asset) => asset !== primary);
  return { platform, version: release.version, primary, others };
}

export function downloadHref(format: DesktopFormat): string {
  return `/api/desktop/download/${format}`;
}

export function formatSize(bytes: number): string {
  const value = new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 1 }).format(
    bytes / BYTES_PER_MB,
  );
  return hu.desktop.megabytes(value);
}

export function announceDownload(format: DesktopFormat): void {
  const hint = hu.desktop.firstRun[format];
  toast.info(hint ? `${hu.desktop.started} ${hint}` : hu.desktop.started);
}

export function useDesktopOffer(): { platform: DesktopPlatform | null; offer: DesktopOffer | null } {
  const [platform] = useState(currentPlatform);
  const { data } = useQuery({ ...desktopReleaseQuery, enabled: platform !== null });
  return { platform, offer: platform && data ? pickOffer(data, platform) : null };
}
