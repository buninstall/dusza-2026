import { Hono } from "hono";
import type { AppEnv, Deps } from "../env.ts";

export function healthRoutes(deps: Deps) {
  return new Hono<AppEnv>().get("/", (c) =>
    c.json({ ok: true, engineVersion: deps.engine.version() }),
  );
}
