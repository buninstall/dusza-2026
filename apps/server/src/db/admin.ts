import mysql, { type Connection, type ConnectionOptions } from "mysql2/promise";
import { COLLATION } from "./schema.ts";
import { type DatabaseTarget, type MysqlServer, quoteIdentifier } from "./url.ts";

export function connectionOptions(server: MysqlServer, database?: string): ConnectionOptions {
  return {
    host: server.host,
    port: server.port,
    user: server.user,
    password: server.password,
    charset: COLLATION,
    ...(database === undefined ? {} : { database }),
  };
}

export async function withConnection<T>(
  options: ConnectionOptions,
  use: (connection: Connection) => Promise<T>,
): Promise<T> {
  const connection = await mysql.createConnection(options);
  try {
    return await use(connection);
  } finally {
    await connection.end();
  }
}

export async function createDatabase(target: DatabaseTarget): Promise<void> {
  await withConnection(connectionOptions(target), (connection) =>
    connection.query(
      `CREATE DATABASE IF NOT EXISTS ${quoteIdentifier(target.database)} CHARACTER SET utf8mb4 COLLATE ${COLLATION}`,
    ),
  );
}

export async function dropDatabase(target: DatabaseTarget): Promise<void> {
  await withConnection(connectionOptions(target), (connection) =>
    connection.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(target.database)}`),
  );
}
