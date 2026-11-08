import { sql } from "drizzle-orm";
import {
  bigint,
  char,
  customType,
  index,
  int,
  mediumtext,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const ROLES = ["admin", "user"] as const;
export const VISIBILITIES = ["public", "private"] as const;
export const OUTCOME_KINDS = ["ok", "runtimeError"] as const;
export const LAMP_MODES = ["open", "lamp", "dark"] as const;
export const DIFFICULTY_MARKS = ["easy", "medium", "hard", "none"] as const;

export type Role = (typeof ROLES)[number];
export type Visibility = (typeof VISIBILITIES)[number];
export type RecordedOutcome = (typeof OUTCOME_KINDS)[number];
export type LampMode = (typeof LAMP_MODES)[number];
export type DifficultyMark = (typeof DIFFICULTY_MARKS)[number];

export const COLLATION = "utf8mb4_0900_ai_ci";

export const LIMITS = {
  username: 24,
  title: 80,
  description: 500,
  parSteps: 1000,
} as const;

const DAY_KEY_LENGTH = 10;

const SHA256_HEX_LENGTH = 64;

const caseInsensitiveName = customType<{ data: string; notNull: true }>({
  dataType: () => `varchar(${LIMITS.username}) collate ${COLLATION}`,
});

const millis = (name: string) => bigint(name, { mode: "number" });
const sha256 = (name: string) => char(name, { length: SHA256_HEX_LENGTH });

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  username: caseInsensitiveName("username").notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: mysqlEnum("role", ROLES).notNull().default("user"),
  createdAt: millis("created_at").notNull(),
});

export const sessions = mysqlTable(
  "sessions",
  {
    idHash: sha256("id_hash").primaryKey(),
    userId: int("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: millis("expires_at").notNull(),
  },
  (table) => [index("sessions_user_idx").on(table.userId)],
);

export const maps = mysqlTable(
  "maps",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: LIMITS.title }).notNull(),
    description: varchar("description", { length: LIMITS.description }).notNull().default(""),
    visibility: mysqlEnum("visibility", VISIBILITIES).notNull().default("public"),
    currentVersionId: int("current_version_id"),
    parSteps: int("par_steps"),
    lampMode: mysqlEnum("lamp_mode", LAMP_MODES).notNull().default("open"),
    dailyDate: char("daily_date", { length: DAY_KEY_LENGTH }),
    favoriteCount: int("favorite_count").notNull().default(0),
    createdAt: millis("created_at").notNull(),
    updatedAt: millis("updated_at").notNull(),
  },
  (table) => [
    index("maps_owner_idx").on(table.ownerId),
    uniqueIndex("maps_daily_date_idx").on(table.dailyDate),
    index("maps_created_idx").on(table.createdAt, table.id),
    index("maps_updated_idx").on(table.updatedAt, table.id),
    index("maps_favorite_idx").on(table.favoriteCount, table.id),
  ],
);

export const mapVersions = mysqlTable(
  "map_versions",
  {
    id: int("id").autoincrement().primaryKey(),
    mapId: int("map_id")
      .notNull()
      .references(() => maps.id, { onDelete: "cascade" }),
    version: int("version").notNull(),
    content: text("content").notNull(),
    contentHash: sha256("content_hash").notNull(),
    rows: int("rows").notNull(),
    cols: int("cols").notNull(),
    goldTotal: int("gold_total").notNull(),
    reachableGold: int("reachable_gold").notNull(),
    difficulty: mysqlEnum("difficulty", DIFFICULTY_MARKS),
    createdAt: millis("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("map_versions_map_version_idx").on(table.mapId, table.version),
    index("map_versions_hash_idx").on(table.contentHash),
  ],
);

export const mapFavorites = mysqlTable(
  "map_favorites",
  {
    userId: int("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mapId: int("map_id")
      .notNull()
      .references(() => maps.id, { onDelete: "cascade" }),
    createdAt: millis("created_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.mapId] }),
    index("map_favorites_map_idx").on(table.mapId),
    index("map_favorites_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const programs = mysqlTable(
  "programs",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: LIMITS.title }).notNull(),
    source: mediumtext("source").notNull(),
    updatedAt: millis("updated_at").notNull(),
  },
  (table) => [index("programs_owner_updated_idx").on(table.ownerId, table.updatedAt)],
);

export const runs = mysqlTable(
  "runs",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mapVersionId: int("map_version_id")
      .notNull()
      .references(() => mapVersions.id, { onDelete: "cascade" }),
    source: mediumtext("source").notNull(),
    sourceHash: sha256("source_hash").notNull(),
    gold: int("gold").notNull(),
    steps: int("steps").notNull(),
    outcomeKind: mysqlEnum("outcome_kind", OUTCOME_KINDS).notNull(),
    errorCode: varchar("error_code", { length: 64 }),
    errorLine: int("error_line"),
    createdAt: millis("created_at").notNull(),
  },
  (table) => [
    index("runs_leaderboard_idx").on(
      table.mapVersionId,
      sql`${table.gold} desc`,
      table.steps,
      table.createdAt,
    ),
    index("runs_user_created_idx").on(table.userId, table.createdAt),
    index("runs_user_version_idx").on(table.userId, table.mapVersionId),
  ],
);

export type User = typeof users.$inferSelect;
export type MapRow = typeof maps.$inferSelect;
export type MapVersionRow = typeof mapVersions.$inferSelect;
export type ProgramRow = typeof programs.$inferSelect;
export type RunRow = typeof runs.$inferSelect;
export type MapFavoriteRow = typeof mapFavorites.$inferSelect;
