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

export function mimeTypeOf(path: string): string {
  const dot = path.lastIndexOf(".");
  const extension = dot === -1 ? "" : path.slice(dot).toLowerCase();
  return MIME_TYPES[extension] ?? "application/octet-stream";
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
    return new Response(Bun.file(target), {
      headers: {
        "Content-Type": mimeTypeOf(servedPath),
        "Cache-Control": servedPath.startsWith("/assets/") ? IMMUTABLE : REVALIDATE,
      },
    });
  });
}

export async function loadStaticHandler() {
  const { staticFiles } = await import("./static-manifest.gen.js");
  return createStaticHandler(staticFiles);
}
