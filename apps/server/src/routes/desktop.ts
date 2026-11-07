import { type Context, Hono } from "hono";
import type { AppEnv, Deps } from "../env.ts";
import { apiError, messages } from "../lib/errors.ts";
import { DesktopUnavailableError, isDesktopPlatform } from "../services/desktop.ts";

function publicOrigin(c: Context<AppEnv>): string {
  const url = new URL(c.req.url);
  const proto = c.req.header("x-forwarded-proto") === "https" ? "https:" : url.protocol;
  const host = c.req.header("host") ?? url.host;
  return `${proto}//${host}`;
}

function unavailable(c: Context<AppEnv>) {
  c.header("Retry-After", "60");
  return apiError(c, 503, "DESKTOP_UNAVAILABLE", messages.desktopUnavailable);
}

export function desktopRoutes(deps: Deps) {
  return new Hono<AppEnv>()
    .use("*", async (c, next) => {
      if (!deps.desktop) {
        return apiError(c, 404, "DESKTOP_NOT_CONFIGURED", messages.desktopNotConfigured);
      }
      c.header("Cache-Control", "no-store");
      await next();
      return undefined;
    })
    .onError((error, c) => {
      if (error instanceof DesktopUnavailableError) {
        console.error(`MineScript Desktop letöltés: ${error.message}`);
        return unavailable(c);
      }
      console.error(error);
      return apiError(c, 500, "INTERNAL", messages.internal);
    })
    .get("/latest.json", async (c) => {
      const manifest = await deps.desktop?.manifest(`${publicOrigin(c)}/api/desktop/download/file`);
      return manifest ? c.json(manifest, 200) : c.body(null, 204);
    })
    .get("/info", async (c) => {
      const info = await deps.desktop?.info();
      return info ? c.json(info, 200) : apiError(c, 404, "NOT_FOUND", messages.desktopNoRelease);
    })
    .get("/download/file/:name", async (c) => {
      const file = await deps.desktop?.assetStream(c.req.param("name"));
      return file ?? apiError(c, 404, "NOT_FOUND", messages.notFound);
    })
    .get("/download/:platform", async (c) => {
      const platform = c.req.param("platform");
      if (!isDesktopPlatform(platform)) {
        return apiError(c, 404, "NOT_FOUND", messages.notFound);
      }
      const location = await deps.desktop?.platformLocation(platform);
      return location
        ? c.redirect(location, 302)
        : apiError(c, 404, "NOT_FOUND", messages.desktopNoRelease);
    });
}
