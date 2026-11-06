import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { connectionOptions, createDatabase } from "./admin.ts";
import { mysqlErrorCode, toDatabaseError } from "./errors.ts";
import type { DatabaseTarget } from "./url.ts";

const POOL_SIZE = 10;
const KEEP_ALIVE_DELAY_MS = 10_000;

export type Db = MySql2Database;

export type Database = {
  readonly db: Db;
  close(): Promise<void>;
};

async function ensureDatabase(target: DatabaseTarget): Promise<void> {
  try {
    await createDatabase(target);
  } catch (error) {
    if (mysqlErrorCode(error) !== "ER_DBACCESS_DENIED_ERROR") {
      throw toDatabaseError(error, target);
    }
  }
}

export async function openDatabase(target: DatabaseTarget): Promise<Database> {
  await ensureDatabase(target);
  const pool = mysql.createPool({
    ...connectionOptions(target, target.database),
    connectionLimit: POOL_SIZE,
    enableKeepAlive: true,
    keepAliveInitialDelay: KEEP_ALIVE_DELAY_MS,
  });
  try {
    await pool.query("SELECT 1");
  } catch (error) {
    await pool.end();
    throw toDatabaseError(error, target);
  }
  return { db: drizzle({ client: pool }), close: () => pool.end() };
}
