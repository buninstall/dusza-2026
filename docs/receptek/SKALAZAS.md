# Skálázás – kézi tesztrecept

Ez a recept azt mutatja meg lépésről lépésre, hogyan bírja a játék a sok játékost és a sok pályát: a homokozó lapozását, keresését és szűrőit, a kedvenceket, a lapozott programtárat és a lapozott futásnaplót. Minden lépés mellett ott az elvárt eredmény.

## Az előkészített tömeg

Induláskor a seed a homokozót egy valószerű közösséggel tölti fel (`apps/server/src/seed/crowd.ts`):

| Mi              | Mennyi                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------- |
| Bányász-fiók    | 100 (`vajar_anna` … `furo_jazmin`), véletlen jelszóval, ezért belépni nem lehet velük     |
| Generált pálya  | 300 (fiókonként 3), 5×5 és 15×15 közötti méret, könnyű, közepes és nehéz vegyesen         |
| Privát pálya    | minden 11. pálya (27 darab), ezeket csak a készítőjük és az admin látja                   |
| Kedvenc         | fiókonként 0–6, így a „Népszerű” rendezésnek van értelme                                  |
| Rögzített futás | pályánként 0–3 rivális futás (a teljes megoldás vagy annak eleje), így a ranglisták élnek |

A seed idempotens: ha a fiókok már megvannak, nem nyúl hozzájuk. Két egyszerre induló szerver sem akad össze, a már létező fiókot a második kihagyja. Kikapcsolás: `--no-crowd` kapcsoló vagy `MINESCRIPT_CROWD=0`; teszt módban (`--test-mode`, e2e) magától ki van kapcsolva. Teljes újratöltés: `--reset-demo`.

## 1. Homokozó: lapozás animációval

1. Lépj be `demo1` / `demo2026` fiókkal, nyisd meg a **Pályák** oldalt (Homokozó mód, Összes fül).
2. Görgess a bánya aljára.
   - Elvárt: a lista alatt a lapozó, mellette `1–8 / 280 pálya · Oldal: 1 / 35`. A szám a privát pályák nélkül értendő.
3. Kattints a **Következő** gombra.
   - Elvárt: az oldal simán felgördül a lista tetejére, az új nyolc pálya lépcsőzetesen úszik be, a címsorban `page=2` áll, a billentyűfókusz a listára kerül, a képernyőolvasó bemondja: „2. oldal, összesen 35 oldal és 280 pálya.”
   - Elvárt: nincs betöltőfüggöny, és a bánya-háttér csak az animáció után épül újra.
4. Kattints egy oldalszámra (például **35**), majd a böngésző **Vissza** gombjára.
   - Elvárt: az utolsó oldalon kevesebb pálya lehet; a Vissza a 2. oldalra visz.
5. Kapcsold be a rendszerben a csökkentett mozgást, és lapozz újra.
   - Elvárt: az oldal ugrik, nem gördül, és a csempék animáció nélkül jelennek meg.
6. Írd a címsorba: `/maps?page=999`.
   - Elvárt: a szerver az utolsó létező oldalt adja, a lapozó azt mutatja.

## 2. Keresés és szűrők

1. Írd a keresőbe: `jazmin`.
   - Elvárt: kb. negyed másodperc múlva szűr, az 1. oldalra ugrik; minden találat készítője `…_jazmin`. Gépelés közben a fókusz a mezőben marad.
2. Írd be: `Poros`.
   - Elvárt: csak „Poros …” című pályák (a keresés kis- és nagybetűtől, valamint ékezettől független, a címben, a készítőben és a leírásban keres).
3. Írd be: `%`.
   - Elvárt: „Nincs pálya erre: „%”.” A `%` és az `_` nem helyettesítő karakter. A **Keresés törlése** gomb visszaállítja a listát. Az Escape billentyű is töröl.
4. Válaszd a **Nehéz** szintet és a **Népszerű** rendezést.
   - Elvárt: csak nehéz pályák, a legtöbb kedvencet kapottak elöl. A beállítás a címsorban marad, újratöltés után is megvan.

## 3. Kedvencek

1. Az egyik csempén kattints a szív gombra (felirata: „Kedvenc: <cím>, N kedvenc”).
   - Elvárt: a szív azonnal kitöltődik, a szám eggyel nő, felugrik egy visszajelzés. Az állapot nem csak színnel látszik: a kitöltött és az üres szív alakja is más.
2. Nyisd meg a **Kedvencek** fület.
   - Elvárt: ott van a pálya. Ha minden kedvencet leveszel, a fül tippet ad: „Még nincs kedvenc pályád…”.
3. Állítsd le a szervert, és kattints egy szívre.
   - Elvárt: a szív visszaáll, és hibaüzenet jelenik meg; nem marad hamis állapot.
4. A napi kihívás nem tehető kedvencbe (a szerver `409 DAILY_FAVORITE`-tel válaszol).

## 4. Programtár

1. Nyiss meg egy pályát, majd **Programtár**.
   - Elvárt: nyolc program oldalanként, mindegyiknél a módosítás ideje és a sorok száma; alul `1–8 / N program · M / 500 program a tárban` és a lapozó.
2. Írd a keresőbe: `step`.
   - Elvárt: a címben és a programsorokban is keres; ha a cím is talál, az a program előrébb kerül.
3. Válaszd a **Cím szerint** rendezést, lapozz előre és vissza.
4. Kvóta: fiókonként legfeljebb 500 program. Az 501. mentés magyar hibaüzenetet ad (`409 PROGRAM_LIMIT`), és nem jön létre új sor.

## 5. Futásaim

1. Nyisd meg a **Futásaim** oldalt.
   - Elvárt: kilenc futás oldalanként, a legfrissebb elöl, számozott lapozóval. A lapozás a szerveren történik, ezért nincs többé „csak az utolsó 100 futás” korlát.

## 6. Ugyanez az API-n

A `POST`, `PUT` és `DELETE` kéréshez `Origin` fejléc kell (CSRF-védelem).

```bash
curl -s -c /tmp/ms.jar -H 'Origin: http://127.0.0.1:8080' -H 'Content-Type: application/json' -d '{"username":"demo1","password":"demo2026"}' http://127.0.0.1:8080/api/auth/login
```

```bash
curl -s -b /tmp/ms.jar 'http://127.0.0.1:8080/api/maps?world=sandbox&pageSize=8&page=2&sort=popular&level=hard&q=poros'
```

```bash
curl -s -b /tmp/ms.jar http://127.0.0.1:8080/api/maps/stats
```

```bash
curl -s -b /tmp/ms.jar -X PUT -H 'Origin: http://127.0.0.1:8080' http://127.0.0.1:8080/api/maps/40/favorite
```

```bash
curl -s -b /tmp/ms.jar 'http://127.0.0.1:8080/api/programs?q=step&sort=title&page=1&pageSize=8'
```

```bash
curl -s -b /tmp/ms.jar 'http://127.0.0.1:8080/api/me/runs?page=1&pageSize=9'
```

| Végpont                                 | Mit ad                                                                                                                       |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/maps`                         | `{ maps, page, pageSize, total, pageCount }`; paraméterek: `world`, `scope`, `q`, `sort`, `level`, `page`, `pageSize` (≤ 60) |
| `GET /api/maps/story`                   | a Történet pályái egyben (fix, legfeljebb 30)                                                                                |
| `GET /api/maps/stats`                   | a homokozó pályáinak és készítőinek száma                                                                                    |
| `POST /api/maps/match`                  | térképszövegekhez (≤ 64) a kanonikus tartalom alapján a pálya azonosítója; a Receptek oldal ezt használja                    |
| `PUT` / `DELETE /api/maps/:id/favorite` | kedvenc be és ki, idempotensen; válasz: `{ isFavorite, favoriteCount }`                                                      |
| `GET /api/programs`                     | `{ programs, …lapadatok, quota }`; paraméterek: `q`, `sort` (`recent`, `title`), `page`, `pageSize` (≤ 100)                  |
| `GET /api/me/runs`                      | `{ runs, …lapadatok }`; paraméterek: `page`, `pageSize` (≤ 100)                                                              |

Hibás paraméterre (például `page=0`, `pageSize=61`, `sort=nincs`) a válasz `400 VALIDATION`, magyar mezőhibával.

## 7. Mért számok

Feltöltött adatbázison (340 pálya, 104 fiók), helyi MySQL-lel, Apple Silicon gépen:

| Kérés                        | p50             | p95     | Méret   |
| ---------------------------- | --------------- | ------- | ------- |
| homokozó 1. oldal, legújabb  | 5,9 ms          | 10,1 ms | 4,8 KiB |
| homokozó 35. oldal, népszerű | 7,0 ms          | 9,6 ms  | 4,1 KiB |
| keresés + nehézség           | 5,7 ms          | 8,8 ms  | 5,1 KiB |
| programtár keresés           | 2,1 ms          | 8,7 ms  | 0,8 KiB |
| futásnapló 1. oldal          | 1,5 ms          | 3,7 ms  | 0,4 KiB |
| 200 párhuzamos lapkérés      | összesen 437 ms |         |         |

A korábbi lista minden pályát egyben küldött, és kérésenként minden pálya nehézségét útvonalkeresővel számolta. 340 pályánál ez kb. 200 KiB volt kérésenként, és a pályák számával egyenesen nőtt; a lapozott lista oldalanként állandó méretű.

## 8. Mitől skálázható

- **Lapozás az adatbázisban**: `LIMIT`/`OFFSET` indexelt rendezéssel (`maps_created_idx`, `maps_updated_idx`, `maps_favorite_idx`), a darabszám külön `COUNT` lekérdezés. Ha az oldalszám túl nagy, a szerver az utolsó oldalra igazítja.
- **A nehézség tárolva van** a térképverzión (`map_versions.difficulty`), a lista már nem futtat útvonalkeresőt; a régi sorokat induláskor egyszer pótolja.
- **A saját haladás csak az aktuális oldal pályáira** kerül lekérdezésre (`runs_user_version_idx`), nem a játékos teljes futástörténetére.
- **Kedvenc**: külön `map_favorites` tábla összetett elsődleges kulccsal, a számláló denormalizálva a `maps.favorite_count` mezőben, tranzakcióban, sorzárral frissítve.
- **Programtár**: `programs_owner_updated_idx`, a lista nem küldi a forrást, csak a címet, az időt és a sorok számát; fiókonként 500 programos kvóta.
- **Futásnapló**: `runs_user_created_idx`, szerveroldali lapozás.
- **Kliens**: az előző oldal a betöltés alatt is látszik (nincs villogás), a következő oldalt és az egérrel kijelölt oldalszámot előre betölti, a kereső késleltetve küld.

Automata tesztek: `apps/server/test/scale.test.ts` (szerver, 14 eset) és `apps/web/test/sandbox.test.tsx` (felület, 5 eset).
