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

A program alapból a `mysql://minescript:minescript@127.0.0.1:3306/minescript` címre kapcsolódik; más szerver a `DATABASE_URL` környezeti változóval vagy a `--database-url` kapcsolóval adható meg. Ha a MySQL nem érhető el, vagy a belépési adatok hibásak, a program magyarul kiírja a teendőt.

Első indításkor létrehozza a táblákat, és kész játékkörnyezetet tölt fel:

- a négy demó-fiókot, mindegyik programtárában a pályák kész megoldásaival (receptek) és hibapróbákkal;
- a Történet mód 30 pályáját hat fejezetben, és a Homokozó 7 bemutató pályáját (demo2 és demo3 készítette);
- mintafutásokat, így a ranglisták sem üresek;
- egy népes homokozót: 100 kitalált játékost 300 pályával, kedvencekkel és futásokkal. Ez a `--no-crowd` kapcsolóval vagy a `MINESCRIPT_CROWD=0` változóval kihagyható.

A demó-adatok a `--reset-demo` kapcsolóval állíthatók vissza.

## Melyik funkció hogyan érhető el

| Funkció                     | Hol                                                | Hogyan                                                                                                                                                                                                                                                                      |
| --------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bejelentkezés, regisztráció | `/login`, `/register`                              | Szabad regisztráció; minden más funkció csak belépés után érhető el, a közvetlen cím a belépésre visz.                                                                                                                                                                      |
| Felhasználókezelés          | „Felhasználók” menüpont (admin)                    | Lapozott, kereshető fióklista; „Új felhasználó” létrehozása szerepkörrel, „Adminná tétel” és „Játékossá tétel”, fiók törlése megerősítéssel.                                                                                                                                |
| Pályák                      | „Pályák” menüpont (`/maps`)                        | „Homokozó”: mindenki pályái lapozva, kereséssel, „Összes” / „Sajátjaim” / „Kedvencek” füllel, nehézségi szűrővel és rendezéssel; „Történet”: a 30 pálya fejezetenként. Minden pályánál „Játék” és „Ranglista”.                                                              |
| Térképszerkesztő            | „Térképszerkesztő” menüpont, illetve „Szerkesztés” | Méret (1–15) a rács szélén, festőeszközök (üres kamra, arany, fal, robot), ecset, téglalap, kitöltés, robot iránya, visszavonás és újra, élő ellenőrzés, mentés, törlés.                                                                                                    |
| Térkép import/export        | Szerkesztő, „Fájl” menü                            | „Importálás” (.txt, vagy a fájl ráhúzása a rácsra), „Exportálás”. Hibás fájlnál érthető hibaüzenet a hibás sorokkal, a szerkesztő változatlan.                                                                                                                              |
| Kódszerkesztő               | „Játék” oldal, bal oldal                           | Szintaxiskiemelés, élő hibajelzés a sor végén, „Hibalista” javítás gombokkal, kiegészítés, parancsfiókok (Robot, Érzékelés, Változók, Döntés, Ciklus), formázás (Shift+Alt+F), Tab = 4 szóköz.                                                                              |
| Program import/export       | „Játék” oldal, „Fájl” menü                         | „Importálás fájlból…”, „Exportálás fájlba” (.ms). Szintaktikailag hibás vagy nem szöveges fájlnál hibaablak a fájl nevével és a hibás sorokkal, a szerkesztő változatlan; a hibás programfájl a „Megnyitás javításra” gombbal betölthető, a hibás sorok jelölve (D26, D27). |
| Programtár                  | „Játék” oldal, „Programtár” gomb                   | Mentett programok lapozva és kereséssel; mentés, mentés másként, megnyitás, törlés.                                                                                                                                                                                         |
| Futtatás                    | „Futtatás” gomb (Ctrl+Enter)                       | Szintaktikai hibánál a hibás sorok jelölve, a futás nem indul; egyébként a térkép és a robot alaphelyzetbe kerül, és lassított lejátszás indul.                                                                                                                             |
| Lejátszás                   | A bánya alatti vezérlőpult                         | Indítás/szünet, lépés előre/vissza, elejére, végére, leállítás, idővonal, sebesség (1–30 sor/s), töréspontok. Hosszú futásnál „Ugrás a végére”.                                                                                                                             |
| Felfedezett mezők           | „Lámpafény” / „Teljes térkép” a bánya fölött       | „Lámpafény”: csak a felfedezett mezők látszanak; „Teljes térkép”: a felderítetlen rész rácsmintával jelölve.                                                                                                                                                                |
| Konzol, állapot             | Műszersáv a bánya fölött, „Konzol” gomb            | Állapot, arany, lépés (feldolgozott sorok), aktuális sor, pozíció és irány; a „Konzol” a `print` kimenetét és a változókat mutatja.                                                                                                                                         |
| Hibák                       | A bánya alatti jelentés                            | Futásidejű hibánál a hibakód, a hibás sor és magyarázat, „Mutasd a … sort” gomb; a lépéskorlátnál `INSTRUCTION_COUNT_LIMIT_EXCEEDED`.                                                                                                                                       |
| Ranglista                   | „Ranglista” gomb a pályánál                        | Felhasználónként a legjobb futás, verziónként: több arany előrébb, egyenlőségnél a kevesebb lépés. A Történet módnak összesített ranglistája is van.                                                                                                                        |
| Futásnapló, visszajátszás   | „Futásaim” menüpont (`/runs`)                      | Lapozott napló minden befejezett futásról; „Visszajátszás” soronként, beküldés nélkül. A ranglistáról más futása is megnézhető, linkkel megosztható.                                                                                                                        |
| Kézikönyv, receptek         | Fejléc, könyv ikon                                 | A nyelv, a játék és a módok leírása játszható példákkal; a „Receptek” oldalon kész programok minden pályához.                                                                                                                                                               |

## Mi nem készült el vagy maradt ki

A kiírás minden kötelező funkciója elkészült: bejelentkezés és felhasználókezelés, térképszerkesztő importtal és exporttal, programszerkesztő importtal és exporttal, szintaktikai ellenőrzés a hibás sorok jelölésével, lassított futtatás az aktuális sorral, konzollal, a felfedezett mezőkkel, arany- és lépésszámlálóval, leállítással, minden futásidejű hibakód és a lépéskorlát, valamint a térképenkénti ranglista.

A kiírás néhány nyitva hagyott pontját írásban rögzített döntés szerint valósítottuk meg ([`docs/dontesek.md`](dontesek.md)). Ezek nem hiányok, hanem értelmezések, például:

- a felhasználó által leállított futás nem kerül a ranglistára, a befejezett futás (hiba nélkül, futásidejű hibával vagy a lépéskorlát miatt) igen (D13);
- a szintaktikailag hibás programfájl magától nem töltődik be; a hibaablak a fájl nevét és a hibás sorokat mutatja, és a „Megnyitás javításra” gombbal a szerkesztőbe tölthető. Szerkesztés közben a program lehet hibás, csak futtatás előtt kell helyessé válnia (D26, D27);
- a ranglistán felhasználónként a legjobb futás látszik, a módosított térkép új verziót és új ranglistát kap (D13, D14).

Az alábbi, tervezett plusz szolgáltatások maradtak ki:

- két futás egymás melletti összevetése és a fokozatos tipp-gomb (a ranglista, a visszajátszás és a receptek lefedik, ezért elvetettük);
- golf-tippek (rövidebb program ugyanannyi aranyra);
- VS Code-bővítmény és LSP-szerver a motorból.

## Plusz szolgáltatások

- Egyetlen futtatható bináris beágyazott webbel és motorral; az adatokat MySQL-adatbázisban tárolja, a sémát és a demó-adatokat első indításkor maga hozza létre. Ugyanez a felület asztali alkalmazásként (MineScript Desktop) is elérhető macOS-re, Windowsra és Linuxra.
- Ugyanaz a Rust-motor fut a böngészőben, a szerveren és a parancssorban; a ranglista eredményét a szerver számolja újra, a kliens számait nem fogadja el.
- Két játékmód: a Homokozóban bárki pályáján lehet játszani, a Történet mód 30 pályája hat fejezetben, ötösével nyílik.
- Lámpafény és Vaksötét bánya: a nehezebb pályákon csak a robot lámpája világít, a fény az arannyal erősödik, falnak ütközéskor a lámpa eltörik.
- Rögök pályánként (arany, minden arany, célérték alatt), eredménysor a futás végén a következő pályára vezető gombbal; napi kihívás saját ranglistával.
- Kedvencek, keresés, nehézségi szűrő és lapozás a pályák, a programtár, a futásnapló és a felhasználók listájában; több száz pályával és fiókkal is gyors.
- Visszaléptethető, tekerhető lejátszás, töréspontok, változó-panel, hosszú futásnál „Ugrás a végére”.
- Térképverziók: a módosított térkép új verzió, a régi ranglista megmarad.
- Pályagenerátor mindig megoldható pályával; a célértéket a beépített útvonaltervező számolja. Kipróbálás mentés nélkül, falkeret és kiürítés a szerkesztőben.
- Formázó, linter és egy kattintásos javítások a kódszerkesztőben; parancsfiókok a kezdőknek.
- Interaktív bevezető, kézikönyv játszható példákkal, receptek minden pályához.
- Teljes billentyűzetes kezelés, képernyőolvasó-támogatás, látható fókusz, csökkentett mozgás tisztelete.
- Megosztható visszajátszás a ranglistáról, a programmal együtt.
- Parancssori eszköz (`minescript check|fmt|lint|run|ast|map-check`).
- Szintetizált 8-bites hangeffektek némító gombbal.

## Felmerült problémák és megoldásuk

| Probléma                                                                                           | Megoldás                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A spec több ponton nyitva hagyja a pontos viselkedést (lépésszámlálás, hibaelsőbbség, felfedezés). | Írásban rögzített értelmezési döntések ([`docs/dontesek.md`](dontesek.md)), és ezekre épülő, kézzel számolt conformance-esetek.                                  |
| A motor hibája csendben rossz eredményt adhat.                                                     | Egy független referencia-interpreter minden conformance-esetet és véletlen programokat is lefuttat, és az eseménysort mezőről mezőre összeveti a Rust-motoréval. |
| A kliens által beküldött eredmény hamisítható.                                                     | A szerver ugyanazzal a WASM-motorral újrafuttatja a programot.                                                                                                   |
| Ugyanazt a nyelvi logikát három helyen kell futtatni.                                              | Rust-mag, WASM-kötés, a TypeScript-típusok a Rustból generálva.                                                                                                  |
| Kis kijelzőn (1366×768) a futás jelentése eltakarta a térképet.                                    | A jelentés a bánya alá került, a térkép mellette mindig teljes egészében látszik, nyitott konzolnál is.                                                          |
| Sok pálya és fiók mellett a listák lassultak.                                                      | Szerveroldali lapozás, keresés és indexek; a felület a következő oldalt előre betölti.                                                                           |
| Egyszerű telepítés internetkapcsolat nélkül.                                                       | `bun build --compile` beágyazott fájlokkal, betűtípusok csomagból, nincs CDN; a MySQL-hez helyi telepítés vagy `docker compose up -d mysql` elég.                |

## Továbbfejlesztési javaslatok

- VS Code-bővítmény a core-ból, LSP-vel (diagnosztika, kiegészítés, formázás).
- Heti bajnokság a napi kihívások összesített rögeiből.
- Golf-mód: ugyanannyi aranyat kevesebb sorból, külön ranglistával.
- Többszereplős verseny: azonos térkép, időkorlátos forduló, élő ranglista.
- Pályacsomagok: a Homokozó pályáiból összeállított, megosztható fejezetek.

## Az értékelési szempontok leképezése

| Szempont                            | Hogyan teljesítjük                                                                                                                                                                                              |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hibátlan működés                    | Conformance-készlet a spec minden szabályára ([`docs/tesztterv.md`](tesztterv.md)), független referencia-interpreter, Rust unit- és tulajdonságtesztek, szerver-, web- és e2e-tesztek; a CI minden pushnál fut. |
| Áttekinthető, esztétikus megjelenés | Egységes, pixel art bánya-vizuális rendszer tokenekkel, egyetlen sötét bányatémával; a felület 1366×768-tól a nagy kijelzőkig és mobilon is használható.                                                        |
| Akadálymentes használhatóság        | WCAG 2.2 AA ellenőrzőlista ([`docs/a11y.md`](a11y.md)), axe-teszt minden fő oldalon és állapotban, billentyűzetes e2e-teszt.                                                                                    |
| Jól olvasható, rendezett forráskód  | Monorepo szerepkörönként, beszédes nevek, szigorú TypeScript és Clippy, Biome, generált szerződés-típusok ([`docs/architektura.md`](architektura.md)).                                                          |

A csapat AI-használatának leírása: [ai.md](ai.md).
