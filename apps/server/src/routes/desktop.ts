import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv, Deps } from "../env.ts";
import { apiError, messages } from "../lib/errors.ts";
import { validationHook } from "../lib/validation.ts";
import { DESKTOP_FORMATS } from "../services/desktop.ts";

const formatParam = z.object({ format: z.enum(DESKTOP_FORMATS) });

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
