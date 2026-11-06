# apps/server

## Alapelvek

- A ranglista eredményét mindig a szerver számolja: a `POST /api/runs` a forrást a saját WASM-motorjával futtatja (`src/services/runs.ts`), a kliens számait figyelmen kívül hagyja (D13).
- Szintaktikailag hibás program `422 SYNTAX_ERROR`, és nem kerül mentésre.
- A térképtartalmat mentés előtt az `engine.parseMap` validálja, és a kanonikus alak (`serializeMap`) kerül az adatbázisba.

## Hibaformátum

Minden hiba: `{ error: { code, message, details? } }`, a `src/lib/errors.ts` `apiError` segédjével. A `message` magyar. A zod-validáció hibája `400 VALIDATION`, a `details` a mezőnkénti üzenetek listája (`src/lib/validation.ts`).

## Migrációk

1. Módosítsd a `src/db/schema.ts`-t.
2. `bun run db:generate` (drizzle-kit, MySQL-dialektus, `breakpoints: false`, így az SQL-ben nincs kommentjelölő).
3. `bun scripts/gen-migrations.ts` (a `just build` is futtatja): a `drizzle/*.sql` fájlok a `src/db/migrations.gen.ts`-be kerülnek, `with { type: "text" }` importtal, így a binárisba ágyazódnak.
4. Commitold a `drizzle/` és a `migrations.gen.ts` változásait.

A saját migrátor (`src/db/migrate.ts`) dedikált, több utasítást engedő kapcsolaton, `GET_LOCK` alatt futtatja az új migrációkat, és a `__migrations` táblában tartja nyilván, mi futott le. A MySQL a DDL-t azonnal véglegesíti, ezért egy hibás migráció részben lefuthat: ilyenkor nem kerül nyilvántartásba, és a hiba ezt jelzi.

## Adatbázis

- MySQL 8.0+ a Drizzle `mysql2` meghajtójával (`src/db/client.ts`, pool). Kapcsolat: `DATABASE_URL` vagy `--database-url`, alapból `mysql://minescript:minescript@127.0.0.1:3306/minescript`.
- Induláskor `CREATE DATABASE IF NOT EXISTS` (utf8mb4, `utf8mb4_0900_ai_ci`), ha van rá jog; utána migráció és seed.
- A kapcsolódási hibákat a `src/db/errors.ts` fordítja magyar üzenetre és teendőre.
- MySQL-ben nincs `RETURNING`: beszúrás után `$returningId()` és olvasás (`firstRow`), módosítás után újraolvasás.
- Csak paraméterezett lekérdezés; az adatbázisnevet a `src/db/url.ts` validálja (`^[A-Za-z0-9_]{1,64}$`), és csak `quoteIdentifier`-rel kerülhet SQL-be.

## Seed

- Idempotens (`src/seed/index.ts`): csak üres adatbázist tölt fel, `--reset-demo` esetén előbb mindent töröl.
- Demó-fiókok: `admin / dusza2026`, `demo1`–`demo3 / demo2026`.
- 8 oktató térkép (`src/seed/maps.ts`), mindegyik kézzel írt és a teszt validálja; mintaprogramok (`src/seed/programs.ts`).
- A mintaprogramok futásait a seed a motorral számolja; amíg a motor stub, ezeket kihagyja. A kész VM után `--reset-demo` újragenerálja őket.

## Futtatás

- Fejlesztés: `bun run dev` (a gyökérből `just dev`), port 8080. MySQL: `just db-up` (Docker) vagy helyi szerveren `just db-setup`.
- Prod mód: `--static` kapcsoló vagy lefordított bináris; a SPA a `static-manifest.gen.js`-ből jön.
- Teszt mód (`start:test`, e2e): friss `minescript_e2e_<pid>_<idő>` adatbázis a `TEST_DATABASE_URL` (ennek hiányában a `DATABASE_URL`) szerverén, seed, port 8090; `SIGTERM`/`SIGINT` esetén az adatbázis törlődik.
- Tesztek (`bun test`): minden `createTestContext()` saját `minescript_test_<véletlen>` adatbázist kap a `TEST_DATABASE_URL` szerverén (alapból `mysql://root@127.0.0.1:3306`); `await using` zárja a poolt és törli az adatbázist. Lefedettség: `bun test --coverage`.
