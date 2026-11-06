import { asc, eq } from "drizzle-orm";
import { isDuplicateEntry } from "../db/errors.ts";
import { type MapRow, maps, users } from "../db/schema.ts";
import type { Deps, SessionUser } from "../env.ts";
import {
  DIFFICULTIES,
  type Difficulty,
  generateMap,
  seededRandom,
  seedFromText,
} from "./generator.ts";
import { createMapWithVersion, validateMapContent } from "./maps.ts";

const TIME_ZONE = "Europe/Budapest";
const DAILY_SIZES = [9, 11, 13] as const;
const MS_PER_DAY = 86_400_000;

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "könnyű",
  medium: "közepes",
  hard: "nehéz",
};

export function dayKey(now: number): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function dayTitle(key: string): string {
  const date = new Date(`${key}T12:00:00Z`);
  const label = new Intl.DateTimeFormat("hu-HU", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
  return `Napi kihívás · ${label}`;
}

export function dailyPlan(key: string) {
  const seed = seedFromText(`minescript-daily-${key}`);
  const random = seededRandom(seed);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;
  const dayIndex = Math.floor(Date.parse(`${key}T00:00:00Z`) / MS_PER_DAY);
  const difficulty = DIFFICULTIES[dayIndex % DIFFICULTIES.length] ?? "medium";
  return { seed, rows: pick(DAILY_SIZES), cols: pick(DAILY_SIZES), difficulty };
}

async function dailyOwner(deps: Deps, fallback: SessionUser): Promise<number> {
  const [admin] = await deps.db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"))
    .orderBy(asc(users.id))
    .limit(1);
  return admin?.id ?? fallback.id;
}

async function findDaily(deps: Deps, key: string): Promise<MapRow | undefined> {
  const [found] = await deps.db.select().from(maps).where(eq(maps.dailyDate, key)).limit(1);
  return found;
}

export async function ensureDailyMap(deps: Deps, user: SessionUser): Promise<MapRow> {
  const key = dayKey(deps.now());
  const existing = await findDaily(deps, key);
  if (existing) {
    return existing;
  }
  const plan = dailyPlan(key);
  const generated = generateMap(deps.engine, plan);
  const valid = validateMapContent(deps.engine, generated.content);
  if (!valid.ok) {
    throw new Error(`A napi térkép generálása hibás térképet adott (${key}).`);
  }
  try {
    return await createMapWithVersion(deps.db, {
      ownerId: await dailyOwner(deps, user),
      title: dayTitle(key),
      description: `Ma generált, ${DIFFICULTY_LABEL[plan.difficulty]} pálya. Mindenki ugyanezt kapja, holnap új jön.`,
      visibility: "public",
      valid,
      now: deps.now(),
      parSteps: generated.parSteps,
      dailyDate: key,
    });
  } catch (error) {
    const raced = isDuplicateEntry(error) ? await findDaily(deps, key) : undefined;
    if (raced) {
      return raced;
    }
    throw error;
  }
}
