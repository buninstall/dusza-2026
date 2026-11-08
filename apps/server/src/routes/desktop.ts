import { zValidator } from "@hono/zod-validator";
import { type Context, Hono } from "hono";
import { z } from "zod";
import type { AppEnv, Deps } from "../env.ts";
import { apiError, messages } from "../lib/errors.ts";
import { validationHook } from "../lib/validation.ts";
import { DESKTOP_FORMATS } from "../services/desktop.ts";

const formatParam = z.object({ format: z.enum(DESKTOP_FORMATS) });

function publicOrigin(c: Context<AppEnv>): string {
  const url = new URL(c.req.url);
  const proto = c.req.header("x-forwarded-proto") === "https" ? "https:" : url.protocol;
  return `${proto}//${c.req.header("host") ?? url.host}`;
}

export function desktopRoutes(deps: Deps) {
  return new Hono<AppEnv>()
    .get("/", async (c) => {
      const release = (await deps.desktop?.latest()) ?? null;
      if (!release) {
        return c.json({ release: null }, 200);
      }
      const assets = release.assets.map(({ format, platform, size }) => ({
        format,
        platform,
        size,
      }));
      return c.json(
        { release: { version: release.version, publishedAt: release.publishedAt, assets } },
        200,
      );
    })
    .get("/latest.json", async (c) => {
      c.header("Cache-Control", "no-store");
      const manifest = deps.desktop
        ? await deps.desktop.manifest(`${publicOrigin(c)}/api/desktop/download/file`)
        : null;
      return manifest ? c.json(manifest, 200) : c.body(null, 204);
    })
    .get("/download/file/:name", async (c) => {
      const result = deps.desktop
        ? await deps.desktop.file(c.req.param("name"))
        : { status: "missing" as const };
      if (result.status === "ok") {
        return result.response;
      }
      return result.status === "missing"
        ? apiError(c, 404, "NOT_FOUND", messages.notFound)
        : apiError(c, 503, "DESKTOP_UNAVAILABLE", messages.desktopUnavailable);
    })
    .get("/download/:format", zValidator("param", formatParam, validationHook), async (c) => {
      const { format } = c.req.valid("param");
      const release = (await deps.desktop?.latest()) ?? null;
      const asset = release?.assets.find((candidate) => candidate.format === format);
      if (!deps.desktop || !asset) {
        return apiError(c, 404, "NOT_FOUND", messages.notFound);
      }
      const url = await deps.desktop.resolve(asset);
      if (!url) {
        return apiError(c, 503, "DESKTOP_UNAVAILABLE", messages.desktopUnavailable);
      }
      c.header("Cache-Control", "no-store");
      return c.redirect(url, 302);
    });
}
