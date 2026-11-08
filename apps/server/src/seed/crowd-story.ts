import { and, eq, inArray, isNull } from "drizzle-orm";
import { maps, mapVersions } from "../db/schema.ts";
import type { Deps } from "../env.ts";
import { seededRandom, seedFromText } from "../services/generator.ts";
import { executeAndRecord } from "../services/runs.ts";
import { campaignOwner } from "./campaign.ts";
import { TUTORIAL_MAPS } from "./maps.ts";
import { RECIPES } from "./recipes.ts";

const PROGRESS_CURVE = 2.6;
const FULL_SOLUTION_SHARE = 0.45;
const STORY_OFFSET_MS = 20_000;
const LEVEL_SPACING_MS = 40;

type StoryLevel = { index: number; version: typeof mapVersions.$inferSelect; recipe: string };

function bestRecipe(mapIndex: number): string | null {
  const recipe = RECIPES.find(
    (candidate) =>
      candidate.world === undefined &&
      candidate.mapIndex === mapIndex &&
      candidate.expected.kind === "ok",
  );
  return recipe ? recipe.source : null;
}

export function partialRoute(route: string, random: () => number): string {
  const lines = route.split("\n").filter((line) => line.length > 0);
  const keep = Math.max(1, Math.ceil(lines.length * (0.4 + random() * 0.6)));
  return lines.slice(0, keep).join("\n");
}

async function storyLevels(deps: Deps): Promise<StoryLevel[]> {
  const owner = await campaignOwner(deps);
  if (!owner) {
    return [];
  }
  const rows = await deps.db
    .select({ title: maps.title, version: mapVersions })
    .from(maps)
    .innerJoin(mapVersions, eq(mapVersions.id, maps.currentVersionId))
    .where(
      and(
        eq(maps.ownerId, owner.ownerId),
        isNull(maps.dailyDate),
        inArray(
          maps.title,
          TUTORIAL_MAPS.map((tutorial) => tutorial.title),
        ),
      ),
    );
  const byTitle = new Map(rows.map((row) => [row.title, row.version]));
  return TUTORIAL_MAPS.flatMap((tutorial, index) => {
    const version = byTitle.get(tutorial.title);
    const recipe = bestRecipe(index);
    return version && recipe ? [{ index, version, recipe }] : [];
  });
}

export async function recordStoryRuns(
  deps: Deps,
  playerIds: ReadonlyMap<string, number>,
  base: number,
): Promise<number> {
  const levels = await storyLevels(deps);
  if (levels.length === 0) {
    return 0;
  }
  let recorded = 0;
  for (const [order, [username, userId]] of [...playerIds.entries()].entries()) {
    const random = seededRandom(seedFromText(`story#${username}`));
    const depth = Math.round(levels.length * random() ** PROGRESS_CURVE);
    for (const level of levels.slice(0, depth)) {
      const source =
        random() < FULL_SOLUTION_SHARE ? level.recipe : partialRoute(level.recipe, random);
      const result = await executeAndRecord(deps.db, deps.engine, {
        userId,
        version: level.version,
        source,
        now: base + STORY_OFFSET_MS + order * levels.length * LEVEL_SPACING_MS + level.index,
      });
      if (result.kind === "recorded") {
        recorded += 1;
      }
    }
  }
  return recorded;
}
