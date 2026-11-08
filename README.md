<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/web/public/brand/minescript-dark.svg">
    <img src="apps/web/public/brand/minescript-light.svg" alt="MineScript" width="480" height="96">
  </picture>
</h1>

Webes játék a Dusza Árpád Országos Programozói Emlékverseny 2026/27 I. fordulójára. Egy elhagyott bányában a kincskereső robotot egy saját programnyelven, MineScriptben írt program vezérli: a játékos megírja a programot, a robot végrehajtja, a felület lassítva mutatja a mozgását, a felfedezett területet és a kibányászott aranyat, a ranglista pedig térképenként rangsorolja a játékosokat. Saját térképek is készíthetők.

Zsűrizett példány a versenyszerveren: <https://csapat13.dusza.cloudsyso.com>. A csapat saját szerverén is fut: <https://minescript.hu>.

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

A program internet nélkül működik, az adatokat a MySQL-ben tárolja. Alapból a `mysql://minescript:minescript@127.0.0.1:3306/minescript` címre kapcsolódik; más szerverhez a `DATABASE_URL` környezeti változót vagy a `--database-url` kapcsolót add meg (minta: `.env.example`). Első indításkor létrehozza a táblákat, és kész játékkörnyezetet tölt fel: a Történet mód 30 pályáját, a Homokozó bemutató pályáit, a demó-fiókokat receptekkel és mintafutásokkal, valamint egy népes homokozót (100 játékos, 300 pálya; a `--no-crowd` kapcsolóval kihagyható). Ha a MySQL nem érhető el, a program magyarul kiírja, mit kell tenni. Kapcsolók: `--port`, `--host`, `--database-url`, `--no-open`, `--no-crowd`, `--reset-demo`, `--trust-proxy` (fordított proxy mögött).

## Parancssori értelmező

A MineScript-motor önálló parancssori programként is letölthető a GitHub Releases oldaláról (`cli-v0.1.0` címke, `minescript-cli-<platform>` fájlok). Használat: `minescript run --map palya.txt program.ms`; a `minescript --help` a többi parancsot (`check`, `fmt`, `lint`, `ast`, `map-check`) is listázza.

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

A szerver tesztjei, az e2e és a smoke-teszt saját, ideiglenes adatbázisokat hoznak létre és törölnek a `TEST_DATABASE_URL` szerverén. Ennek alapértéke a jelszó nélküli helyi root (`mysql://root@127.0.0.1:3306`); a Docker-féle MySQL-hez a `.env.example` beállításai valók. A Bun csak a futtatás könyvtárában lévő `.env`-et tölti be, a `just test` viszont a szerver tesztjeit az `apps/server` mappából indítja, ezért ott a `TEST_DATABASE_URL`-t környezeti változóként kell megadni.

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
| `just ci`          | lint, test, build, e2e; push előtt helyben (GitHubon nem fut)    |
| `just clean`       | buildtermékek törlése                                            |

## Lámpafény-mód: sötét bánya a nehezebb pályákon

A bánya a kiírás szerint sötét, és a robot „tapogatózva halad előre”. A Lámpafény-mód ezt játékszabállyá teszi a nehezebb pályákon:

- **Sötét bánya:** a pálya mérete látszik, a labirintus nem. Csak az látszik, amit a robot felfedezett vagy a lámpája megvilágított.
- **Arany = fény:** minden kibányászott rög feltölti a robot akkumulátorát, és a lámpa fénykörének sugara eggyel nő, legfeljebb négyig.
- **Vázlat:** ami egyszer kiderült, a következő futás előtt is látszik, így a játék ritmusa felderítés, tervezés, jobb program.
- **Fal = sötétség:** ha a robot falnak megy, összetörik a lámpa, a vázlat elvész, és a játékos újra vaksötétben áll. Aki lépés előtt `isThere 1`-gyel tapogat, az soha nem veszíti el.
- **Kiérdemelt térkép:** három rög után feloldódik a Teljes térkép, és jöhet a lépésszám csiszolása a ranglistáért.

A Történet mód 30 pályájából 14 nyitott (1–4., 9., 11., 12., 14., 16., 18., 21., 22., 26., 27.), ott a játékos az utasításokat tanulja; 9 Lámpafény (5., 6., 10., 13., 17., 20., 23., 25., 28.), 7 Vaksötét (7., 8., 15., 19., 24., 29., 30.; a lámpa üres akkuval indul). Saját pályán a térképszerkesztőben választható a fokozat. A mód a nyelv viselkedését, a lépésszámlálást és a ranglista rendezését nem változtatja, a motorhoz nem nyúl. Az ötlet a felkészítő tanárunktól származik; a szabályok, a kiírással való összevetés és a megvalósítás állapota: [docs/jatekelmeny.md](docs/jatekelmeny.md).

## Fejlesztési ötletek és megvalósításuk

A kötelező funkciók után a többi versenymegoldás nyilvános felületét is átnéztük, és azt kerestük, mitől lesz a MineScript valódi játék, nem csak egy programfuttató. Az ötleteket hatás szerint rangsoroltuk, majd egy takarítási körben mindent kivettünk, ami csak helyet foglalt. Az alábbi táblázat mutatja, mi valósult meg, és hol érhető el.

| Ötlet                       | Állapot     | Hol érhető el, hogyan működik                                                                                                                                                                                                |
| --------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rögök pályánként (1–3)      | megvalósult | Aranyrög-ikonok: 1 rög, ha van arany; 2, ha minden elérhető arany megvan; 3, ha ez a célérték alatt sikerült. A célérték a receptekből, a generáltaknál az útvonaltervezőből jön; saját pályán a szerző adja meg.            |
| Haladás a Pályák oldalon    | megvalósult | Minden pályán a készítő, a nehézség (a gépi megoldás hossza alapján), a megszerzett rögök és a saját legjobb eredmény; a fejlécben az összesítés.                                                                            |
| Eredmény a futás végén      | megvalósult | A vezérlőpult alatt egy sor: a megszerzett rögök, az új rögök kiemelése, a következő rög feltétele és „Következő pálya” gomb.                                                                                                |
| Hangeffektek                | megvalósult | Szintetizált 8-bites hangok (lépés, fordulás, bányászás, hiba, befejezés, új rög), fájl nélkül; némító gomb a fejlécben, a böngésző megjegyzi.                                                                               |
| Interaktív bevezető         | megvalósult | Első belépéskor felugró ablak kérdez rá; igen válaszra hat lépésben végigvezet az első pályán, a választ böngészőnként megjegyzi. A Kézikönyvből újraindítható.                                                              |
| Töréspont                   | megvalósult | Kattintás a sorszámra vagy `F9`: a lejátszás a jelölt sor végrehajtása után megáll.                                                                                                                                          |
| Nagyítás a térképen         | megvalósult | A fejlécben nagyítás és kicsinyítés (100–400%), görgővel vagy érintőpados csippentéssel a kurzor körül; nagyítva a térkép egérrel húzható, a nézet követi a robotot.                                                         |
| Átméretezhető munkaterület  | megvalósult | A szerkesztő bal oldalt, a bánya jobb oldalt; a határuk húzható vagy nyilakkal állítható, dupla kattintásra visszaáll, a böngésző megjegyzi.                                                                                 |
| Tömör játéktér              | megvalósult | Vízszintes műszersáv, egysoros hibajelzés kóddal és sorral, a konzol és a változók csak kérésre nyílnak (a gombon a kiírt sorok száma).                                                                                      |
| Kipróbálás a szerkesztőből  | megvalósult | Mentett pályán a valódi játékoldal, mentetlen pályán próbajáték ranglista nélkül; a szerkesztő állapota megmarad.                                                                                                            |
| Falkeret, Mind üres         | megvalósult | A térképszerkesztő „Továbbiak” menüjében, visszavonhatók.                                                                                                                                                                    |
| Pályagenerátor              | megvalósult | „Továbbiak” → „Generálás…”: méret és nehézség, mindig megoldható pálya, a célértéket a gép saját megoldása adja.                                                                                                             |
| Megosztható visszajátszás   | megvalósult | A ranglista minden sorából megnézhető a futás a programmal együtt; a visszajátszás linkje másolható (privát pályán csak az érintettek látják).                                                                               |
| Napi kihívás                | megvalósult | Minden nap egy dátumból generált, mindenkinek azonos pálya saját ranglistával, a Pályák oldal tetején.                                                                                                                       |
| Kedvencek és népszerűség    | megvalósult | A pályakártyán szív gomb és a kedvencek száma; a Pályák oldalon „Kedvencek” fül és „Népszerű” rendezés. A külön tetszik-gombot kivettük, mert csak zsúfolta a felületet.                                                     |
| A robot nyomvonala          | kivettük    | A felfedezett mezők jelölése mellett fölösleges vizuális zaj volt.                                                                                                                                                           |
| Két futás összevetése       | elvetettük  | A ranglista, a saját futások és a visszajátszás együtt már megmutatja a különbséget.                                                                                                                                         |
| Fokozatos tipp-gomb         | elvetettük  | A receptek és a Kézikönyv próbapadjai ezt lefedik; egy félmegoldást adó gomb a verseny jellegét rontaná.                                                                                                                     |
| Lámpafény-mód               | megvalósult | Sötét bánya a Történet mód 16 pályáján (az 5. pályától), arannyal növő fénykör, falnál elvesző vázlat, három rög után Teljes térkép; a szerkesztőben választható. Lásd fent és a [docs/jatekelmeny.md](docs/jatekelmeny.md). |
| Golf-mód, VS Code-bővítmény | később      | Lásd a beadandó továbbfejlesztési javaslatait ([docs/beadando.md](docs/beadando.md)).                                                                                                                                        |

## Dokumentáció

| Dokumentum                                     | Tartalom                                            |
| ---------------------------------------------- | --------------------------------------------------- |
| [docs/architektura.md](docs/architektura.md)   | rendszerábra, adatfolyamok, build, verziók          |
| [docs/dontesek.md](docs/dontesek.md)           | értelmezési döntések (D1–D27)                       |
| [docs/contracts.md](docs/contracts.md)         | WASM- és REST API, fixture-formátumok               |
| [docs/roadmap.md](docs/roadmap.md)             | hátralévő munka szerepenként                        |
| [docs/tesztterv.md](docs/tesztterv.md)         | spec-mátrix és tesztlefedettség                     |
| [docs/megfeleles.md](docs/megfeleles.md)       | a kiírás mondatonkénti megfelelősége                |
| [docs/a11y.md](docs/a11y.md)                   | WCAG 2.2 AA ellenőrzőlista                          |
| [docs/beadando.md](docs/beadando.md)           | a beadandó leírás                                   |
| [docs/jatekelmeny.md](docs/jatekelmeny.md)     | a Lámpafény-mód terve                               |
| [docs/telepites.md](docs/telepites.md)         | éles telepítés a verseny szerveren                  |
| [docs/receptek/](docs/receptek/)               | kész programok minden pályához                      |
| [docs/ai.md](docs/ai.md)                       | az AI-használat leírása (a szerveren is: `~/ai.md`) |
| [conformance/README.md](conformance/README.md) | a conformance-esetek formátuma                      |

## Csapat

A szerepkiosztás és a munkaszabályok: [CLAUDE.md](CLAUDE.md) és [.claude/roles/](.claude/roles/). A fejlesztés AI-használatának leírása: [docs/ai.md](docs/ai.md).
