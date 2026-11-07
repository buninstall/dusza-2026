import { Hono } from "hono";
import { requireUser } from "../auth/middleware.ts";
import type { AppEnv, Deps } from "../env.ts";
import { storyLeaderboard } from "../services/story.ts";

export function storyRoutes(deps: Deps) {
  return new Hono<AppEnv>()
    .use(requireUser(deps))
    .get("/leaderboard", async (c) => c.json(await storyLeaderboard(deps.db), 200));
}
