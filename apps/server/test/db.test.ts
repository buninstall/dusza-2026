import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/mysql-core";
import type { RowDataPacket } from "mysql2/promise";
import { connectionOptions, dropDatabase, withConnection } from "../src/db/admin.ts";
import { openDatabase } from "../src/db/client.ts";
import { DatabaseError, isDuplicateEntry } from "../src/db/errors.ts";
import { migrate } from "../src/db/migrate.ts";
import { migrations } from "../src/db/migrations.gen.ts";
import { firstRow } from "../src/db/rows.ts";
import {
  COLLATION,
  mapFavorites,
  maps,
  mapVersions,
  programs,
  runs,
  sessions,
  users,
} from "../src/db/schema.ts";
import type { DatabaseTarget } from "../src/db/url.ts";
import {
  createTestContext,
  createTestDatabase,
  type ErrorBody,
  json,
  testServer,
  testTarget,
} from "./helpers.ts";

async function query<T extends RowDataPacket>(
  target: DatabaseTarget,
  statement: string,
  values: unknown[] = [],
): Promise<T[]> {
  return withConnection(connectionOptions(target, target.database), async (connection) => {
    const [rows] = await connection.query<T[]>(statement, values);
    return rows;
  });
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("A műveletnek hibával kellett volna végződnie.");
}

type NameRow = RowDataPacket & { name: string };

describe("MySQL-kapcsolat", () => {
  test("elérhetetlen szervernél magyar üzenet és indítási tipp", async () => {
    const error = await rejection(
      openDatabase({ ...testServer, port: 1, database: "minescript_elerhetetlen" }),
    );
    expect(error).toBeInstanceOf(DatabaseError);
    const { message, hint } = error as DatabaseError;
    expect(message).toBe(`A MySQL-szerver nem érhető el: ${testServer.host}:1.`);
    expect(hint).toContain("docker compose up -d mysql");
    expect(hint).toContain("DATABASE_URL");
  });

  test("ismeretlen fióknál a belépési adatok ellenőrzését kéri", async () => {
    const error = await rejection(
      openDatabase({
        ...testServer,
        user: "minescript_nincs_ilyen",
        password: "rossz-jelszo",
        database: "minescript_nincs_ilyen",
      }),
    );
    expect(error).toBeInstanceOf(DatabaseError);
    expect((error as DatabaseError).message).toContain("„minescript_nincs_ilyen” felhasználó");
    expect((error as DatabaseError).hint).toContain("just db-setup");
  });

  test("a hiányzó adatbázist utf8mb4 kódolással létrehozza", async () => {
    const target = testTarget();
    const database = await openDatabase(target);
    try {
      const [schema] = await query<RowDataPacket & { charset: string; collation: string }>(
        target,
        "SELECT DEFAULT_CHARACTER_SET_NAME AS charset, DEFAULT_COLLATION_NAME AS collation FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
        [target.database],
      );
      expect(schema).toEqual(expect.objectContaining({ charset: "utf8mb4", collation: COLLATION }));
    } finally {
      await database.close();
      await dropDatabase(target);
    }
  });
});

describe("migrátor", () => {
  test("idempotens: a második futás nem csinál semmit", async () => {
    await using database = await createTestDatabase();
    expect(await migrate(database.target)).toEqual([]);
    const applied = await query<NameRow>(database.target, "SELECT name FROM __migrations");
    expect(applied.map((row) => row.name)).toEqual(migrations.map((migration) => migration.name));
  });

  test("párhuzamos indításkor minden migráció egyszer fut le", async () => {
    const target = testTarget();
    const database = await openDatabase(target);
    try {
      const results = await Promise.all([migrate(target), migrate(target), migrate(target)]);
      expect(results.flat()).toEqual(migrations.map((migration) => migration.name));
    } finally {
      await database.close();
      await dropDatabase(target);
    }
  });

  test("a hibás migráció magyar hibát ad, és nem kerül nyilvántartásba", async () => {
    await using database = await createTestDatabase();
    const broken = {
      name: "9999_hibas",
      sql: "CREATE TABLE `felig_kesz` (`id` int);\nCREATE TABLE `hibas` (",
    };
    const error = await rejection(migrate(database.target, [...migrations, broken]));
    expect(error).toBeInstanceOf(DatabaseError);
    expect((error as DatabaseError).message).toStartWith("A(z) 9999_hibas migráció sikertelen:");
    expect((error as DatabaseError).hint).toContain("azonnal véglegesíti");
    const applied = await query<NameRow>(database.target, "SELECT name FROM __migrations");
    expect(applied.map((row) => row.name)).not.toContain(broken.name);
    const partial = await query<NameRow>(
      database.target,
      "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'felig_kesz'",
      [database.target.database],
    );
    expect(partial).toHaveLength(1);
  });

  test("a migráció a séma minden indexét és idegen kulcsát létrehozza", async () => {
    await using database = await createTestDatabase();
    const tables = [users, sessions, maps, mapVersions, mapFavorites, programs, runs].map(
      getTableConfig,
    );
    const indexes = await query<NameRow>(
      database.target,
      "SELECT DISTINCT INDEX_NAME AS name FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ?",
      [database.target.database],
    );
    const foreignKeys = await query<NameRow>(
      database.target,
      "SELECT CONSTRAINT_NAME AS name FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY'",
      [database.target.database],
    );
    const indexNames = indexes.map((row) => row.name);
    for (const table of tables) {
      expect(indexNames).toEqual(
        expect.arrayContaining(table.indexes.map((index) => index.config.name)),
      );
    }
    expect(foreignKeys.map((row) => row.name).sort()).toEqual(
      tables.flatMap((table) => table.foreignKeys.map((key) => key.getName())).sort(),
    );
  });
});

describe("adatbázis-szintű szabályok", () => {
  test("a felhasználónév kis- és nagybetűtől függetlenül egyedi", async () => {
    await using database = await createTestDatabase();
    const values = { passwordHash: "-", role: "user" as const, createdAt: 1 };
    await database.db.insert(users).values({ username: "Kincs", ...values });
    const error = await rejection(
      database.db.insert(users).values({ username: "kincs", ...values }),
    );
    expect(isDuplicateEntry(error)).toBe(true);
    const [found] = await database.db.select().from(users).where(eq(users.username, "KINCS"));
    expect(found?.username).toBe("Kincs");
  });

  test("a felhasználó törlése kaszkádolva viszi a térképeit, verzióit és futásait", async () => {
    await using context = await createTestContext();
    const owner = context.client();
    const { user } = await owner.register("torlendo");
    await owner.post("/api/maps", { title: "Eltűnő", content: "1 2\n>@" });
    await owner.post("/api/programs", { title: "Program", source: "" });
    const [version] = await context.deps.db.select().from(mapVersions);
    await context.deps.db.insert(runs).values({
      userId: user.id,
      mapVersionId: version?.id ?? 0,
      source: "",
      sourceHash: "",
      gold: 0,
      steps: 0,
      outcomeKind: "ok",
      createdAt: 1,
    });
    await context.deps.db.delete(users).where(eq(users.id, user.id));
    for (const table of [maps, mapVersions, programs, runs, sessions]) {
      expect(await context.deps.db.select().from(table)).toEqual([]);
    }
  });

  test("adatbázishiba esetén egységes 500-as válasz", async () => {
    await using context = await createTestContext();
    const user = context.client();
    await user.register("szerencsetlen");
    await dropDatabase(context.target);
    const response = await user.get("/api/maps");
    expect(response.status).toBe(500);
    expect((await json<ErrorBody>(response)).error.code).toBe("INTERNAL");
  });

  test("a firstRow üres eredménynél hibát dob", () => {
    expect(firstRow([7, 8])).toBe(7);
    expect(() => firstRow([])).toThrow("Az adatbázis nem adta vissza a várt sort.");
  });
});
