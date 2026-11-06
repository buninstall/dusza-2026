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

| Funkció                     | Hol                                                | Hogyan                                                                                                                                                   |
| --------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bejelentkezés, regisztráció | `/login`, `/register`                              | Szabad regisztráció; a funkciók csak belépés után érhetők el.                                                                                            |
| Felhasználókezelés          | „Felhasználók” menüpont (admin)                    | Szerepkör váltása, fiók törlése.                                                                                                                         |
| Térképlista                 | „Pályák” menüpont (`/maps`)                        | „Összes” / „Sajátjaim” fül, „Rendezés”; méret, arany, verzió, készítő; „Játék”, „Ranglista”, „Szerkesztés”.                                              |
| Térképszerkesztő            | „Térképszerkesztő” menüpont, illetve „Szerkesztés” | Méret (1–15) a rács szélén, festőeszközök (üres kamra, arany, fal, robot), ecset, téglalap, kitöltés, robot iránya, visszavonás, élő ellenőrzés, mentés. |
| Térkép import/export        | Szerkesztő                                         | „Importálás” (.txt, vagy a fájl ráhúzása a rácsra), „Exportálás”.                                                                                        |
| Kódszerkesztő               | „Játék” oldal                                      | Szintaxiskiemelés, élő hibajelzés a sor végén, kiegészítés, parancsblokkok, tippek, Tab = 4 szóköz.                                                      |
| Program import/export       | „Játék” oldal, „Fájl” menü                         | „Importálás fájlból…”, „Exportálás fájlba” (.ms).                                                                                                        |
| Futtatás                    | „Futtatás” gomb (Ctrl+Enter)                       | Szintaktikai hibánál a hibás sorok jelölve; egyébként lassított lejátszás.                                                                               |
| Lejátszás                   | A bánya alatti vezérlőpult                         | Indítás/szünet, lépés előre/vissza, elejére, leállítás, idővonal, sebesség.                                                                              |
| Felfedezett mezők           | „Nézet” kapcsoló a bánya fölött                    | „Lámpafény”: csak a felfedezett mezők; „Teljes térkép”.                                                                                                  |
| Konzol, állapot             | „Műszerek” a bánya mellett, napló alatta           | Arany, lépés, aktuális sor, pozíció; „Konzol”, „Változók”, „Jelentés”.                                                                                   |
| Ranglista                   | „Ranglista” gomb                                   | Felhasználónként a legjobb futás, verziónként.                                                                                                           |
| Visszajátszás               | „Futásaim” menüpont (`/runs`)                      | „Visszajátszás” soronként: a rögzített futás újra lejátszódik, beküldés nélkül.                                                                          |
| Receptek                    | „Kézikönyv”, a tartalomjegyzék alján               | Kész programok minden pályához, hibapróbák és hibás térképek (`/manual/receptek`).                                                                       |

## Mi nem készült el vagy maradt ki

A kiírás minden kötelező funkciója elkészült: bejelentkezés és felhasználókezelés, térképszerkesztő importtal és exporttal, programszerkesztő importtal és exporttal, szintaktikai ellenőrzés a hibás sorok jelölésével, lassított futtatás az aktuális sorral, konzollal, a felfedezett mezőkkel, arany- és lépésszámlálóval, leállítással, minden futásidejű hibakód és a lépéskorlát, valamint a térképenkénti ranglista.

A kiírás néhány nyitva hagyott pontját írásban rögzített döntés szerint valósítottuk meg ([`docs/dontesek.md`](dontesek.md)). Ezek nem hiányok, hanem értelmezések, például:

- a felhasználó által leállított futás nem kerül a ranglistára, a befejezett futás (hiba nélkül, futásidejű hibával vagy a lépéskorlát miatt) igen (D13);
- a szintaktikailag hibás programfájl betölthető a szerkesztőbe, hogy javítani lehessen; a felület hibaüzenetben jelzi a hibák számát és az első hibás sort, futtatni pedig csak a hibátlan programot lehet (D23);
- a ranglistán felhasználónként a legjobb futás látszik, a módosított térkép új verziót és új ranglistát kap (D13, D14).

Az alábbi, tervezett plusz szolgáltatások maradtak ki:

- két futás egymás melletti összevetése és a fokozatos tipp-gomb (a ranglista, a visszajátszás és a receptek lefedik, ezért elvetettük);
- golf-tippek (rövidebb program ugyanannyi aranyra);
- VS Code-bővítmény és LSP-szerver a motorból.

## Plusz szolgáltatások

- Egyetlen futtatható bináris beágyazott webbel és motorral; az adatokat MySQL-adatbázisban tárolja, a sémát és a demó-adatokat első indításkor maga hozza létre.
- Ugyanaz a Rust-motor fut a böngészőben, a szerveren és a parancssorban; a ranglista eredményét a szerver számolja újra.
- Visszaléptethető, tekerhető lejátszás, változó-panel.
- Térképverziók: a módosított térkép új verzió, a régi ranglista megmarad.
- Világos és sötét téma, teljes billentyűzetes kezelés, képernyőolvasó-támogatás.
- Parancssori eszköz (`minescript check|fmt|lint|run|ast|map-check`).
- Csillagok pályánként (arany, minden arany, célérték alatt), haladás és összesítés a Pályák oldalon, eredménysáv a futás végén a következő pályára vezető gombbal.
- Napi kihívás: minden nap dátumból generált, mindenkinek azonos pálya saját ranglistával.
- Pályagenerátor mindig megoldható pályával; a célértéket a beépített útvonaltervező számolja.
- Interaktív bevezető, amely előbb rákérdez, és a választ böngészőnként megjegyzi.
- Töréspont a sorszámra kattintva vagy `F9`-cel, a robot nyomvonala a térképen.
- Próbajáték mentés nélkül, falkeret és kiürítés a térképszerkesztőben.
- Megosztható visszajátszás a ranglistáról, a programmal együtt; „Tetszik” jelölés és népszerűség szerinti rendezés.
- Szintetizált 8-bites hangeffektek némító gombbal.

## Felmerült problémák és megoldásuk

| Probléma                                                                                           | Megoldás                                                                                                                                          |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| A spec több ponton nyitva hagyja a pontos viselkedést (lépésszámlálás, hibaelsőbbség, felfedezés). | Írásban rögzített értelmezési döntések ([`docs/dontesek.md`](dontesek.md)), és ezekre épülő, kézzel számolt conformance-esetek.                   |
| A kliens által beküldött eredmény hamisítható.                                                     | A szerver ugyanazzal a WASM-motorral újrafuttatja a programot.                                                                                    |
| Ugyanazt a nyelvi logikát három helyen kell futtatni.                                              | Rust-mag, WASM-kötés, a TypeScript-típusok a Rustból generálva.                                                                                   |
| Egyszerű telepítés internetkapcsolat nélkül.                                                       | `bun build --compile` beágyazott fájlokkal, betűtípusok csomagból, nincs CDN; a MySQL-hez helyi telepítés vagy `docker compose up -d mysql` elég. |

## Továbbfejlesztési javaslatok

- VS Code-bővítmény a core-ból, LSP-vel (diagnosztika, kiegészítés, formázás).
- Kampány-térkép: a pályák feloldása csillagok alapján, fejezetekbe rendezve.
- Heti bajnokság a napi kihívások összesített csillagaiból.
- Golf-mód: ugyanannyi aranyat kevesebb sorból.
- Többszereplős verseny: azonos térkép, időkorlátos forduló, élő ranglista.

## Az értékelési szempontok leképezése

| Szempont                            | Hogyan teljesítjük                                                                                                                                                            |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hibátlan működés                    | Conformance-készlet a spec minden szabályára ([`docs/tesztterv.md`](tesztterv.md)), Rust unit- és tulajdonságtesztek, szerver-, web- és e2e-tesztek; a CI minden pushnál fut. |
| Áttekinthető, esztétikus megjelenés | Egységes, bányatérkép-jellegű vizuális rendszer tokenekkel, világos és sötét téma.                                                                                            |
| Akadálymentes használhatóság        | WCAG 2.2 AA ellenőrzőlista ([`docs/a11y.md`](a11y.md)), axe-teszt mindkét témában, billentyűzetes e2e-teszt.                                                                  |
| Jól olvasható, rendezett forráskód  | Monorepo szerepkörönként, beszédes nevek, szigorú TypeScript és Clippy, Biome, generált szerződés-típusok ([`docs/architektura.md`](architektura.md)).                        |
