import type { MysqlServer } from "./url.ts";

export class DatabaseError extends Error {
  override readonly name = "DatabaseError";

  constructor(
    message: string,
    readonly hint: string | null,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

const UNREACHABLE_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ETIMEDOUT",
]);

const START_HINT =
  "Indítsd el a MySQL-t (Homebrew: brew services start mysql, Docker: docker compose up -d mysql), " +
  "vagy add meg a kapcsolatot a DATABASE_URL környezeti változóval, illetve a --database-url kapcsolóval.";

const ACCOUNT_HINT =
  "Ellenőrizd a DATABASE_URL-ben a felhasználónevet, a jelszót és az adatbázis nevét. " +
  "A fejlesztői adatbázist és fiókot a just db-setup hozza létre.";

type ErrorLike = { code?: unknown; cause?: unknown };

export function mysqlErrorCode(error: unknown): string | undefined {
  let current = error;
  while (typeof current === "object" && current !== null) {
    const { code, cause } = current as ErrorLike;
    if (typeof code === "string") {
      return code;
    }
    current = cause;
  }
  return undefined;
}

const TRANSIENT_CODES = new Set([
  ...UNREACHABLE_CODES,
  "EPIPE",
  "PROTOCOL_CONNECTION_LOST",
  "PROTOCOL_SEQUENCE_TIMEOUT",
  "ER_CON_COUNT_ERROR",
  "ER_LOCK_DEADLOCK",
  "ER_LOCK_WAIT_TIMEOUT",
  "ER_SERVER_SHUTDOWN",
  "ER_QUERY_INTERRUPTED",
  "ER_CLIENT_INTERACTION_TIMEOUT",
]);

export function isTransientDbError(error: unknown): boolean {
  const code = mysqlErrorCode(error);
  return code !== undefined && TRANSIENT_CODES.has(code);
}

export function isDuplicateEntry(error: unknown): boolean {
  return mysqlErrorCode(error) === "ER_DUP_ENTRY";
}

export function toDatabaseError(
  error: unknown,
  target: MysqlServer & { readonly database?: string },
): DatabaseError {
  if (error instanceof DatabaseError) {
    return error;
  }
  const code = mysqlErrorCode(error) ?? "";
  const address = `${target.host}:${target.port}`;
  if (UNREACHABLE_CODES.has(code)) {
    return new DatabaseError(`A MySQL-szerver nem érhető el: ${address}.`, START_HINT, {
      cause: error,
    });
  }
  if (code === "ER_ACCESS_DENIED_ERROR") {
    return new DatabaseError(
      `A MySQL (${address}) elutasította a(z) „${target.user}” felhasználó belépését.`,
      ACCOUNT_HINT,
      { cause: error },
    );
  }
  if (code === "ER_DBACCESS_DENIED_ERROR" || code === "ER_BAD_DB_ERROR") {
    return new DatabaseError(
      `A(z) „${target.database}” adatbázis nem létezik, vagy a(z) „${target.user}” felhasználónak nincs hozzá joga.`,
      ACCOUNT_HINT,
      { cause: error },
    );
  }
  const detail = error instanceof Error ? error.message : String(error);
  return new DatabaseError(`Adatbázishiba (${address}): ${detail}`, null, { cause: error });
}
