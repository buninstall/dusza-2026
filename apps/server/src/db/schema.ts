import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const ROLES = ["admin", "user"] as const;
export const VISIBILITIES = ["public", "private"] as const;
export const OUTCOME_KINDS = ["ok", "runtimeError"] as const;

export type Role = (typeof ROLES)[number];
export type Visibility = (typeof VISIBILITIES)[number];
export type RecordedOutcome = (typeof OUTCOME_KINDS)[number];

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ROLES }).notNull().default("user"),
  createdAt: integer("created_at").notNull(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    idHash: text("id_hash").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [index("sessions_user_idx").on(table.userId)],
);

export const maps = sqliteTable(
  "maps",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ownerId: integer("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    visibility: text("visibility", { enum: VISIBILITIES }).notNull().default("public"),
    currentVersionId: integer("current_version_id"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("maps_owner_idx").on(table.ownerId)],
);

export const mapVersions = sqliteTable(
  "map_versions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mapId: integer("map_id")
      .notNull()
      .references(() => maps.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    content: text("content").notNull(),
    contentHash: text("content_hash").notNull(),
    rows: integer("rows").notNull(),
    cols: integer("cols").notNull(),
    goldTotal: integer("gold_total").notNull(),
    reachableGold: integer("reachable_gold").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [uniqueIndex("map_versions_map_version_idx").on(table.mapId, table.version)],
);

export const programs = sqliteTable(
  "programs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ownerId: integer("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    source: text("source").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("programs_owner_idx").on(table.ownerId)],
);

export const runs = sqliteTable(
  "runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mapVersionId: integer("map_version_id")
      .notNull()
      .references(() => mapVersions.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    sourceHash: text("source_hash").notNull(),
    gold: integer("gold").notNull(),
    steps: integer("steps").notNull(),
    outcomeKind: text("outcome_kind", { enum: OUTCOME_KINDS }).notNull(),
    errorCode: text("error_code"),
    errorLine: integer("error_line"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("runs_leaderboard_idx").on(
      table.mapVersionId,
      sql`${table.gold} DESC`,
      sql`${table.steps} ASC`,
      sql`${table.createdAt} ASC`,
    ),
    index("runs_user_idx").on(table.userId),
  ],
);

export type User = typeof users.$inferSelect;
export type MapRow = typeof maps.$inferSelect;
export type MapVersionRow = typeof mapVersions.$inferSelect;
export type ProgramRow = typeof programs.$inferSelect;
export type RunRow = typeof runs.$inferSelect;
