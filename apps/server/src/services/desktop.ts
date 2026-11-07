export const DESKTOP_TAG_PREFIX = "desktop-v";
export const DESKTOP_MANIFEST = "latest.json";
export const DESKTOP_CACHE_MS = 5 * 60 * 1000;
export const DEFAULT_DESKTOP_REPO = "buninstall/dusza-2026";

export const DESKTOP_PLATFORMS = {
  mac: /\.dmg$/,
  windows: /-setup\.exe$/,
  "windows-msi": /\.msi$/,
  linux: /\.AppImage$/,
  "linux-deb": /\.deb$/,
  "linux-rpm": /\.rpm$/,
} as const satisfies Record<string, RegExp>;

export type DesktopPlatform = keyof typeof DESKTOP_PLATFORMS;

export type DesktopManifest = {
  version: string;
  notes?: string;
  pub_date?: string;
  platforms: Record<string, { url: string; signature: string }>;
};

export type DesktopInfo = {
  version: string;
  publishedAt: string | null;
  files: Record<DesktopPlatform, string | null>;
};

type Asset = { id: number; name: string };
type Release = {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  assets: Asset[];
};
type Snapshot = { release: Release; manifest: DesktopManifest };

export type DesktopReleaseOptions = {
  repo: string;
  token: string;
  fetch?: (input: string, init?: RequestInit) => Promise<Response>;
  now?: () => number;
};

export class DesktopUnavailableError extends Error {}

export type DesktopReleases = {
  manifest(downloadBase: string): Promise<DesktopManifest | null>;
  info(): Promise<DesktopInfo | null>;
  assetLocation(name: string): Promise<string | null>;
  assetStream(name: string): Promise<Response | null>;
  platformLocation(platform: DesktopPlatform): Promise<string | null>;
};

export function isDesktopPlatform(value: string): value is DesktopPlatform {
  return Object.hasOwn(DESKTOP_PLATFORMS, value);
}

function isManifest(value: unknown): value is DesktopManifest {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<DesktopManifest>;
  return (
    typeof candidate.version === "string" &&
    typeof candidate.platforms === "object" &&
    candidate.platforms !== null &&
    Object.values(candidate.platforms).every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        typeof entry.url === "string" &&
        typeof entry.signature === "string",
    )
  );
}

export function createDesktopReleases(options: DesktopReleaseOptions): DesktopReleases {
  const http = options.fetch ?? ((input: string, init?: RequestInit) => fetch(input, init));
  const now = options.now ?? Date.now;
  let snapshot: Snapshot | null | undefined;
  let fetchedAt = 0;
  let pending: Promise<Snapshot | null> | undefined;

  const github = (path: string, binary = false) =>
    http(`https://api.github.com/repos/${options.repo}${path}`, {
      headers: {
        Accept: binary ? "application/octet-stream" : "application/vnd.github+json",
        Authorization: `Bearer ${options.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "minescript-server",
      },
      redirect: binary ? "manual" : "follow",
    });

  const signedLocation = async (asset: Asset): Promise<string> => {
    const response = await github(`/releases/assets/${asset.id}`, true);
    const location = response.headers.get("location");
    if (response.status < 300 || response.status >= 400 || !location) {
      throw new DesktopUnavailableError(`GitHub asset ${asset.name}: ${response.status}`);
    }
    return location;
  };

  const unavailable = <T>(task: () => Promise<T>) =>
    task().catch((error: unknown) => {
      if (error instanceof DesktopUnavailableError) throw error;
      throw new DesktopUnavailableError(error instanceof Error ? error.message : String(error));
    });

  const load = async (): Promise<Snapshot | null> => {
    const response = await github("/releases?per_page=30");
    if (!response.ok) {
      throw new DesktopUnavailableError(`GitHub releases: ${response.status}`);
    }
    const releases = (await response.json()) as Release[];
    const release = releases.find(
      (candidate) =>
        !candidate.draft &&
        !candidate.prerelease &&
        candidate.tag_name.startsWith(DESKTOP_TAG_PREFIX) &&
        candidate.assets.some((asset) => asset.name === DESKTOP_MANIFEST),
    );
    const asset = release?.assets.find((candidate) => candidate.name === DESKTOP_MANIFEST);
    if (!release || !asset) return null;
    const body = await http(await signedLocation(asset), { redirect: "follow" });
    if (!body.ok) {
      throw new DesktopUnavailableError(`latest.json: ${body.status}`);
    }
    const manifest: unknown = await body.json();
    if (!isManifest(manifest)) {
      throw new DesktopUnavailableError("latest.json: invalid shape");
    }
    return { release, manifest };
  };

  const latest = async (): Promise<Snapshot | null> => {
    if (snapshot !== undefined && now() - fetchedAt < DESKTOP_CACHE_MS) return snapshot;
    pending ??= unavailable(load)
      .then((result) => {
        snapshot = result;
        fetchedAt = now();
        return result;
      })
      .finally(() => {
        pending = undefined;
      });
    return pending;
  };

  const locate = async (match: (asset: Asset) => boolean) => {
    const current = await latest();
    const asset = current?.release.assets.find(match);
    return asset ? unavailable(() => signedLocation(asset)) : null;
  };

  return {
    async manifest(downloadBase) {
      const current = await latest();
      if (!current) return null;
      const base = downloadBase.replace(/\/+$/, "");
      const platforms = Object.fromEntries(
        Object.entries(current.manifest.platforms).map(([key, entry]) => [
          key,
          { ...entry, url: `${base}/${encodeURIComponent(entry.url)}` },
        ]),
      );
      return { ...current.manifest, platforms };
    },
    async info() {
      const current = await latest();
      if (!current) return null;
      const files = Object.fromEntries(
        Object.entries(DESKTOP_PLATFORMS).map(([platform, pattern]) => [
          platform,
          current.release.assets.find((asset) => pattern.test(asset.name))?.name ?? null,
        ]),
      ) as Record<DesktopPlatform, string | null>;
      return {
        version: current.manifest.version,
        publishedAt: current.release.published_at,
        files,
      };
    },
    assetLocation(name) {
      return locate((asset) => asset.name === name && asset.name !== DESKTOP_MANIFEST);
    },
    async assetStream(name) {
      const location = await locate(
        (asset) => asset.name === name && asset.name !== DESKTOP_MANIFEST,
      );
      if (!location) return null;
      return unavailable(async () => {
        const upstream = await http(location, { redirect: "follow" });
        if (!upstream.ok || !upstream.body) {
          throw new DesktopUnavailableError(`${name}: ${upstream.status}`);
        }
        const headers = new Headers({
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${name.replace(/[^A-Za-z0-9._-]/g, "_")}"`,
        });
        const length = upstream.headers.get("content-length");
        if (length) headers.set("Content-Length", length);
        return new Response(upstream.body, { status: 200, headers });
      });
    },
    platformLocation(platform) {
      const pattern = DESKTOP_PLATFORMS[platform];
      return locate((asset) => pattern.test(asset.name));
    },
  };
}

export function desktopReleasesFromEnv(
  env: Readonly<Record<string, string | undefined>>,
): DesktopReleases | undefined {
  const token = env.DESKTOP_RELEASES_TOKEN?.trim();
  if (!token) return undefined;
  const repo = env.DESKTOP_RELEASES_REPO?.trim() || DEFAULT_DESKTOP_REPO;
  return createDesktopReleases({ repo, token });
}
