# apps/server

## Alapelvek

- A ranglista eredményét mindig a szerver számolja: a `POST /api/runs` a forrást a saját WASM-motorjával futtatja (`src/services/runs.ts`), a kliens számait figyelmen kívül hagyja (D13).
- Szintaktikailag hibás program `422 SYNTAX_ERROR`, és nem kerül mentésre.
- A térképtartalmat mentés előtt az `engine.parseMap` validálja, és a kanonikus alak (`serializeMap`) kerül az adatbázisba.

## Hibaformátum

Minden hiba: `{ error: { code, message, details? } }`, a `src/lib/errors.ts` `apiError` segédjével. A `message` magyar. A zod-validáció hibája `400 VALIDATION`, a `details` a mezőnkénti üzenetek listája (`src/lib/validation.ts`).

## Migrációk

1. Módosítsd a `src/db/schema.ts`-t.
2. `bun run db:generate` (drizzle-kit, `breakpoints: false`, így az SQL-ben nincs kommentjelölő).
3. `bun scripts/gen-migrations.ts` (a `just build` is futtatja): a `drizzle/*.sql` fájlok a `src/db/migrations.gen.ts`-be kerülnek, `with { type: "text" }` importtal, így a binárisba ágyazódnak.
4. Commitold a `drizzle/` és a `migrations.gen.ts` változásait.

A saját migrátor (`src/db/migrate.ts`) a `__migrations` táblában tartja nyilván, mi futott le.

## Seed

- Idempotens (`src/seed/index.ts`): csak üres adatbázist tölt fel, `--reset-demo` esetén előbb mindent töröl.
- Demó-fiókok: `admin / dusza2026`, `demo1`–`demo3 / demo2026`.
- 8 oktató térkép (`src/seed/maps.ts`), mindegyik kézzel írt és a teszt validálja; mintaprogramok (`src/seed/programs.ts`).
- A mintaprogramok futásait a seed a motorral számolja; amíg a motor stub, ezeket kihagyja. A kész VM után `--reset-demo` újragenerálja őket.

## Futtatás

- Fejlesztés: `bun run dev` (a gyökérből `just dev`), port 8080, adatbázis: `apps/server/data/minescript.db`.
- Prod mód: `--static` kapcsoló vagy lefordított bináris; a SPA a `static-manifest.gen.js`-ből jön.
- Teszt mód (`start:test`, e2e): ideiglenes adatbázis, seed, port 8090, leállításkor az adatbázis törlődik.
