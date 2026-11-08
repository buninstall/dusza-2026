import type { Connection, RowDataPacket } from "mysql2/promise";
import { capitalArticle } from "../lib/article.ts";
import { connectionOptions, withConnection } from "./admin.ts";
import { DatabaseError, toDatabaseError } from "./errors.ts";
import { type Migration, migrations } from "./migrations.gen.ts";
import type { DatabaseTarget } from "./url.ts";

const LOCK_TIMEOUT_SECONDS = 30;
const LOCK_NAME_LIMIT = 64;

const PARTIAL_MIGRATION_HINT =
  "A MySQL a sémamódosításokat azonnal véglegesíti, ezért a migráció egy része lefuthatott. " +
  "Fejlesztői adatbázisnál töröld az adatbázist, és indítsd újra a szervert; " +
  "éles adatbázisnál állítsd vissza a mentésből.";

type AppliedRow = RowDataPacket & { name: string };
type LockRow = RowDataPacket & { acquired: number | null };

async function withMigrationLock<T>(
  connection: Connection,
  database: string,
  run: () => Promise<T>,
): Promise<T> {
  const lockName = `migrations:${database}`.slice(0, LOCK_NAME_LIMIT);
  const [[lock]] = await connection.query<LockRow[]>("SELECT GET_LOCK(?, ?) AS acquired", [
    lockName,
    LOCK_TIMEOUT_SECONDS,
  ]);
  if (lock?.acquired !== 1) {
    throw new DatabaseError(
      `${capitalArticle(database)} „${database}” adatbázist egy másik folyamat migrálja, és ${LOCK_TIMEOUT_SECONDS} másodperc alatt sem végzett.`,
      "Várd meg, amíg a másik szerverpéldány elindul, vagy állítsd le.",
    );
  }
  try {
    return await run();
  } finally {
    await connection.query("SELECT RELEASE_LOCK(?)", [lockName]);
  }
}

async function apply(connection: Connection, migration: Migration): Promise<void> {
  try {
    await connection.query(migration.sql);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new DatabaseError(
      `${capitalArticle(migration.name)} ${migration.name} migráció sikertelen: ${detail}`,
      PARTIAL_MIGRATION_HINT,
      { cause: error },
    );
  }
  await connection.query("INSERT INTO `__migrations` (`name`, `applied_at`) VALUES (?, ?)", [
    migration.name,
    Date.now(),
  ]);
}

export async function migrate(
  target: DatabaseTarget,
  pending: readonly Migration[] = migrations,
): Promise<string[]> {
  const options = { ...connectionOptions(target, target.database), multipleStatements: true };
  try {
    return await withConnection(options, (connection) =>
      withMigrationLock(connection, target.database, async () => {
        await connection.query(
          "CREATE TABLE IF NOT EXISTS `__migrations` (`name` varchar(255) NOT NULL PRIMARY KEY, `applied_at` bigint NOT NULL)",
        );
        const [rows] = await connection.query<AppliedRow[]>("SELECT `name` FROM `__migrations`");
        const applied = new Set(rows.map((row) => row.name));
        const ran: string[] = [];
        for (const migration of pending) {
          if (!applied.has(migration.name)) {
            await apply(connection, migration);
            ran.push(migration.name);
          }
        }
        return ran;
      }),
    );
  } catch (error) {
    throw toDatabaseError(error, target);
  }
}
