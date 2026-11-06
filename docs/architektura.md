# Architektúra

## Áttekintés

Egyetlen MineScript-motor (Rust crate) fut három helyen: a böngészőben WASM-ként, a szerveren ugyanazzal a `.wasm`-mal, és natív CLI-ként. A futás tiszta függvény: `run(source, mapText) -> RunResult`, benne a teljes eseménysorral (trace). A felület nem lépteti a VM-et, hanem a kész trace-t játssza le lassítva.

```mermaid
flowchart LR
  subgraph Rust["crates/ (Rust)"]
    core["minescript-core<br/>parser · VM · map · IDE"]
    wasm["minescript-wasm<br/>wasm-bindgen"]
    cli["minescript-cli<br/>clap · ariadne"]
    core --> wasm
    core --> cli
  end
  subgraph Engine["packages/engine"]
    pkg["pkg/*.wasm + JS kötés"]
    types["src/generated<br/>(ts-rs típusok)"]
    api["createEngine()"]
  end
  wasm -- "just wasm" --> pkg
  core -- "just types" --> types
  pkg --> api
  types --> api
  subgraph Web["apps/web (böngésző)"]
    editor["CodeMirror 6<br/>analyze · complete · hover"]
    player["Lejátszó<br/>derive.ts + Zustand"]
    grid["MapGrid"]
  end
  subgraph Server["apps/server (Bun)"]
    hono["Hono API"]
    db[("MySQL<br/>Drizzle + mysql2")]
    rerun["runs: újrafuttatás"]
  end
  api --> editor
  api --> player
  api --> rerun
  editor -- "hc&lt;AppType&gt;" --> hono
  hono --> db
  rerun --> db
```

## A motor három helye

| Hely                            | Mire használjuk                                                                                                        | Belépési pont                            |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Böngésző (WASM)                 | élő diagnosztika, kiegészítés, súgó, formázás, a futás teljes trace-e a lejátszáshoz, térkép-validálás a szerkesztőben | `apps/web/src/engine/EngineProvider.tsx` |
| Szerver (ugyanaz a WASM Bunban) | a beküldött program újrafuttatása a ranglistához, térkép-validálás mentéskor, seed                                     | `apps/server/src/engine.ts`              |
| Natív CLI                       | fejlesztés és tesztelés terminálból (`check`, `fmt`, `lint`, `run`, `ast`, `map-check`)                                | `crates/minescript-cli`                  |

A `minescript-core` tiszta: nincs IO, nincs véletlen, nincs wasm-bindgen, és semmilyen bemenetre nem pánikol.

## Adatfolyamok

1. **Szerkesztés → analyze.** Minden billentyűleütés után (250 ms késleltetéssel) a CodeMirror linter meghívja az `engine.analyze(src)`-t. A diagnosztikák `from`/`to` UTF-16 offsetjei közvetlenül a CodeMirror-pozíciók (D18). A kiegészítés (`engine.complete`) és a súgó (`engine.hover`) ugyanígy a motorból jön.
2. **Futtatás → trace → lejátszás.** A „Futtatás” gomb az `engine.run(src, mapText)`-et hívja. Szintaktikai hibánál a felület a hibás sorokat jelöli, és nem indul lejátszás (D16). Egyébként a `RunResult.events` a lejátszó store-ba kerül; a `derive.ts` tiszta függvény az aktuális indexből számolja a robot helyzetét, a felfedezett mezőket, a konzolt és a változókat. A visszaléptetés és a tekerés így ingyenes.
3. **Beküldés → szerveroldali újrafuttatás.** Amikor a lejátszás a végére ér, a kliens csak a forrást és a térképverzió azonosítóját küldi (`POST /api/runs`). A szerver a saját WASM-motorjával újrafuttatja, és az ő eredménye kerül a ranglistára (D13). A leállított lejátszás nem kerül beküldésre.

## Mappák

| Mappa                         | Tartalom                                                                                            | Gazda                         |
| ----------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------- |
| `crates/minescript-core`      | a nyelv: forrás-normalizálás, span, diagnosztikák, szintaxis, formázó, linter, IDE, térkép, futtató | rust                          |
| `crates/minescript-wasm`      | wasm-bindgen exportok, JSON-kompatibilis szerializálás                                              | rust                          |
| `crates/minescript-cli`       | `minescript` parancssori eszköz                                                                     | rust                          |
| `packages/engine`             | `@minescript/engine`: típusos TS-burok a WASM köré, generált típusok                                | rust (kötés), web (használat) |
| `apps/server`                 | `@minescript/server`: Hono API, Drizzle ORM + mysql2 (MySQL), auth, seed, statikus kiszolgálás      | web                           |
| `apps/web`                    | `@minescript/web`: Vite + React SPA                                                                 | web                           |
| `conformance`                 | nyelvfüggetlen elvárt viselkedés (runtime, syntax, maps)                                            | testing                       |
| `tools/reference-interpreter` | független TS-interpreter a differenciális teszteléshez                                              | testing                       |
| `e2e`                         | Playwright + axe                                                                                    | testing                       |
| `scripts`                     | cross-platform Bun-scriptek a `justfile` mögött                                                     | web                           |
| `docs`                        | dokumentáció (csak a listázott fájlok kerülnek fel)                                                 | közös                         |

## Adattár: MySQL

A szerver közvetlenül egy MySQL-szerverhez kapcsolódik (MySQL 8.0 vagy újabb; fejlesztve és tesztelve 9.7-tel). Helyi adatbázisfájl nincs.

- **Kapcsolat**: `DATABASE_URL` környezeti változó vagy `--database-url` kapcsoló (a kapcsoló az erősebb). Alapértelmezés: `mysql://minescript:minescript@127.0.0.1:3306/minescript`, ez fejlesztői fiók, nem titok. Minta: `.env.example`.
- **Indulás**: `src/db/url.ts` értelmezi az URL-t, `src/db/client.ts` létrehozza az adatbázist, ha hiányzik és van rá jog (`CREATE DATABASE IF NOT EXISTS … CHARACTER SET utf8mb4`), majd poolt nyit és ellenőrzi a kapcsolatot. Utána migráció, végül seed.
- **Hibák**: az elérhetetlen szerver, az elutasított belépés és a hiányzó adatbázis magyar üzenetet és teendőt ad (`src/db/errors.ts`): MySQL indítása Homebrew-val vagy `docker compose up -d mysql`-lel, a `DATABASE_URL` beállítása, `just db-setup`.
- **Kódolás**: `utf8mb4` karakterkészlet és `utf8mb4_0900_ai_ci` kolláció. Ez a MySQL 8+ alapértelmezése: teljes Unicode, kis- és nagybetű-, illetve ékezetfüggetlen összehasonlítás. A `users.username` oszlop kifejezetten ezt a kollációt kapja, így az egyediség adatbázisszinten is betűméret-független.
- **Séma**: `src/db/schema.ts` (`mysqlTable`): `int` automatikus kulcsok, ezredmásodperces időbélyegek `bigint`-ként, `varchar` a validációs korlátokkal egyező hosszal, `mediumtext` a programforrásoknak, `text` a térképeknek, `char(64)` a SHA-256 hasheknek, `enum` a szerepkörre, láthatóságra és kimenetre.
- **Migráció**: `drizzle-kit` generálja (`breakpoints: false`, így az SQL komment nélküli). A migrátor dedikált, több utasítást engedő kapcsolaton, `GET_LOCK` alatt futtatja az új fájlokat, és a `__migrations` táblába írja őket. A MySQL a DDL-t azonnal véglegesíti: hibás migráció nem kerül nyilvántartásba, és a hibaüzenet jelzi, hogy részben lefuthatott.
- **Tranzakciók**: új térkép és első verziója, illetve új verzió és az aktuális mutató egy tranzakcióban; az új verzió sorszámát a térkép sorának zárolása (`SELECT … FOR UPDATE`) védi a párhuzamos mentéstől.
- **Életciklus**: egy pool (10 kapcsolat); `SIGINT`/`SIGTERM` esetén a szerver leáll, a pool bezárul.
- **Teszt és e2e**: minden tesztkörnyezet saját `minescript_test_<véletlen>` adatbázist kap a `TEST_DATABASE_URL` szerverén (alapból `mysql://root@127.0.0.1:3306`), és `await using` szabadítja fel. A `--test-mode` friss `minescript_e2e_<pid>_<idő>` adatbázist hoz létre, és leálláskor törli.
- **Fejlesztői MySQL**: `docker-compose.yml` (`mysql:9.7`, utf8mb4, healthcheck, névvel ellátott kötet, csak a `127.0.0.1:3306`-on), `just db-up` / `just db-down`; helyi szerverhez `just db-setup` hozza létre az adatbázist és a fiókot.

## Build és release

- `just wasm`: `cargo build -p minescript-wasm --target wasm32-unknown-unknown --release`, majd `wasm-bindgen --target web` a `packages/engine/pkg`-be, végül `wasm-opt -Os`, ha elérhető.
- `just types`: az ignorált `export_bindings` teszt a ts-rs-sel egy ideiglenes könyvtárba exportál, a `scripts/gen-types.ts` eltávolítja a ts-rs fejléc-kommentjét, átmásolja a `packages/engine/src/generated`-be, barrel `index.ts`-t ír, és Biome-mal formáz.
- `just build`: wasm, `vite build`, majd a `scripts/gen-static-manifest.ts` a `apps/web/dist` minden fájlját `with { type: "file" }` importtal egy `static-manifest.gen.js`-be gyűjti, a `scripts/gen-migrations.ts` pedig a Drizzle SQL-migrációkat `with { type: "text" }` importtal a `migrations.gen.ts`-be.
- `just release`: `bun build --compile --minify` három célra (`bun-windows-x64`, `bun-linux-x64`, `bun-darwin-arm64`). A bináris tartalmazza a SPA-t, a `.wasm`-ot, a migrációkat és a `mysql2` meghajtót; induláskor a `DATABASE_URL` szerinti MySQL-hez kapcsolódik, szükség esetén létrehozza az adatbázist, migrál, és üres adatbázist feltölt a demó-adatokkal.
- `just smoke`: az aktuális platform binárisát egy ideiglenes `minescript_smoke_*` MySQL-adatbázissal (a `TEST_DATABASE_URL` szerverén) elindítja, ellenőrzi a health, a HTML, a `.wasm` MIME-típus, az SPA-fallback, a demó-belépés és a `SIGTERM`-re történő leállás működését, végül törli az adatbázist.

## Éles üzem

A verseny szerveren (`https://csapat13.dusza.cloudsyso.com`) a `just release` szerinti Linux-bináris fut systemd alatt, a helyi MySQL-lel. Előtte egy Apache fordított proxy áll, jelszavas kapuval, a TLS-t a szervezői proxy zárja le. A frissítés `just deploy`: a szerver lefordítja a main-t, atomi cserével élesít, health checket futtat, és hiba esetén visszaáll az előző kiadásra. Részletek: `docs/telepites.md`, eszközök: `scripts/deploy/`.

## Generált fájlok és a .gitignore

| Fájl                                     | Commitolva?             | Indok                                                                                                                                                                                                    |
| ---------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/engine/src/generated/*`        | igen                    | A szerződés a Rustban él; a web és a szerver típusellenőrzése Rust-fordítás nélkül is működjön. A CI ellenőrzi, hogy naprakész (`just types` után `git diff --exit-code`).                               |
| `apps/server/src/db/migrations.gen.ts`   | igen                    | Determinisztikusan a commitolt `drizzle/*.sql`-ből készül, csak `db:generate` után változik; friss klónon is típushelyes a szerver.                                                                      |
| `apps/server/src/static-manifest.gen.js` | nem                     | A hashelt buildfájlneveket tartalmazza, minden buildnél más. A szerver csak prod módban, dinamikus importtal tölti be; a típusa a commitolt `static-manifest.gen.d.ts`.                                  |
| `apps/web/src/routeTree.gen.ts`          | nem                     | A TanStack Router generátora mindig fix fejléc-kommentet ír bele, ami ütközik a nulla-komment szabállyal. A Vite-plugin fejlesztéskor és buildkor, a `tsr generate` pedig a typecheck előtt állítja elő. |
| `packages/engine/pkg/`                   | nem                     | Buildtermék (`just wasm`).                                                                                                                                                                               |
| `Cargo.lock`, `bun.lock`                 | igen                    | Reprodukálható build; a `wasm-bindgen-cli` verzióját is a `Cargo.lock` határozza meg.                                                                                                                    |
| `docs/*`                                 | csak a listázott fájlok | A `docs/` többi része gépi (AI-memória, promptok), ezért alapból kizárt; a projekt-dokumentumokat egyenként engedjük vissza.                                                                             |
| `.env`, `release/`, `target/`, `dist/`   | nem                     | Helyi beállítás (a minta a commitolt `.env.example`), futási és buildtermékek.                                                                                                                           |

## Biztonság

- Session: 32 bájt véletlen token cookie-ban (`ms_session`, HttpOnly, SameSite=Lax, HTTPS-en Secure, 30 nap); az adatbázisban csak a SHA-256 hash.
- Jelszó: `Bun.password` argon2id.
- CSRF: minden nem-GET kérésnél az `Origin` fejlécnek egyeznie kell a kérés hostjával.
- Bejelentkezési korlát: 5 kísérlet / perc / (IP + felhasználónév), memóriában.
- CSP: `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'`. A `'unsafe-inline'` a stílusokhoz kell, mert a CodeMirror futásidőben injektál stílust.
- Privát térkép és a ranglistája csak a tulajdonosnak és az adminnak látszik (máshoz 404).
- Adatbázis: minden lekérdezés paraméterezett (Drizzle, `?` helyőrzők). Az egyetlen beillesztett azonosító az adatbázisnév, amelyet a `^[A-Za-z0-9_]{1,64}$` minta validál, és backtick közé kerül. A pool nem enged több utasítást egy lekérdezésben, csak a migrátor saját kapcsolata.
- A kapcsolati adatok környezeti változóból vagy kapcsolóból jönnek; a konzolra és a hibaüzenetekbe a jelszó nem kerül ki (`felhasználó@gép:port/adatbázis`).

## Verziók és eltérések

A függőségek `cargo add`/`bun add` segítségével, a legfrissebb stabil verzióval kerültek be (2026. november 6.):

| Eszköz                | Verzió                        |
| --------------------- | ----------------------------- |
| Rust                  | 1.99.1 (stable, edition 2024) |
| Bun                   | 1.3.14                        |
| TypeScript            | 7.0                           |
| Biome                 | 2.6                           |
| ts-rs                 | 12.0                          |
| wasm-bindgen          | 0.2.130                       |
| Vite                  | 8.3                           |
| React                 | 19.3                          |
| TanStack Router       | 1.170                         |
| React Aria Components | 1.22                          |
| Fontsource            | 5.3                           |
| Hono                  | 4.13                          |
| Drizzle ORM           | 0.45                          |
| mysql2                | 3.24                          |
| MySQL                 | 8.0+ (tesztelve: 9.7)         |
| zod                   | 4.6                           |
| Vitest                | 5.1                           |
| Playwright            | 1.65                          |

Eltérések a kiinduló tervtől:

- **ts-rs export**: a típusok `#[ts(export)]` nélkül deriválják a `TS`-t, mert az automatikus export minden `cargo test`-nél kommentfejlécet írna a generált fájlokba. Helyette egy ignorált `export_bindings` teszt exportál, és a `scripts/gen-types.ts` tisztítja a kimenetet. A `TS_RS_LARGE_INT = "number"` beállítás miatt az `i64` is `number`.
- **TS-névütközés**: a Rust `Map` és `Symbol` típus TypeScriptben `MineMap` és `SymbolInfo` néven jelenik meg, hogy ne takarja el a beépített `Map`/`Symbol` globálist.
- **Clippy**: az új `assert_is_empty` lintet (Rust 1.99) kikapcsoltuk, mert csak a tesztek olvasható `assert!(x.is_empty())` formáját bántja.
- **Biome a11y**: a csoport minden szabálya be van kapcsolva, kivéve a `noNoninteractiveElementToInteractiveRole`-t: a térképrács a WAI-ARIA APG „data grid” mintáját követi (`<table role="grid">`), amit ez a szabály tévesen tilt.
- **Leaderboard `?version=`**: a paraméter a térképverzió azonosítója (`map_versions.id`), nem a sorszáma.
- **e2e**: a `just e2e` függ a `just build`-től, mert a teszt a buildelt webet a szerver prod módjával szolgálja ki.
- **MySQL-meghajtó**: a Drizzle 0.45 `bun-sql` adaptere csak PostgreSQL-t kezel (`PgDatabase`), MySQL-hez nincs Bun-natív Drizzle-adapter. Ezért a `drizzle-orm/mysql2` és a `mysql2` került be: kiforrott, poolt és tranzakciót ad, tisztán JavaScript, így a `bun build --compile` a binárisba csomagolja.
- **`.returning()`**: MySQL-ben nincs `RETURNING`, ezért a beszúrás `$returningId()`-t használ, és utána olvas; a módosítások után újraolvasás következik.
- **Bejelentkezés**: a `username` oszlop kollációja miatt a belépésnél is kis- és nagybetűtől független a név, összhangban az egyediséggel.
- **Web-stílus**: Tailwind és CSS-modulok helyett komponensenkénti sima CSS-fájl, előtagos kebab-case osztálynevekkel (`play-gauge`, `board-cell`). A CSS-modulok osztálytípusa a `noUncheckedIndexedAccess` miatt `string | undefined`, ami a React Aria `className` propjával az `exactOptionalPropertyTypes` mellett nem fér össze. A design tokenek egy helyen vannak: `apps/web/src/styles/tokens.css`.
- **Pixel art**: a csempék, a robot, az ikonok és a logó ASCII-rácsként szerepelnek a forrásban (`apps/web/src/pixel`), és futásidőben `shape-rendering="crispEdges"` SVG-útvonalakká fordulnak; a térkép `<use>` hivatkozásokkal egyetlen közös sprite-lapot használ. Canvas nincs.
- **Fejlesztői API-cél**: a Vite proxy célja a `MINESCRIPT_API_URL` környezeti változóval felülírható (alapból `http://127.0.0.1:8080`).
