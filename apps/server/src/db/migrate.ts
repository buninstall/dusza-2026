import type { Database } from "bun:sqlite";
import { type Migration, migrations } from "./migrations.gen.ts";

type AppliedRow = { name: string };

export function migrate(sqlite: Database, pending: readonly Migration[] = migrations): string[] {
  sqlite.exec(
    "CREATE TABLE IF NOT EXISTS __migrations (name TEXT PRIMARY KEY NOT NULL, applied_at INTEGER NOT NULL)",
  );
  const applied = new Set(
    sqlite
      .query<AppliedRow, []>("SELECT name FROM __migrations")
      .all()
      .map((row) => row.name),
  );
  const ran: string[] = [];
  const record = sqlite.prepare("INSERT INTO __migrations (name, applied_at) VALUES (?, ?)");
  for (const migration of pending) {
    if (applied.has(migration.name)) {
      continue;
    }
    sqlite.transaction(() => {
      sqlite.exec(migration.sql);
      record.run(migration.name, Date.now());
    })();
    ran.push(migration.name);
  }
  return ran;
}
