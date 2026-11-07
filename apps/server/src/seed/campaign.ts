import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { maps, programs, users } from "../db/schema.ts";
import type { Deps } from "../env.ts";
import { createMapWithVersion, validateMapContent } from "../services/maps.ts";
import { TUTORIAL_MAPS } from "./maps.ts";
import { RECIPES } from "./recipes.ts";
import { SANDBOX_MAPS } from "./sandbox.ts";

const LEGACY_DESCRIPTIONS: Readonly<Record<string, string>> = {
  "1. Egyenes folyosó": "Egyetlen sor, két aranyrög. Elég a step forward és a mine here.",
  "2. Az első kanyar": "A folyosó a végén délnek fordul: itt kell először a turn by.",
  "3. Kis labirintus": "Három arany kanyargós járatokban. Érdemes az isThere-rel tapogatózni.",
  "4. Zsákutcák": "Öt arany, több zsákutcával. A rövid út a kevesebb lépés.",
  "5. Kígyó": "Hosszú, oda-vissza kanyargó folyosó: jó terep a while ciklushoz.",
  "6. Elérhetetlen kincs":
    "Az egyik arany falakkal körülzárt kamrában van. A robot észak felé néz.",
  "7. Aranymező": "Nyílt terep tizenkét arannyal. Ki gyűjti össze a legkevesebb lépésből?",
  "8. A nagy bánya": "A legnagyobb, 15×15-ös bánya, sok elágazással és szétszórt arannyal.",
};

export type CampaignReport = {
  created: number;
  retold: number;
  recipes: number;
  sandbox: number;
};

const SANDBOX_OFFSET = 1000;

export async function ensureSandbox(deps: Deps, base: number): Promise<number> {
  const owners = await deps.db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(inArray(users.username, [...new Set(SANDBOX_MAPS.map((map) => map.owner))]));
  const idOf = new Map(owners.map((owner) => [owner.username, owner.id]));
  let created = 0;
  for (const [index, sandbox] of SANDBOX_MAPS.entries()) {
    const ownerId = idOf.get(sandbox.owner);
    if (ownerId === undefined) {
      continue;
    }
    const [existing] = await deps.db
      .select({ id: maps.id })
      .from(maps)
      .where(and(eq(maps.ownerId, ownerId), eq(maps.title, sandbox.title)))
      .limit(1);
    if (existing) {
      continue;
    }
    const valid = validateMapContent(deps.engine, sandbox.content);
    if (!valid.ok) {
      throw new Error(`Hibás homokozó-térkép a seedben: ${sandbox.title}`);
    }
    await createMapWithVersion(deps.db, {
      ownerId,
      title: sandbox.title,
      description: sandbox.description,
      visibility: "public",
      parSteps: sandbox.parSteps,
      lampMode: "open",
      valid,
      now: base + SANDBOX_OFFSET + index,
    });
    created += 1;
  }
  return created;
}

type SeedMap = { id: number; title: string; description: string; createdAt: number };

async function campaignOwner(deps: Deps): Promise<{ ownerId: number; base: number } | null> {
  const first = TUTORIAL_MAPS[0];
  const [anchor] = first
    ? await deps.db
        .select({ ownerId: maps.ownerId, createdAt: maps.createdAt })
        .from(maps)
        .where(and(eq(maps.title, first.title), isNull(maps.dailyDate)))
        .orderBy(asc(maps.id))
        .limit(1)
    : [];
  if (anchor) {
    return { ownerId: anchor.ownerId, base: anchor.createdAt };
  }
  const [admin] = await deps.db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"))
    .orderBy(asc(users.id))
    .limit(1);
  return admin ? { ownerId: admin.id, base: deps.now() } : null;
}

async function ensureMaps(deps: Deps, ownerId: number, base: number) {
  const owned: SeedMap[] = await deps.db
    .select({
      id: maps.id,
      title: maps.title,
      description: maps.description,
      createdAt: maps.createdAt,
    })
    .from(maps)
    .where(and(eq(maps.ownerId, ownerId), isNull(maps.dailyDate)));
  const byTitle = new Map(owned.map((map) => [map.title, map]));
  let created = 0;
  let retold = 0;
  for (const [index, tutorial] of TUTORIAL_MAPS.entries()) {
    const existing = byTitle.get(tutorial.title);
    if (existing) {
      if (
        existing.description !== tutorial.description &&
        existing.description === LEGACY_DESCRIPTIONS[tutorial.title]
      ) {
        await deps.db
          .update(maps)
          .set({ description: tutorial.description })
          .where(eq(maps.id, existing.id));
        retold += 1;
      }
      continue;
    }
    const valid = validateMapContent(deps.engine, tutorial.content);
    if (!valid.ok) {
      throw new Error(`Hibás kampánytérkép a seedben: ${tutorial.title}`);
    }
    const recipe = RECIPES.find(
      (candidate) =>
        candidate.world === undefined &&
        candidate.mapIndex === index &&
        candidate.expected.kind === "ok",
    );
    await createMapWithVersion(deps.db, {
      ownerId,
      title: tutorial.title,
      description: tutorial.description,
      visibility: "public",
      parSteps: recipe && recipe.expected.kind === "ok" ? recipe.expected.steps : null,
      lampMode: tutorial.lampMode,
      valid,
      now: base + index,
    });
    created += 1;
  }
  return { created, retold };
}

async function ensureRecipePrograms(deps: Deps, usernames: readonly string[]): Promise<number> {
  const accounts = await deps.db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.username, [...usernames]));
  let added = 0;
  for (const account of accounts) {
    const owned = await deps.db
      .select({ title: programs.title })
      .from(programs)
      .where(eq(programs.ownerId, account.id));
    const titles = new Set(owned.map((program) => program.title));
    const missing = RECIPES.filter((recipe) => !titles.has(recipe.title));
    if (missing.length === 0) {
      continue;
    }
    const now = deps.now();
    await deps.db.insert(programs).values(
      missing.map((recipe, index) => ({
        ownerId: account.id,
        title: recipe.title,
        source: recipe.source,
        updatedAt: now - index - 1,
      })),
    );
    added += missing.length;
  }
  return added;
}

export async function ensureCampaign(
  deps: Deps,
  usernames: readonly string[],
): Promise<CampaignReport> {
  const owner = await campaignOwner(deps);
  if (!owner) {
    return { created: 0, retold: 0, recipes: 0, sandbox: 0 };
  }
  const { created, retold } = await ensureMaps(deps, owner.ownerId, owner.base);
  const sandbox = await ensureSandbox(deps, owner.base);
  const recipes = await ensureRecipePrograms(deps, usernames);
  return { created, retold, recipes, sandbox };
}
