export const DEFAULT_DATABASE_URL = "mysql://minescript:minescript@127.0.0.1:3306/minescript";
export const DEFAULT_TEST_DATABASE_URL = "mysql://root@127.0.0.1:3306";

const MYSQL_PORT = 3306;
const DATABASE_NAME = /^[A-Za-z0-9_]{1,64}$/;
const URL_FORMAT = "mysql://felhasználó:jelszó@gép:port/adatbázis";

export type MysqlServer = {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
};

export type DatabaseTarget = MysqlServer & { readonly database: string };

export class DatabaseUrlError extends Error {
  override readonly name = "DatabaseUrlError";
}

export function assertDatabaseName(name: string): string {
  if (!DATABASE_NAME.test(name)) {
    throw new DatabaseUrlError(
      `Érvénytelen adatbázisnév: „${name}”. Csak angol betű, számjegy és aláhúzás lehet, legfeljebb 64 karakter.`,
    );
  }
  return name;
}

export function quoteIdentifier(name: string): string {
  return `\`${assertDatabaseName(name)}\``;
}

function decodePart(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    throw new DatabaseUrlError(
      `Az adatbázis-URL hibás százalékos kódolást tartalmaz (${URL_FORMAT}).`,
    );
  }
}

function parseUrl(raw: string): URL {
  const url = URL.canParse(raw) ? new URL(raw) : null;
  if (url?.protocol !== "mysql:" || url.hostname === "") {
    throw new DatabaseUrlError(
      `Az adatbázis-URL nem értelmezhető. A helyes formátum: ${URL_FORMAT}`,
    );
  }
  if (url.username === "") {
    throw new DatabaseUrlError(`Az adatbázis-URL-ből hiányzik a felhasználónév (${URL_FORMAT}).`);
  }
  return url;
}

export function parseServerUrl(raw: string): MysqlServer {
  const url = parseUrl(raw);
  const port = url.port === "" ? MYSQL_PORT : Number(url.port);
  return {
    host: url.hostname.replace(/^\[(.*)\]$/, "$1"),
    port,
    user: decodePart(url.username),
    password: decodePart(url.password),
  };
}

export function parseDatabaseUrl(raw: string): DatabaseTarget {
  const database = decodePart(parseUrl(raw).pathname.replace(/^\//, ""));
  if (database === "") {
    throw new DatabaseUrlError(`Az adatbázis-URL-ből hiányzik az adatbázis neve (${URL_FORMAT}).`);
  }
  return { ...parseServerUrl(raw), database: assertDatabaseName(database) };
}

export function withDatabase(serverUrl: string, database: string): string {
  const url = parseUrl(serverUrl);
  url.pathname = `/${assertDatabaseName(database)}`;
  return url.toString();
}

export function temporaryDatabaseName(
  purpose: string,
  unique = `${process.pid}_${Date.now()}`,
): string {
  return assertDatabaseName(`minescript_${purpose}_${unique}`);
}

export function describeTarget(target: DatabaseTarget): string {
  return `${target.user}@${target.host}:${target.port}/${target.database}`;
}
