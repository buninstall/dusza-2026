# MineScript – beadandó leírás

Dusza Árpád Országos Programozói Emlékverseny 2026/27, I. forduló (web).

## Indítás

A kész alkalmazás egyetlen futtatható fájl, amely egy MySQL-szerverben tárolja az adatokat; internetkapcsolat nem kell hozzá.

1. Indíts egy MySQL-szervert (8.0 vagy újabb) az alábbiak egyikével:
   - Docker: `docker compose up -d mysql` a repó gyökerében; a `minescript` adatbázist és fiókot is létrehozza.
   - Helyi telepítés: macOS-en `brew install mysql && brew services start mysql`, Windows-on a MySQL Installer. A fejlesztői fiókot a `just db-setup` hozza létre; csak a binárissal a root fiók is megadható, például `--database-url mysql://root@127.0.0.1:3306/minescript`, ilyenkor az adatbázist a program maga hozza létre.
2. Indítsd el a platformodnak megfelelő binárist (`minescript-windows-x64.exe`, `minescript-linux-x64` vagy `minescript-macos-arm64`).
3. A böngésző automatikusan megnyílik (`http://127.0.0.1:8080`, foglalt port esetén a következő szabad).
4. Lépj be egy demó-fiókkal:

| Felhasználó               | Jelszó      | Szerep         |
| ------------------------- | ----------- | -------------- |
| `admin`                   | `dusza2026` | adminisztrátor |
| `demo1`, `demo2`, `demo3` | `demo2026`  | játékos        |

A program alapból a `mysql://minescript:minescript@127.0.0.1:3306/minescript` címre kapcsolódik; más szerver a `DATABASE_URL` környezeti változóval vagy a `--database-url` kapcsolóval adható meg. Első indításkor létrehozza a táblákat, és feltölti az adatbázist 8 oktató térképpel és mintaprogramokkal. Ha a MySQL nem érhető el, vagy a belépési adatok hibásak, a program magyarul kiírja a teendőt. A demó-adatok a `--reset-demo` kapcsolóval állíthatók vissza.

## Melyik funkció hogyan érhető el

| Funkció                     | Hol                                | Hogyan                                                                                           |
| --------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| Bejelentkezés, regisztráció | `/login`, `/register`              | Szabad regisztráció; a funkciók csak belépés után érhetők el.                                    |
| Felhasználókezelés          | „Felhasználók” menüpont (admin)    | Szerepkör váltása, fiók törlése.                                                                 |
| Térképlista                 | „Térképek”                         | Összes / sajátjaim szűrő, méret, arany, verzió, készítő.                                         |
| Térképszerkesztő            | „Új térkép”, illetve „Szerkesztés” | Méret (1–15), festés eszközökkel (üres, arany, fal, robot), robot iránya, élő validálás, mentés. |
| Térkép import/export        | Szerkesztő                         | „Térkép importálása” (.txt), „Exportálás”.                                                       |
| Kódszerkesztő               | „Játék” oldal                      | Szintaxiskiemelés, élő hibajelzés, kiegészítés, súgó, Tab = 4 szóköz.                            |
| Program import/export       | „Játék” oldal                      | „Program importálása”, „Program exportálása” (.ms).                                              |
| Futtatás                    | „Futtatás” gomb                    | Szintaktikai hibánál a hibás sorok jelölve; egyébként lassított lejátszás.                       |
| Lejátszás                   | A térkép alatt                     | Indítás/szünet, lépés előre/vissza, elejére, leállítás, tekerés, sebesség.                       |
| Felfedezett mezők           | Térkép                             | „Csak a felfedezett mezők” kapcsoló.                                                             |
| Konzol, állapot             | A térkép alatt                     | print kimenet, arany, lépés, aktuális sor, pozíció, változók.                                    |
| Ranglista                   | „Ranglista” gomb                   | Felhasználónként a legjobb futás, verziónként.                                                   |

## Mi nem készült el vagy maradt ki

A hátralévő munka szerepenként: [`docs/roadmap.md`](roadmap.md). Beadás előtt itt sorold fel, ami végül kimaradt.

## Plusz szolgáltatások

- Egyetlen futtatható bináris beágyazott webbel és motorral; az adatokat MySQL-adatbázisban tárolja, a sémát és a demó-adatokat első indításkor maga hozza létre.
- Ugyanaz a Rust-motor fut a böngészőben, a szerveren és a parancssorban; a ranglista eredményét a szerver számolja újra.
- Visszaléptethető, tekerhető lejátszás, változó-panel.
- Térképverziók: a módosított térkép új verzió, a régi ranglista megmarad.
- Világos és sötét téma, teljes billentyűzetes kezelés, képernyőolvasó-támogatás.
- Parancssori eszköz (`minescript check|fmt|lint|run|ast|map-check`).

## Felmerült problémák és megoldásuk

| Probléma                                                                                           | Megoldás                                                                                                                                          |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| A spec több ponton nyitva hagyja a pontos viselkedést (lépésszámlálás, hibaelsőbbség, felfedezés). | Írásban rögzített értelmezési döntések ([`docs/dontesek.md`](dontesek.md)), és ezekre épülő, kézzel számolt conformance-esetek.                   |
| A kliens által beküldött eredmény hamisítható.                                                     | A szerver ugyanazzal a WASM-motorral újrafuttatja a programot.                                                                                    |
| Ugyanazt a nyelvi logikát három helyen kell futtatni.                                              | Rust-mag, WASM-kötés, a TypeScript-típusok a Rustból generálva.                                                                                   |
| Egyszerű telepítés internetkapcsolat nélkül.                                                       | `bun build --compile` beágyazott fájlokkal, betűtípusok csomagból, nincs CDN; a MySQL-hez helyi telepítés vagy `docker compose up -d mysql` elég. |

## Továbbfejlesztési javaslatok

- VS Code-bővítmény a core-ból, LSP-vel (diagnosztika, kiegészítés, formázás).
- Megosztható visszajátszás: a forrás és a térképverzió linkben, a trace a böngészőben újraszámolva.
- Pályagenerátor garantáltan elérhető arannyal és állítható nehézséggel.
- Golf-mód: ugyanannyi aranyat kevesebb sorból.
- Többszereplős verseny: azonos térkép, időkorlátos forduló, élő ranglista.

## Az értékelési szempontok leképezése

| Szempont                            | Hogyan teljesítjük                                                                                                                                                            |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hibátlan működés                    | Conformance-készlet a spec minden szabályára ([`docs/tesztterv.md`](tesztterv.md)), Rust unit- és tulajdonságtesztek, szerver-, web- és e2e-tesztek; a CI minden pushnál fut. |
| Áttekinthető, esztétikus megjelenés | Egységes, bányatérkép-jellegű vizuális rendszer tokenekkel, világos és sötét téma.                                                                                            |
| Akadálymentes használhatóság        | WCAG 2.2 AA ellenőrzőlista ([`docs/a11y.md`](a11y.md)), axe-teszt mindkét témában, billentyűzetes e2e-teszt.                                                                  |
| Jól olvasható, rendezett forráskód  | Monorepo szerepkörönként, beszédes nevek, szigorú TypeScript és Clippy, Biome, generált szerződés-típusok ([`docs/architektura.md`](architektura.md)).                        |
