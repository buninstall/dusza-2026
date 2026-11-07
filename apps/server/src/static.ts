import { brotliCompressSync, constants } from "node:zlib";
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

const encodedCache = new Map<string, Uint8Array>();

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

async function encodedBody(target: string, encoding: Encoding): Promise<Uint8Array | null> {
  const key = `${encoding}:${target}`;
  const hit = encodedCache.get(key);
  if (hit) return hit;
  const raw = new Uint8Array(await Bun.file(target).arrayBuffer());
  if (raw.byteLength < MIN_COMPRESS_BYTES) return null;
  const body =
    encoding === "br"
      ? new Uint8Array(
          brotliCompressSync(raw, { params: { [constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY } }),
        )
      : Bun.gzipSync(raw, { level: GZIP_LEVEL });
  encodedCache.set(key, body);
  return body;
}

export function mimeTypeOf(path: string): string {
  return MIME_TYPES[extensionOf(path)] ?? "application/octet-stream";
}

export function createStaticHandler(files: Record<string, string>) {
  const indexFile = files["/index.html"];
  return createMiddleware<AppEnv>(async (c, next) => {
    const path = decodeURIComponent(new URL(c.req.url).pathname);
    if (path.startsWith("/api/") || path === "/api") {
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
    const headers: Record<string, string> = {
      "Content-Type": mimeTypeOf(servedPath),
      "Cache-Control": servedPath.startsWith("/assets/") ? IMMUTABLE : REVALIDATE,
      Vary: "Accept-Encoding",
    };
    const encoding = COMPRESSIBLE.has(extensionOf(servedPath))
      ? pickEncoding(c.req.header("accept-encoding"))
      : null;
    const body = encoding ? await encodedBody(target, encoding) : null;
    if (encoding && body) {
      return new Response(body, { headers: { ...headers, "Content-Encoding": encoding } });
    }
    return new Response(Bun.file(target), { headers });
  });
}

export async function warmCompression(files: Record<string, string>): Promise<void> {
  for (const [path, target] of Object.entries(files)) {
    if (!COMPRESSIBLE.has(extensionOf(path))) continue;
    try {
      await encodedBody(target, "br");
      await encodedBody(target, "gzip");
    } catch {
      encodedCache.delete(`br:${target}`);
    }
  }
}

export async function loadStaticHandler() {
  const { staticFiles } = await import("./static-manifest.gen.js");
  setTimeout(() => void warmCompression(staticFiles), 0);
  return createStaticHandler(staticFiles);
}
