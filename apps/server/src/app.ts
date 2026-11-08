import { Hono, type MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { isOverLimit } from "./auth/rate-limit.ts";
import { isTransientDbError } from "./db/errors.ts";
import type { AppEnv, Deps } from "./env.ts";
import { apiError, messages } from "./lib/errors.ts";
import { clientAddress } from "./lib/request.ts";
import { adminRoutes } from "./routes/admin.ts";
import { authRoutes } from "./routes/auth.ts";
import { desktopRoutes } from "./routes/desktop.ts";
import { healthRoutes } from "./routes/health.ts";
import { mapRoutes } from "./routes/maps.ts";
import { meRoutes } from "./routes/me.ts";
import { programRoutes } from "./routes/programs.ts";
import { runRoutes } from "./routes/runs.ts";
import { storyRoutes } from "./routes/story.ts";
import { originCheck, securityHeaders } from "./security.ts";

export function buildApi(deps: Deps) {
  return new Hono<AppEnv>()
    .route("/health", healthRoutes(deps))
    .route("/auth", authRoutes(deps))
    .route("/maps", mapRoutes(deps))
    .route("/programs", programRoutes(deps))
    .route("/runs", runRoutes(deps))
    .route("/story", storyRoutes(deps))
    .route("/me", meRoutes(deps))
    .route("/admin", adminRoutes(deps))
    .route("/desktop", desktopRoutes(deps));
}

export type AppType = ReturnType<typeof buildApi>;

export const MAX_BODY_BYTES = 1024 * 1024;
export const RETRY_AFTER_SECONDS = "1";

const requestBodyLimit = bodyLimit({
  maxSize: MAX_BODY_BYTES,
  onError: (c) => {
    c.header("Connection", "close");
    return apiError(c, 413, "PAYLOAD_TOO_LARGE", messages.payloadTooLarge);
  },
});

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export type AppOptions = {
  staticHandler?: MiddlewareHandler<AppEnv>;
  logError?: (error: unknown) => void;
};

export function createApp(deps: Deps, options: AppOptions = {}) {
  const app = new Hono<AppEnv>();
  app.use("*", securityHeaders);
  app.use("/api/*", originCheck);
  app.use("/api/*", requestBodyLimit);
  app.use("/api/*", async (c, next) => {
    const isWrite = !SAFE_METHODS.has(c.req.method);
    if (isWrite && isOverLimit(deps.rates?.writes, clientAddress(c))) {
      return apiError(
        c,
        429,
        "RATE_LIMITED",
        "Túl sok kérés rövid idő alatt. Várj egy kicsit, és próbáld újra.",
      );
    }
    await next();
  });
  app.route("/api", buildApi(deps));
  if (options.staticHandler) {
    app.get("*", options.staticHandler);
  }
  app.notFound((c) => apiError(c, 404, "NOT_FOUND", messages.notFound));
  app.onError((error, c) => {
    if (error instanceof HTTPException && error.status === 400) {
      return apiError(c, 400, "VALIDATION", messages.malformedJson);
    }
    (options.logError ?? console.error)(error);
    if (isTransientDbError(error)) {
      c.header("Retry-After", RETRY_AFTER_SECONDS);
      return apiError(c, 503, "UNAVAILABLE", messages.unavailable);
    }
    return apiError(c, 500, "INTERNAL", messages.internal);
  });
  return app;
}
