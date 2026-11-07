import { randomBytes } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { hashPassword } from "../auth/password.ts";
import { firstRow } from "../db/rows.ts";
import { mapFavorites, maps, mapVersions, users, type Visibility } from "../db/schema.ts";
import type { Deps } from "../env.ts";
import {
  DIFFICULTIES,
  type Difficulty,
  GENERATOR_MAX,
  GENERATOR_MIN,
  generateMap,
  seededRandom,
  seedFromText,
} from "../services/generator.ts";
import { createMapWithVersion, validateMapContent } from "../services/maps.ts";
import { solveRoute } from "../services/route-solver.ts";
import { executeAndRecord } from "../services/runs.ts";

const CRAFTS = [
  "vajar",
  "csilles",
  "lampas",
  "fejto",
  "aknasz",
  "ercasz",
  "robotos",
  "rogvadasz",
  "taronas",
  "furo",
] as const;

const NAMES = [
  "anna",
  "bence",
  "csenge",
  "dani",
  "eszter",
  "feri",
  "gergo",
  "hanna",
  "imre",
  "jazmin",
] as const;

const ADJECTIVES = [
  "Kanyargós",
  "Csendes",
  "Omladozó",
  "Rejtett",
  "Elfeledett",
  "Zúgó",
  "Sötét",
  "Ragyogó",
  "Csepegő",
  "Szűk",
  "Mély",
  "Régi",
  "Kristályos",
  "Vörös",
  "Hideg",
  "Párás",
  "Néma",
  "Kacskaringós",
  "Poros",
  "Aranyló",
] as const;

const NOUNS = [
  "tárna",
  "akna",
  "ércér",
  "folyosó",
  "kamra",
  "vágat",
  "lejtakna",
  "bánya",
  "barlang",
  "fejtés",
  "táró",
  "sikló",
  "kút",
  "útvesztő",
  "csilleút",
] as const;

const MOODS: Record<Difficulty, readonly string[]> = {
  easy: [
    "Barátságos járatok, kevés zsákutca: jó bemelegítés.",
    "Rövid út, közeli rögök. Az első ciklusnak is elég.",
  ],
  medium: [
    "Néhány elágazás és egy-két zsákutca. Érdemes az isThere-rel tapogatózni.",
    "Közepes bánya: a rövid út megtalálása már fejtörő.",
  ],
  hard: [
    "Hosszú zsákutcák végén eldugott rögök. Csak türelmeseknek.",
    "Szűk, kanyargós vágatok: a lépésszám itt dől el.",
  ],
};

export const CROWD_MAPS_PER_PLAYER = 3;
const PRIVATE_EVERY = 11;
const MAX_RIVALS = 3;
const MAX_FAVORITES = 6;
const CROWD_OFFSET_MS = 5000;
const PASSWORD_BYTES = 24;

export type CrowdReport = { players: number; maps: number; favorites: number; runs: number };

export type CrowdPlayer = { username: string; index: number };

export function crowdPlayers(): CrowdPlayer[] {
  return CRAFTS.flatMap((craft, row) =>
    NAMES.map((name, col) => ({ username: `${craft}_${name}`, index: row * NAMES.length + col })),
  );
}

export function crowdTitle(serial: number): string {
  const adjective = ADJECTIVES[serial % ADJECTIVES.length] ?? ADJECTIVES[0];
  const noun = NOUNS[Math.floor(serial / ADJECTIVES.length) % NOUNS.length] ?? NOUNS[0];
  const round = Math.floor(serial / (ADJECTIVES.length * NOUNS.length));
  return round === 0 ? `${adjective} ${noun}` : `${adjective} ${noun} ${round + 1}.`;
}

type PlannedMap = {
  serial: number;
  title: string;
  description: string;
  visibility: Visibility;
  content: string;
  parSteps: number | null;
};

function planMaps(deps: Deps, player: CrowdPlayer): PlannedMap[] {
  const random = seededRandom(seedFromText(player.username));
  const span = GENERATOR_MAX - GENERATOR_MIN + 1;
  return Array.from({ length: CROWD_MAPS_PER_PLAYER }, (_, slot) => {
    const serial = player.index * CROWD_MAPS_PER_PLAYER + slot;
    const difficulty = DIFFICULTIES[(player.index + slot) % DIFFICULTIES.length] ?? "easy";
    const rows = GENERATOR_MIN + Math.floor(random() * span);
    const cols = GENERATOR_MIN + Math.floor(random() * span);
    const seed = seedFromText(`${player.username}#${slot.toString()}`);
    const generated = generateMap(deps.engine, { rows, cols, difficulty, seed });
    const moods = MOODS[difficulty];
    const mood = moods[Math.floor(random() * moods.length)] ?? "";
    return {
      serial,
      title: crowdTitle(serial),
      description: `${rows}×${cols}-es bánya. ${mood}`,
      visibility: (serial + 1) % PRIVATE_EVERY === 0 ? "private" : "public",
      content: generated.content,
      parSteps: generated.parSteps,
    };
  });
}

function partialRoute(route: string, random: () => number): string {
  const lines = route.split("\n").filter((line) => line.length > 0);
  const keep = Math.max(1, Math.ceil(lines.length * (0.4 + random() * 0.6)));
  return lines.slice(0, keep).join("\n");
}

type CrowdMap = { mapId: number; versionId: number; serial: number; isPublic: boolean };

async function recordRivals(
  deps: Deps,
  crowdMap: CrowdMap,
  route: string | null,
  rivals: readonly number[],
  now: number,
): Promise<number> {
  if (route === null) {
    return 0;
  }
  const [version] = await deps.db
    .select()
    .from(mapVersions)
    .where(eq(mapVersions.id, crowdMap.versionId))
    .limit(1);
  if (!version) {
    return 0;
  }
  const random = seededRandom(seedFromText(`runs#${crowdMap.serial.toString()}`));
  let recorded = 0;
  for (const [order, userId] of rivals.entries()) {
    const source = random() < 0.4 ? route : partialRoute(route, random);
    const result = await executeAndRecord(deps.db, deps.engine, {
      userId,
      version,
      source,
      now: now + order,
    });
    if (result.kind === "recorded") {
      recorded += 1;
    }
  }
  return recorded;
}

async function createPlayer(deps: Deps, username: string, passwordHash: string, createdAt: number) {
  const created = firstRow(
    await deps.db
      .insert(users)
      .values({ username, passwordHash, role: "user", createdAt })
      .$returningId(),
  );
  return created.id;
}

async function addFavorites(
  deps: Deps,
  playerIds: ReadonlyMap<string, number>,
  publicMaps: readonly CrowdMap[],
  now: number,
): Promise<number> {
  if (publicMaps.length === 0) {
    return 0;
  }
  const rows = [...playerIds.entries()].flatMap(([username, userId]) => {
    const random = seededRandom(seedFromText(`favorites#${username}`));
    const wanted = Math.floor(random() * (MAX_FAVORITES + 1));
    const picked = new Set<number>();
    for (let attempt = 0; attempt < wanted * 2 && picked.size < wanted; attempt += 1) {
      const target = publicMaps[Math.floor(random() * publicMaps.length)];
      if (target) {
        picked.add(target.mapId);
      }
    }
    return [...picked].map((mapId) => ({ userId, mapId, createdAt: now }));
  });
  if (rows.length === 0) {
    return 0;
  }
  await deps.db.insert(mapFavorites).ignore().values(rows);
  const touched = [...new Set(rows.map((row) => row.mapId))];
  await deps.db
    .update(maps)
    .set({
      favoriteCount: sql`(select count(*) from ${mapFavorites} where ${mapFavorites.mapId} = ${maps.id})`,
    })
    .where(inArray(maps.id, touched));
  return rows.length;
}

function rivalsFor(crowdMap: CrowdMap, ownerId: number, candidates: readonly number[]): number[] {
  const random = seededRandom(seedFromText(`rivals#${crowdMap.serial.toString()}`));
  const count = Math.floor(random() * (MAX_RIVALS + 1));
  const chosen = new Set<number>();
  for (let attempt = 0; attempt < count * 3 && chosen.size < count; attempt += 1) {
    const pick = candidates[Math.floor(random() * candidates.length)];
    if (pick !== undefined && pick !== ownerId) {
      chosen.add(pick);
    }
  }
  return [...chosen];
}

export async function ensureCrowd(deps: Deps, base: number): Promise<CrowdReport> {
  const players = crowdPlayers();
  const existing = await deps.db
    .select({ username: users.username })
    .from(users)
    .where(
      inArray(
        users.username,
        players.map((player) => player.username),
      ),
    );
  const taken = new Set(existing.map((row) => row.username.toLowerCase()));
  const missing = players.filter((player) => !taken.has(player.username));
  if (missing.length === 0) {
    return { players: 0, maps: 0, favorites: 0, runs: 0 };
  }
  const passwordHash = await hashPassword(randomBytes(PASSWORD_BYTES).toString("base64url"));
  const playerIds = new Map<string, number>();
  for (const player of missing) {
    playerIds.set(
      player.username,
      await createPlayer(deps, player.username, passwordHash, base + player.index),
    );
  }
  const created: CrowdMap[] = [];
  const routes = new Map<number, string | null>();
  const owners = new Map<number, number>();
  for (const player of missing) {
    const ownerId = playerIds.get(player.username);
    if (ownerId === undefined) {
      continue;
    }
    for (const plan of planMaps(deps, player)) {
      const valid = validateMapContent(deps.engine, plan.content);
      if (!valid.ok) {
        continue;
      }
      const stamp = base + CROWD_OFFSET_MS + plan.serial;
      const map = await createMapWithVersion(deps.db, {
        ownerId,
        title: plan.title,
        description: plan.description,
        visibility: plan.visibility,
        parSteps: plan.parSteps,
        lampMode: "open",
        valid,
        now: stamp,
      });
      if (map.currentVersionId === null) {
        continue;
      }
      const crowdMap = {
        mapId: map.id,
        versionId: map.currentVersionId,
        serial: plan.serial,
        isPublic: plan.visibility === "public",
      };
      created.push(crowdMap);
      routes.set(crowdMap.mapId, solveRoute(valid.map));
      owners.set(crowdMap.mapId, ownerId);
    }
  }
  const candidates = [...playerIds.values()];
  let runs = 0;
  for (const crowdMap of created) {
    if (!crowdMap.isPublic) {
      continue;
    }
    const ownerId = owners.get(crowdMap.mapId) ?? 0;
    runs += await recordRivals(
      deps,
      crowdMap,
      routes.get(crowdMap.mapId) ?? null,
      rivalsFor(crowdMap, ownerId, candidates),
      base + CROWD_OFFSET_MS + crowdMap.serial,
    );
  }
  const favorites = await addFavorites(
    deps,
    playerIds,
    created.filter((crowdMap) => crowdMap.isPublic),
    base + CROWD_OFFSET_MS,
  );
  return { players: playerIds.size, maps: created.length, favorites, runs };
}
