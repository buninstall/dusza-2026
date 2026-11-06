# Dusza-2026 — csapat szabályok

Ez a fájl minden gépen betöltődik. A gépi szerepkör a git login alapján dől el (lásd 4. pont).

## 1. Nulla komment

A repóban SEHOL nincs komment. Nincs kivétel.

- Nem írunk kommentet: kód, konfig, `.gitignore`, shell, YAML, SQL, Markdown HTML-komment, docstring, `TODO`/`FIXME`, inline magyarázat.
- Ha egy fájlt szerkesztesz, a régi kommenteket is töröld belőle.
- Commit előtt: `git diff --cached` ne tartalmazzon komment-jellegű sort.
- Ha egy nyelv működéshez megköveteli (pl. shebang `#!`), az nem komment, az marad.
- A commit üzenet és a PR leírás nem komment; a magyarázat oda való.

## 2. Git

- Main-re soha nem commitolunk és nem pusholunk közvetlenül.
- Mindenki a saját branchén dolgozik: `claude.teamflowBranch` (GitHub login).
- A commit és a push automatikus (team-sync hook). Conventional commit formátum: `<type>: <leírás>`, attribúció nélkül.
- Force push tilos.

## 3. Konfliktusmentes munkamegosztás

A konfliktus oka mindig az, hogy két ember ugyanazt a fájlt szerkeszti. Ezért a fájlok tulajdonosa egy ember.

- Mindenki csak a saját szerepének útvonalait szerkeszti (lásd `.claude/roles/`).
- Más területen hiba van? Nem javítod, hanem jelzed a csapatnak, és a terület gazdájának szólsz.
- Közös fájlok: `CLAUDE.md`, `AGENTS.md`, `.gitignore`, gyökér konfigurációk, csomagmanifesztek és lockfile-ok. Ezeket csak a csapat által kijelölt `shared` gazda módosítja, külön commitban, és szólnia kell a többieknek.
- Lockfile-t kézzel nem szerkesztünk. Az a terület gazdájának eszköze generálja.
- Kis, gyakori commitok. Ne halmozz fel nagy, több területet érintő változást.

## 4. Szerepkör gépenként

- A szerepfájlok: `.claude/roles/rust.md`, `.claude/roles/web.md`, `.claude/roles/testing.md`. Mindenki csak a sajátját szerkeszti.
- A kiosztás: `.claude/roles/ASSIGNMENTS.txt`, sorok formában: `<github-login>: <szerep>`.
- Szerepkeresés munkamenet elején:
  1. Olvasd ki: `git config --get claude.teamflowBranch` (ez a GitHub login).
  2. Keresd meg a sort az `ASSIGNMENTS.txt`-ben.
  3. Töltsd be a `.claude/roles/<szerep>.md` fájlt, és azt a szerepet kövesd.
  4. Ha nincs találat vagy üres a beállítás: állj meg, és kérdezd meg a felhasználót, mi a szerepe.
- A kiosztást csak a `shared` gazda módosítja.

## 5. Ami nem kerül fel

A `.gitignore` kizárja a gépi adatokat: memória, session-előzmények, lokális beállítások, a `docs/` mappa és minden `*.local.*` fájl. A felkerülő Claude-tartalom csak ez: `CLAUDE.md`, `AGENTS.md`, `.claude/agents/`, `.claude/skills/`, `.claude/commands/`, `.claude/rules/`, `.claude/roles/`, `.claude/hooks/`, `.claude/settings.json`.

A `docs/` mappából kivételesen a projekt-dokumentumok felkerülnek: `feladat.md`, `feladat.pdf`, `architektura.md`, `dontesek.md`, `contracts.md`, `roadmap.md`, `tesztterv.md`, `a11y.md`, `beadando.md`, `megfeleles.md` (a kiírás mondatonkénti megfelelőségi táblázata), `telepites.md` (éles telepítés a verseny szerverre, frissítés, kapu), és a `receptek/` mappa (kész programok minden pályára a kézi teszteléshez). Minden más a `docs/`-ban (AI-memória, promptok) lokális marad.

## 6. Projekt röviden

MineScript: webes játék, amelyben egy saját nyelven (MineScript) írt program vezérli a kincskereső robotot egy bányatérképen (Dusza Árpád Emlékverseny 2026/27, I. forduló, web). A feladat: `docs/feladat.md`. Egyetlen Rust-motor fut a böngészőben (WASM), a Bun-szerveren (ugyanaz a WASM) és CLI-ként. A futás tiszta függvény (`run(source, mapText) -> RunResult`, teljes trace); a felület a trace-t játssza le. A kész termék egyetlen offline bináris (`just release`).

## 7. Parancsok

| Parancs            | Mit csinál                                                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `just setup`       | eszközök (wasm32 target, a lockfájl szerinti wasm-bindgen-cli), `bun install`, wasm, típusok; `--with-e2e`, `--with-wasm-opt` |
| `just db-up`       | MySQL Dockerben (`docker compose`); `just db-down` leállítja                                                                  |
| `just db-setup`    | fejlesztői adatbázis és fiók egy helyi MySQL-szerveren (`--admin-url`, `--check`)                                             |
| `just dev`         | szerver (8080, MySQL: `DATABASE_URL`) + Vite (5173), a `crates/` változására wasm- és típus-újraépítés                        |
| `just wasm`        | a WASM-motor fordítása a `packages/engine/pkg`-be                                                                             |
| `just types`       | ts-rs típusok újragenerálása a `packages/engine/src/generated`-be                                                             |
| `just test`        | `cargo test --workspace` és minden workspace `test` scriptje                                                                  |
| `just conformance` | conformance-esetek Rustban és WASM-on                                                                                         |
| `just lint`        | rustfmt, clippy `-D warnings`, Biome, typecheck                                                                               |
| `just fmt`         | rustfmt és Biome javítás                                                                                                      |
| `just build`       | wasm, web build, statikus manifest, migrációk                                                                                 |
| `just e2e`         | build, majd Playwright (chromium) egy ideiglenes MySQL-adatbázissal                                                           |
| `just release`     | három bináris a `release/`-be                                                                                                 |
| `just smoke`       | a saját platform binárisának füstpróbája egy ideiglenes MySQL-adatbázissal                                                    |
| `just ci`          | lint, test, build, e2e                                                                                                        |
| `just deploy`      | éles frissítés a verseny szerveren SSH-n át (`--ref <ág>`, `--force`), lásd `docs/telepites.md`                               |
| `just remote …`    | `minescriptctl` parancs a szerveren: `status`, `rollback`, `logs`, `gate on/off`, `backup`, `autodeploy on/off`               |

## 8. Hol mi van

| Útvonal                                           | Tartalom                                                                                     |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `crates/minescript-core`                          | a nyelv: normalizálás, span, diagnosztikák, szintaxis, formázó, linter, IDE, térkép, futtató |
| `crates/minescript-wasm`, `crates/minescript-cli` | WASM-kötés, `minescript` CLI                                                                 |
| `packages/engine`                                 | `@minescript/engine`: TS-burok és generált típusok                                           |
| `apps/server`                                     | Hono API, Drizzle ORM + mysql2 (MySQL), auth, seed, statikus kiszolgálás                     |
| `apps/web`                                        | React SPA: szerkesztő, térkép, lejátszó, ranglista                                           |
| `conformance/`                                    | elvárt viselkedés (runtime, syntax, maps)                                                    |
| `tools/reference-interpreter`, `e2e/`             | referencia-interpreter, Playwright + axe                                                     |
| `scripts/`                                        | a `justfile` mögötti cross-platform Bun-scriptek                                             |
| `docs/`                                           | architektúra, döntések, szerződések, roadmap, tesztterv, a11y, beadandó                      |

## 9. Kötelező szabályok

- Nulla komment (1. pont) a kódban, a konfigurációban és a generált, commitolt fájlokban is.
- Verziószámot fejből nem írunk: Rust-függőség `cargo add`, JS-függőség `bun add`. Inkompatibilitás esetén a működő kombináció kerül be, és a `docs/architektura.md` „Verziók és eltérések” részébe.
- A nyelv viselkedését a `docs/dontesek.md` (D1–D18) rögzíti; új döntés csak a csapat egyetértésével, új azonosítóval.
- A szerződés a Rustban él: határon átmenő típus változása után `just types`, és a generált fájlok ugyanabban a commitban.
- A core-ban nincs `unwrap`/`expect`/`panic` (tesztek kivételével), és semmilyen bemenetre nem pánikol.
- Minden felhasználói szöveg magyar; a webes szövegek az `apps/web/src/i18n/hu.ts`-ben.
- A11y: React Aria komponensek, nincs natív `div onClick`, látható fókusz, minden állapot nem csak színnel jelölve; a `docs/a11y.md` ellenőrzőlistája kötelező.
- Nincs CDN, nincs Google Fonts: minden asset a binárisba ágyazva.
- Push előtt: `just ci` (legalább `just lint` és `just test`).

## 10. Szerepek

| GitHub login  | Szerep                   | Terület                                                                                                               |
| ------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `futozs`      | web                      | `apps/web`, `apps/server`, `scripts/`, `justfile`, CI, release                                                        |
| `gergogyulai` | rust, web (rust binding) | `crates/`, a Rust-oldali eszközök, és a webből csak a Rust-kötés: `packages/engine` (a conformance-teszt kivételével) |
| `hgagadev`    | testing                  | `conformance/`, `tools/reference-interpreter`, `e2e/`, `docs/tesztterv.md`, `docs/beadando.md`, demó-tartalom         |

Ha az `ASSIGNMENTS.txt` sorában több szerep áll vesszővel elválasztva, mindegyik szerepfájlt töltsd be. A zárójeles rész a hatókört szűkíti: `web (rust binding)` azt jelenti, hogy a web szerepből csak a Rust-kötés (`packages/engine`) tartozik ide, a `apps/web` és a `apps/server` nem.
