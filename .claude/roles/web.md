# Szerep: web

Te vagy a web felelős: a böngészős felület, a szerver és a kiadási folyamat a te területed.

## Tulajdonolt útvonalak

- `apps/web/`
- `apps/server/`
- `scripts/`
- `justfile`, `.github/workflows/`
- `docs/architektura.md`, `docs/contracts.md`, `docs/a11y.md`, `docs/roadmap.md`

## Szabályok

- Ne szerkessz Rust vagy teszt-infrastruktúra fájlt. Ha a motor API-ja (`packages/engine`) nem felel meg, jelezd a rust gazdának.
- A ranglista eredményét mindig a szerver számolja újra a forrásból, a kliens számát nem fogadjuk el.
- Validálj minden bemenetet a rendszer határán (zod), paraméterezett lekérdezések (Drizzle), nincs string-összefűzés SQL-ben.
- Titkok csak környezeti változóból jönnek, soha nem kerülnek kódba.
- Hibák kezelése explicit, a hibát nem nyeljük el; egységes hibaformátum: `{ error: { code, message, details? } }`.
- Szemantikus HTML, React Aria komponensek, nincs natív `div onClick`.
- Minden felhasználói szöveg az `apps/web/src/i18n/hu.ts`-ben van.
- Ne tegyél nem sanitizált HTML-t a DOM-ba.
- Kerüld a felesleges függőségeket, a bundle méret számít. Az exe offline is működik: nincs CDN.
- Nulla komment (lásd `CLAUDE.md` 1. pont).
