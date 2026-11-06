import { createMiddleware } from "hono/factory";
import type { AppEnv, Deps } from "../env.ts";
import { apiError, messages } from "../lib/errors.ts";
import { findSessionUser, readSessionToken } from "./session.ts";

export function requireUser(deps: Deps) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const token = readSessionToken(c);
    const user = token ? await findSessionUser(deps, token) : null;
    if (!user) {
      return apiError(c, 401, "UNAUTHENTICATED", messages.unauthenticated);
    }
    c.set("user", user);
    await next();
    return undefined;
  });
}

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (c.var.user.role !== "admin") {
    return apiError(c, 403, "FORBIDDEN", messages.forbidden);
  }
  await next();
  return undefined;
});
