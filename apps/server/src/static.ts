import { promisify } from "node:util";
import { brotliCompress, constants, gzip } from "node:zlib";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "./env.ts";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".wasm": "application/wasm",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

const IMMUTABLE = "public, max-age=31536000, immutable";
const REVALIDATE = "no-cache";
const COMPRESSIBLE = new Set([
  ".html",
  ".js",
  ".mjs",
  ".css",
  ".wasm",
  ".json",
  ".svg",
  ".txt",
  ".webmanifest",
]);
const MIN_COMPRESS_BYTES = 1024;
const BROTLI_QUALITY = 9;
const GZIP_LEVEL = 9;

type Encoding = "br" | "gzip";

const brotliAsync = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

const encodedCache = new Map<string, Promise<Uint8Array | null>>();
const tagCache = new Map<string, Promise<string>>();

function extensionOf(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot).toLowerCase();
}

export function pickEncoding(accept: string | undefined): Encoding | null {
  const offered = (accept ?? "")
    .split(",")
    .map((part) => part.trim().split(";")[0]?.trim().toLowerCase() ?? "");
  if (offered.includes("br")) return "br";
  if (offered.includes("gzip")) return "gzip";
  return null;
}

async function compress(raw: Uint8Array, encoding: Encoding): Promise<Uint8Array> {
  const compressed =
    encoding === "br"
      ? await brotliAsync(raw, { params: { [constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY } })
      : await gzipAsync(raw, { level: GZIP_LEVEL });
  return new Uint8Array(compressed);
}

async function encode(target: string, encoding: Encoding): Promise<Uint8Array | null> {
  const raw = new Uint8Array(await Bun.file(target).arrayBuffer());
  if (raw.byteLength < MIN_COMPRESS_BYTES) return null;
  return compress(raw, encoding);
}

function encodedBody(target: string, encoding: Encoding): Promise<Uint8Array | null> {
  const key = `${encoding}:${target}`;
  const hit = encodedCache.get(key);
  if (hit) return hit;
  const pending = encode(target, encoding);
  encodedCache.set(key, pending);
  pending.catch(() => encodedCache.delete(key));
  return pending;
}

async function hashOf(target: string): Promise<string> {
  const raw = new Uint8Array(await Bun.file(target).arrayBuffer());
  return Bun.hash(raw).toString(36);
}

function contentTag(target: string): Promise<string> {
  const hit = tagCache.get(target);
  if (hit) return hit;
  const pending = hashOf(target);
  tagCache.set(target, pending);
  pending.catch(() => tagCache.delete(target));
  return pending;
}

function matchesTag(header: string | undefined, tag: string): boolean {
  if (!header) return false;
  return header
    .split(",")
    .map((part) => part.trim())
    .some((part) => part === tag || part === `W/${tag}` || part === "*");
}

function decodedPath(url: string): string | null {
  try {
    return decodeURIComponent(new URL(url).pathname);
  } catch {
    return null;
  }
}

export function mimeTypeOf(path: string): string {
  return MIME_TYPES[extensionOf(path)] ?? "application/octet-stream";
}

export function createStaticHandler(files: Record<string, string>) {
  const indexFile = files["/index.html"];
  return createMiddleware<AppEnv>(async (c, next) => {
    const path = decodedPath(c.req.url);
    if (path === null || path.startsWith("/api/") || path === "/api") {
      await next();
      return undefined;
    }
    const exact = files[path];
    const target = exact ?? indexFile;
    if (!target) {
      await next();
      return undefined;
    }
    const servedPath = exact ? path : "/index.html";
    const isImmutable = servedPath.startsWith("/assets/");
    const headers: Record<string, string> = {
      "Content-Type": mimeTypeOf(servedPath),
      "Cache-Control": isImmutable ? IMMUTABLE : REVALIDATE,
      Vary: "Accept-Encoding",
    };
    const encoding = COMPRESSIBLE.has(extensionOf(servedPath))
      ? pickEncoding(c.req.header("accept-encoding"))
      : null;
    const body = encoding ? await encodedBody(target, encoding) : null;
    const sentEncoding = encoding && body ? encoding : null;
    if (!isImmutable) {
      const tag = `"${await contentTag(target)}${sentEncoding ? `-${sentEncoding}` : ""}"`;
      headers.ETag = tag;
      if (matchesTag(c.req.header("if-none-match"), tag)) {
        return new Response(null, {
          status: 304,
          headers: sentEncoding ? { ...headers, "Content-Encoding": sentEncoding } : headers,
        });
      }
    }
    if (sentEncoding && body) {
      return new Response(body, { headers: { ...headers, "Content-Encoding": sentEncoding } });
    }
    return new Response(Bun.file(target), { headers });
  });
}

export async function warmCompression(files: Record<string, string>): Promise<void> {
  for (const [path, target] of Object.entries(files)) {
    if (!COMPRESSIBLE.has(extensionOf(path))) continue;
    await Promise.all([
      encodedBody(target, "br").catch(() => null),
      encodedBody(target, "gzip").catch(() => null),
    ]);
  }
}

export async function loadStaticHandler() {
  const { staticFiles } = await import("./static-manifest.gen.js");
  setTimeout(() => void warmCompression(staticFiles), 0);
  return createStaticHandler(staticFiles);
}
