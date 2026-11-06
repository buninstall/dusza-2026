<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/web/public/brand/minescript-dark.svg">
    <img src="apps/web/public/brand/minescript-light.svg" alt="MineScript" width="480" height="96">
  </picture>
</h1>

Webes játék a Dusza Árpád Országos Programozói Emlékverseny 2026/27 I. fordulójára. Egy elhagyott bányában a kincskereső robotot egy saját programnyelven, MineScriptben írt program vezérli: a játékos megírja a programot, a robot végrehajtja, a felület lassítva mutatja a mozgását, a felfedezett területet és a kibányászott aranyat, a ranglista pedig térképenként rangsorolja a játékosokat. Saját térképek is készíthetők.

A feladatleírás: [docs/feladat.md](docs/feladat.md).

## Gyorsindítás a kész programmal

1. Indíts egy MySQL-szervert (8.0 vagy újabb) az alábbiak egyikével:
   - Docker: `docker compose up -d mysql` a repó gyökerében; a `minescript` adatbázist és fiókot is létrehozza.
   - Helyi telepítés: macOS-en `brew install mysql && brew services start mysql`, Windows-on a MySQL Installer. A fejlesztői fiókot a `just db-setup` hozza létre; csak a binárissal a root fiók is megadható, például `--database-url mysql://root@127.0.0.1:3306/minescript`, ilyenkor az adatbázist a program maga hozza létre.
2. Töltsd le a platformodnak megfelelő binárist (`minescript-windows-x64.exe`, `minescript-linux-x64` vagy `minescript-macos-arm64`).
3. Indítsd el. A böngésző magától megnyílik a `http://127.0.0.1:8080` címen.
4. Lépj be egy demó-fiókkal:

| Felhasználó               | Jelszó      | Szerep         |
| ------------------------- | ----------- | -------------- |
| `admin`                   | `dusza2026` | adminisztrátor |
| `demo1`, `demo2`, `demo3` | `demo2026`  | játékos        |

A program internet nélkül működik, az adatokat a MySQL-ben tárolja. Alapból a `mysql://minescript:minescript@127.0.0.1:3306/minescript` címre kapcsolódik; más szerverhez a `DATABASE_URL` környezeti változót vagy a `--database-url` kapcsolót add meg (minta: `.env.example`). Első indításkor létrehozza a táblákat, és feltölti az adatbázist 8 oktató térképpel. Ha a MySQL nem érhető el, a program magyarul kiírja, mit kell tenni. Kapcsolók: `--port`, `--host`, `--database-url`, `--no-open`, `--reset-demo`.

## Fejlesztői gyorsindítás

```bash
just setup
```

```bash
just db-up
```

```bash
just dev
```

A `just db-up` Dockerben indítja a MySQL-t; helyi MySQL-szerver esetén helyette a `just db-setup` kell (alapból a jelszó nélküli helyi `root` fiókkal, más adminisztrátori fiókhoz: `just db-setup --admin-url mysql://root:jelszó@127.0.0.1:3306`). A web a `http://localhost:5173` címen fut, az API a `8080`-as porton. A `crates/` változásakor a WASM-motor és a típusok automatikusan újraépülnek.

A szerver tesztjei, az e2e és a smoke-teszt saját, ideiglenes adatbázisokat hoznak létre és törölnek a `TEST_DATABASE_URL` szerverén. Ennek alapértéke a jelszó nélküli helyi root (`mysql://root@127.0.0.1:3306`); a Docker-féle MySQL-hez a `.env.example` beállításai valók, a Bun a futtatás könyvtárából a `.env`-et magától betölti.

## Előfeltételek

| Eszköz        | Telepítés                                                                                           |
| ------------- | --------------------------------------------------------------------------------------------------- |
| Rust (rustup) | <https://rustup.rs> (Windows: `winget install Rustlang.Rustup`)                                     |
| Bun           | <https://bun.sh> (Windows: `powershell -c "irm bun.sh/install.ps1 \| iex"`)                         |
| just          | <https://just.systems> (`cargo install just`, `brew install just` vagy `winget install Casey.Just`) |
| MySQL 8.0+    | Docker (`docker compose up -d mysql`) vagy `brew install mysql`, Windows-on MySQL Installer         |

A `just setup` a többit maga telepíti: a `wasm32-unknown-unknown` célt, a `Cargo.lock` szerinti `wasm-bindgen-cli`-t, a JS-függőségeket; `--with-wasm-opt` kapcsolóval a `wasm-opt`-ot, `--with-e2e` kapcsolóval a Playwright chromiumot.

## Parancsok

| Parancs            | Leírás                                                           |
| ------------------ | ---------------------------------------------------------------- |
| `just setup`       | fejlesztőkörnyezet előkészítése, MySQL-ellenőrzés                |
| `just db-up`       | MySQL indítása Dockerben (`docker compose`)                      |
| `just db-down`     | a Docker-féle MySQL leállítása (az adatok megmaradnak)           |
| `just db-setup`    | fejlesztői adatbázis és fiók egy helyi MySQL-szerveren           |
| `just dev`         | szerver + Vite + motor-újraépítés                                |
| `just test`        | minden unit- és integrációs teszt                                |
| `just conformance` | a nyelv conformance-esetei Rustban és WASM-on                    |
| `just lint`        | rustfmt, clippy, Biome, TypeScript                               |
| `just fmt`         | automatikus formázás                                             |
| `just build`       | web build, statikus manifest, migrációk                          |
| `just e2e`         | Playwright végponttól végpontig tesztek (chromium)               |
| `just release`     | Windows, Linux és macOS bináris a `release/` mappába             |
| `just smoke`       | a saját platform binárisának füstpróbája ideiglenes adatbázissal |
| `just ci`          | lint, test, build, e2e                                           |
| `just clean`       | buildtermékek törlése                                            |

## Dokumentáció

| Dokumentum                                     | Tartalom                                   |
| ---------------------------------------------- | ------------------------------------------ |
| [docs/architektura.md](docs/architektura.md)   | rendszerábra, adatfolyamok, build, verziók |
| [docs/dontesek.md](docs/dontesek.md)           | értelmezési döntések (D1–D18)              |
| [docs/contracts.md](docs/contracts.md)         | WASM- és REST API, fixture-formátumok      |
| [docs/roadmap.md](docs/roadmap.md)             | hátralévő munka szerepenként               |
| [docs/tesztterv.md](docs/tesztterv.md)         | spec-mátrix és tesztlefedettség            |
| [docs/a11y.md](docs/a11y.md)                   | WCAG 2.2 AA ellenőrzőlista                 |
| [docs/beadando.md](docs/beadando.md)           | a beadandó leírás                          |
| [conformance/README.md](conformance/README.md) | a conformance-esetek formátuma             |

## Csapat

A szerepkiosztás és a munkaszabályok: [CLAUDE.md](CLAUDE.md) és [.claude/roles/](.claude/roles/).
