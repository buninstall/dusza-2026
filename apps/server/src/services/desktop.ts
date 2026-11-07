import { z } from "zod";

export const DESKTOP_FORMATS = ["dmg", "exe", "msi", "appimage", "deb", "rpm"] as const;
export type DesktopFormat = (typeof DESKTOP_FORMATS)[number];
export type DesktopPlatform = "macos" | "windows" | "linux";

export type DesktopAsset = {
  format: DesktopFormat;
  platform: DesktopPlatform;
  name: string;
  size: number;
  id: number;
  url: string;
};

export type DesktopRelease = {
  version: string;
  tag: string;
  publishedAt: string;
  assets: DesktopAsset[];
};

export type DesktopReleases = {
  latest(): Promise<DesktopRelease | null>;
  resolve(asset: DesktopAsset): Promise<string | null>;
};

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export type DesktopOptions = {
  repo: string;
  token?: string | null | undefined;
  fetch?: Fetch;
  now?: () => number;
  log?: (message: string) => void;
};

export const DEFAULT_DESKTOP_REPO = "buninstall/dusza-2026";
export const FRESH_MS = 10 * 60_000;
export const RETRY_MS = 60_000;

const API = "https://api.github.com";
const TAG_PREFIX = "desktop-v";
const RELEASES_PER_PAGE = 30;
const TIMEOUT_MS = 5000;
const REPO_PATTERN = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;
const VERSION_PATTERN = /^desktop-v(\d+\.\d+\.\d+)/;
const TRUSTED_HOSTS = ["github.com", "githubusercontent.com"];
const REDIRECTS = new Set([301, 302, 303, 307, 308]);

const RULES: readonly { suffix: string; format: DesktopFormat; platform: DesktopPlatform }[] = [
  { suffix: ".dmg", format: "dmg", platform: "macos" },
  { suffix: "-setup.exe", format: "exe", platform: "windows" },
  { suffix: ".msi", format: "msi", platform: "windows" },
  { suffix: ".appimage", format: "appimage", platform: "linux" },
  { suffix: ".deb", format: "deb", platform: "linux" },
  { suffix: ".rpm", format: "rpm", platform: "linux" },
];

const assetSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  size: z.number().int().nonnegative(),
  state: z.string().optional(),
  browser_download_url: z.string(),
});

const releasesSchema = z.array(
  z.object({
    tag_name: z.string(),
    draft: z.boolean(),
    prerelease: z.boolean(),
    published_at: z.string().nullable(),
    assets: z.array(assetSchema),
  }),
);

export type GithubRelease = z.infer<typeof releasesSchema>[number];
type GithubAsset = z.infer<typeof assetSchema>;

export function isValidRepo(repo: string): boolean {
  return REPO_PATTERN.test(repo);
}

export function isTrustedDownload(raw: string): boolean {
  try {
    const url = new URL(raw);
    return (
      url.protocol === "https:" &&
      TRUSTED_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
    );
  } catch {
    return false;
  }
}

function toAsset(asset: GithubAsset): DesktopAsset | null {
  if (asset.state !== undefined && asset.state !== "uploaded") {
    return null;
  }
  const name = asset.name.toLowerCase();
  const rule = RULES.find((candidate) => name.endsWith(candidate.suffix));
  if (!rule) {
    return null;
  }
  return {
    format: rule.format,
    platform: rule.platform,
    name: asset.name,
    size: asset.size,
    id: asset.id,
    url: asset.browser_download_url,
  };
}

function toRelease(release: GithubRelease): DesktopRelease | null {
  if (release.draft || release.prerelease || release.published_at === null) {
    return null;
  }
  if (!release.tag_name.startsWith(TAG_PREFIX)) {
    return null;
  }
  const assets = RULES.flatMap((rule) => {
    const match = release.assets
      .map(toAsset)
      .find((asset): asset is DesktopAsset => asset?.format === rule.format);
    return match ? [match] : [];
  });
  if (assets.length === 0) {
    return null;
  }
  const version =
    VERSION_PATTERN.exec(release.tag_name)?.[1] ?? release.tag_name.slice(TAG_PREFIX.length);
  return { version, tag: release.tag_name, publishedAt: release.published_at, assets };
}

export function pickLatest(releases: readonly GithubRelease[]): DesktopRelease | null {
  const candidates = releases
    .map(toRelease)
    .filter((release): release is DesktopRelease => release !== null)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  return candidates[0] ?? null;
}

type CacheEntry = { value: DesktopRelease | null; until: number };

export function createDesktopReleases(options: DesktopOptions): DesktopReleases {
  const { repo, token } = options;
  const fetchImpl: Fetch = options.fetch ?? ((input, init) => fetch(input, init));
  const now = options.now ?? Date.now;
  const log = options.log ?? ((message: string) => console.warn(message));
  let cached: CacheEntry | null = null;
  let pending: Promise<DesktopRelease | null> | null = null;

  const headers = (accept: string): Record<string, string> => ({
    Accept: accept,
    "User-Agent": "MineScript-Server",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  const load = async (): Promise<DesktopRelease | null> => {
    const response = await fetchImpl(
      `${API}/repos/${repo}/releases?per_page=${RELEASES_PER_PAGE}`,
      { headers: headers("application/vnd.github+json"), signal: AbortSignal.timeout(TIMEOUT_MS) },
    );
    if (!response.ok) {
      throw new Error(`a GitHub ${response.status} választ adott`);
    }
    const parsed = releasesSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new Error("a GitHub válasza nem a várt formájú");
    }
    return pickLatest(parsed.data);
  };

  const refresh = async (): Promise<DesktopRelease | null> => {
    try {
      const value = await load();
      cached = { value, until: now() + (value ? FRESH_MS : RETRY_MS) };
      return value;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      log(`Az asztali alkalmazás kiadásai nem érhetők el: ${reason}`);
      const stale = cached?.value ?? null;
      cached = { value: stale, until: now() + RETRY_MS };
      return stale;
    } finally {
      pending = null;
    }
  };

  const resolveSigned = async (asset: DesktopAsset): Promise<string | null> => {
    const response = await fetchImpl(`${API}/repos/${repo}/releases/assets/${asset.id}`, {
      headers: headers("application/octet-stream"),
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const location = response.headers.get("location");
    if (!REDIRECTS.has(response.status) || !location) {
      throw new Error(`a letöltési hivatkozás helyett ${response.status} válasz jött`);
    }
    return location;
  };

  return {
    latest() {
      if (cached && now() < cached.until) {
        return Promise.resolve(cached.value);
      }
      pending ??= refresh();
      return pending;
    },
    async resolve(asset) {
      try {
        const url = token ? await resolveSigned(asset) : asset.url;
        return url !== null && isTrustedDownload(url) ? url : null;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        log(`Az asztali alkalmazás letöltése nem indítható: ${reason}`);
        return null;
      }
    },
  };
}
