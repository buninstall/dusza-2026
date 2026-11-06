import { parseArgs } from "node:util";
import { connectionOptions, createDatabase, withConnection } from "../apps/server/src/db/admin.ts";
import { toDatabaseError } from "../apps/server/src/db/errors.ts";
import {
  type DatabaseTarget,
  DEFAULT_DATABASE_URL,
  DEFAULT_TEST_DATABASE_URL,
  describeTarget,
  parseDatabaseUrl,
  parseServerUrl,
  quoteIdentifier,
} from "../apps/server/src/db/url.ts";
import { fail, info, warn } from "./lib.ts";

const LOCAL_HOSTS = ["localhost", "127.0.0.1"];

const GUIDE = [
  "A MySQL előkészítése:",
  "  Docker:       just db-up (docker compose up -d mysql), a fiókot a compose hozza létre",
  "  Helyi MySQL:  brew install mysql && brew services start mysql (Windows: MySQL Installer),",
  "                majd just db-setup [--admin-url mysql://root:jelszó@127.0.0.1:3306]",
  "  Más szerver:  DATABASE_URL=mysql://felhasználó:jelszó@gép:port/adatbázis (minta: .env.example)",
].join("\n");

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    "admin-url": { type: "string" },
    check: { type: "boolean", default: false },
  },
  strict: true,
});

const target = parseDatabaseUrl(process.env.DATABASE_URL || DEFAULT_DATABASE_URL);

async function verify(database: DatabaseTarget): Promise<void> {
  await withConnection(connectionOptions(database, database.database), (connection) =>
    connection.query("SELECT 1"),
  );
}

async function createDevAccount(): Promise<void> {
  const admin = parseServerUrl(
    values["admin-url"] || process.env.TEST_DATABASE_URL || DEFAULT_TEST_DATABASE_URL,
  );
  try {
    await createDatabase({ ...admin, database: target.database });
    await withConnection(connectionOptions(admin), async (connection) => {
      for (const host of LOCAL_HOSTS) {
        await connection.query("CREATE USER IF NOT EXISTS ?@? IDENTIFIED BY ?", [
          target.user,
          host,
          target.password,
        ]);
        await connection.query(
          `GRANT ALL PRIVILEGES ON ${quoteIdentifier(target.database)}.* TO ?@?`,
          [target.user, host],
        );
      }
    });
  } catch (error) {
    const reason = toDatabaseError(error, admin);
    fail(`Az adminisztrátori kapcsolat sikertelen: ${reason.message}\n${GUIDE}`);
  }
  info(`Az adatbázis és a fiók kész: ${describeTarget(target)}`);
}

if (!values.check) {
  await createDevAccount();
}

try {
  await verify(target);
  info(`A MySQL elérhető: ${describeTarget(target)}`);
} catch (error) {
  const reason = toDatabaseError(error, target);
  if (values.check) {
    warn(`${reason.message}\n${GUIDE}`);
    process.exit(1);
  }
  fail(`${reason.message}\n${reason.hint ?? ""}`);
}
