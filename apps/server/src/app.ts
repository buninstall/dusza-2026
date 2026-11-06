import { Hono, type MiddlewareHandler } from "hono";
import type { AppEnv, Deps } from "./env.ts";
import { apiError, messages } from "./lib/errors.ts";
import { adminRoutes } from "./routes/admin.ts";
import { authRoutes } from "./routes/auth.ts";
import { healthRoutes } from "./routes/health.ts";
import { mapRoutes } from "./routes/maps.ts";
import { meRoutes } from "./routes/me.ts";
import { programRoutes } from "./routes/programs.ts";
import { runRoutes } from "./routes/runs.ts";
import { originCheck, securityHeaders } from "./security.ts";

export function buildApi(deps: Deps) {
  return new Hono<AppEnv>()
    .route("/health", healthRoutes(deps))
    .route("/auth", authRoutes(deps))
    .route("/maps", mapRoutes(deps))
    .route("/programs", programRoutes(deps))
    .route("/runs", runRoutes(deps))
    .route("/me", meRoutes(deps))
    .route("/admin", adminRoutes(deps));
}

export type AppType = ReturnType<typeof buildApi>;

export type AppOptions = {
  staticHandler?: MiddlewareHandler<AppEnv>;
  logError?: (error: unknown) => void;
};

export function createApp(deps: Deps, options: AppOptions = {}) {
  const app = new Hono<AppEnv>();
  app.use("*", securityHeaders);
  app.use("/api/*", originCheck);
  app.route("/api", buildApi(deps));
  if (options.staticHandler) {
    app.get("*", options.staticHandler);
  }
  app.notFound((c) => apiError(c, 404, "NOT_FOUND", messages.notFound));
  app.onError((error, c) => {
    (options.logError ?? console.error)(error);
    return apiError(c, 500, "INTERNAL", messages.internal);
  });
  return app;
}
