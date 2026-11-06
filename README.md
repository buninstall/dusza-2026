# MineScript

Webes játék a Dusza Árpád Országos Programozói Emlékverseny 2026/27 I. fordulójára. Egy elhagyott bányában a kincskereső robotot egy saját programnyelven, MineScriptben írt program vezérli: a játékos megírja a programot, a robot végrehajtja, a felület lassítva mutatja a mozgását, a felfedezett területet és a kibányászott aranyat, a ranglista pedig térképenként rangsorolja a játékosokat. Saját térképek is készíthetők.

A feladatleírás: [docs/feladat.md](docs/feladat.md).

## Gyorsindítás a kész programmal

1. Töltsd le a platformodnak megfelelő binárist (`minescript-windows-x64.exe`, `minescript-linux-x64` vagy `minescript-macos-arm64`).
2. Indítsd el. A böngésző magától megnyílik a `http://127.0.0.1:8080` címen.
3. Lépj be egy demó-fiókkal:

| Felhasználó               | Jelszó      | Szerep         |
| ------------------------- | ----------- | -------------- |
| `admin`                   | `dusza2026` | adminisztrátor |
| `demo1`, `demo2`, `demo3` | `demo2026`  | játékos        |

A program offline működik. Első indításkor a bináris mellé létrehozza a `minescript.db` adatbázist 8 oktató térképpel. Kapcsolók: `--port`, `--host`, `--db`, `--no-open`, `--reset-demo`.

## Fejlesztői gyorsindítás

```bash
just setup
```

```bash
just dev
```

A web a `http://localhost:5173` címen fut, az API a `8080`-as porton. A `crates/` változásakor a WASM-motor és a típusok automatikusan újraépülnek.

## Előfeltételek

| Eszköz        | Telepítés                                                                                           |
| ------------- | --------------------------------------------------------------------------------------------------- |
| Rust (rustup) | <https://rustup.rs> (Windows: `winget install Rustlang.Rustup`)                                     |
| Bun           | <https://bun.sh> (Windows: `powershell -c "irm bun.sh/install.ps1 \| iex"`)                         |
| just          | <https://just.systems> (`cargo install just`, `brew install just` vagy `winget install Casey.Just`) |

A `just setup` a többit maga telepíti: a `wasm32-unknown-unknown` célt, a `Cargo.lock` szerinti `wasm-bindgen-cli`-t, a JS-függőségeket; `--with-wasm-opt` kapcsolóval a `wasm-opt`-ot, `--with-e2e` kapcsolóval a Playwright chromiumot.

## Parancsok

| Parancs            | Leírás                                               |
| ------------------ | ---------------------------------------------------- |
| `just setup`       | fejlesztőkörnyezet előkészítése                      |
| `just dev`         | szerver + Vite + motor-újraépítés                    |
| `just test`        | minden unit- és integrációs teszt                    |
| `just conformance` | a nyelv conformance-esetei Rustban és WASM-on        |
| `just lint`        | rustfmt, clippy, Biome, TypeScript                   |
| `just fmt`         | automatikus formázás                                 |
| `just build`       | web build, statikus manifest, migrációk              |
| `just e2e`         | Playwright végponttól végpontig tesztek (chromium)   |
| `just release`     | Windows, Linux és macOS bináris a `release/` mappába |
| `just smoke`       | a saját platform binárisának füstpróbája             |
| `just ci`          | lint, test, build, e2e                               |
| `just clean`       | buildtermékek törlése                                |

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
