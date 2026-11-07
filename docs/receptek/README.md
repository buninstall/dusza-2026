# Receptek – kész programok a kézi teszteléshez

Ebben a mappában minden oktató pályához van egy hibátlanul lefutó MineScript-program, és a hibakezelés kipróbálásához egy-egy hibát kiváltó program is. Így a játék programozás nélkül, vizuálisan végigpróbálható. Minden eredményt automata teszt ellenőriz (`apps/server/test/recipes.test.ts`); ha egy recept vagy egy pálya megváltozik, a teszt jelez.

A sok játékos és sok pálya kezelésének (homokozó-lapozás, keresés, kedvencek, programtár, kvóta) kézi tesztreceptje: [SKALAZAS.md](SKALAZAS.md).

## Hogyan használd

1. Indítsd el az alkalmazást (`just dev`, vagy a kész binárist), és lépj be: `demo1` / `demo2026`.
2. A leggyorsabb út a **Kézikönyv** oldal: a tartalomjegyzék alján egy csendes **Receptek** bejárat (kőzetsáv aranyröggel) vezet a `/manual/receptek` oldalra. Ott minden recept mellett **Megnyitás** gomb van: a megfelelő pályát nyitja meg, a programmal a szerkesztőben. A programok, a pályák és a hibás térképek ugyanott le is tölthetők.
3. Kézzel is mehet: nyisd meg a pályát a **Pályák** oldalon (**Játék**), és töltsd be a receptet a két mód egyikével:
   - **Programtár**: minden demó-fiók programtárában megvan az összes recept („Recept – …” és „Hibapróba – …” néven);
   - **Fájl** menü, **Importálás fájlból…**: válaszd ki a megfelelő `.ms` fájlt ebből a mappából.
4. **Futtatás** (Ctrl+Enter), majd figyeld a robotot. A sebesség a vezérlőpulton állítható, a futás bármikor leállítható.

A demó-adatok bármikor visszaállíthatók: `--reset-demo` (például `bun run --filter @minescript/server dev -- --reset-demo`).

## Hibátlan receptek – Történet

A Történet harminc pályája hat fejezetben, ötösével nyílik. A lépésszám a lehető legkevesebb: a recepteket pontos útvonalkereső állította elő (minden parancssor egy lépés), és mindegyik az összes elérhető aranyat kibányássza; ez a pálya célértéke, a harmadik rög. A „vakon” receptek falkövető programok, a térkép ismerete nélkül jutnak célba. Minden pálya csapdáját és trükkjét a [Recept-kézikönyv](KEZIKONYV.md) magyarázza el, a történettel együtt.

| Pálya                  | Program                                                            | Térképfájl                                                           | Arany   | Lépés | Mit érdemes figyelni                                                                      |
| ---------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------- | ------- | ----- | ----------------------------------------------------------------------------------------- |
| 1. Egyenes folyosó     | [01-egyenes-folyoso.ms](01-egyenes-folyoso.ms)                     | [palyak/01-egyenes-folyoso.txt](palyak/01-egyenes-folyoso.txt)       | 2 / 2   | 4     | többmezős lépés, bányászás                                                                |
| 1. Egyenes folyosó     | [01-egyenes-folyoso-ciklussal.ms](01-egyenes-folyoso-ciklussal.ms) | ugyanaz                                                              | 2 / 2   | 56    | a feladatkiírás példaprogramja: `while`, `if`/`else`, `isThere`, `print` (a konzolon `2`) |
| 2. Az első kanyar      | [02-az-elso-kanyar.ms](02-az-elso-kanyar.ms)                       | [palyak/02-az-elso-kanyar.txt](palyak/02-az-elso-kanyar.txt)         | 2 / 2   | 5     | fordulás jobbra (`turn by 3`)                                                             |
| 3. Kis labirintus      | [03-kis-labirintus.ms](03-kis-labirintus.ms)                       | [palyak/03-kis-labirintus.txt](palyak/03-kis-labirintus.txt)         | 3 / 3   | 24    | kanyargós járatok, visszafordulás                                                         |
| 4. Zsákutcák           | [04-zsakutcak.ms](04-zsakutcak.ms)                                 | [palyak/04-zsakutcak.txt](palyak/04-zsakutcak.txt)                   | 5 / 5   | 31    | zsákutcák ki-be járása                                                                    |
| 5. Kígyó               | [05-kigyo.ms](05-kigyo.ms)                                         | [palyak/05-kigyo.txt](palyak/05-kigyo.txt)                           | 3 / 3   | 12    | hosszú egyenesek                                                                          |
| 6. Elérhetetlen kincs  | [06-elerhetetlen-kincs.ms](06-elerhetetlen-kincs.ms)               | [palyak/06-elerhetetlen-kincs.txt](palyak/06-elerhetetlen-kincs.txt) | 2 / 3   | 6     | a harmadik arany falakkal körülzárt, nem érhető el                                        |
| 7. Aranymező           | [07-aranymezo.ms](07-aranymezo.ms)                                 | [palyak/07-aranymezo.txt](palyak/07-aranymezo.txt)                   | 12 / 12 | 29    | sok bányászás nyílt terepen                                                               |
| 8. A nagy bánya        | [08-a-nagy-banya.ms](08-a-nagy-banya.ms)                           | [palyak/08-a-nagy-banya.txt](palyak/08-a-nagy-banya.txt)             | 9 / 9   | 84    | 15×15-ös térkép, köd, hosszú futás                                                        |
| 9. Kerülőút            | [09-kerulout.ms](09-kerulout.ms)                                   | [palyak/09-kerulout.txt](palyak/09-kerulout.txt)                     | 3 / 3   | 12    | hosszú egyenesek a pálya szélén                                                           |
| 10. Oszlopcsarnok      | [10-oszlopcsarnok.ms](10-oszlopcsarnok.ms)                         | [palyak/10-oszlopcsarnok.txt](palyak/10-oszlopcsarnok.txt)           | 13 / 13 | 42    | egy vonalba eső rögök egymás után                                                         |
| 11. Geoda              | [11-geoda.ms](11-geoda.ms)                                         | [palyak/11-geoda.txt](palyak/11-geoda.txt)                           | 3 / 3   | 9     | nem a szomszéd rög az első                                                                |
| 12. Kristálytükör      | [12-kristalytukor.ms](12-kristalytukor.ms)                         | [palyak/12-kristalytukor.txt](palyak/12-kristalytukor.txt)           | 3 / 3   | 11    | a kezdőirány félrevezet                                                                   |
| 13. Lila erek          | [13-lila-erek.ms](13-lila-erek.ms)                                 | [palyak/13-lila-erek.txt](palyak/13-lila-erek.txt)                   | 5 / 5   | 28    | kerülő a lépcső helyett                                                                   |
| 13. Lila erek          | [13-lila-erek-vakon.ms](13-lila-erek-vakon.ms)                     | ugyanaz                                                              | 5 / 5   | 198   | jobbkéz-szabály, a térkép ismerete nélkül                                                 |
| 14. Kilenc kristály    | [14-kilenc-kristaly.ms](14-kilenc-kristaly.ms)                     | [palyak/14-kilenc-kristaly.txt](palyak/14-kilenc-kristaly.txt)       | 9 / 9   | 26    | kanyar a rögön                                                                            |
| 15. Ametisztkatedrális | [15-ametisztkatedralis.ms](15-ametisztkatedralis.ms)               | [palyak/15-ametisztkatedralis.txt](palyak/15-ametisztkatedralis.txt) | 11 / 11 | 42    | holtág a végére                                                                           |
| 16. Rozsdás sínek      | [16-rozsdas-sinek.ms](16-rozsdas-sinek.ms)                         | [palyak/16-rozsdas-sinek.txt](palyak/16-rozsdas-sinek.txt)           | 3 / 3   | 9     | a közeli rög az utolsó                                                                    |
| 17. Iránytű            | [17-iranytu.ms](17-iranytu.ms)                                     | [palyak/17-iranytu.txt](palyak/17-iranytu.txt)                       | 5 / 5   | 28    | az ágak sorrendje                                                                         |
| 17. Iránytű            | [17-iranytu-vakon.ms](17-iranytu-vakon.ms)                         | ugyanaz                                                              | 5 / 5   | 496   | jobbkéz-szabály, Lámpafényben                                                             |
| 18. Vasércfejtés       | [18-vasercfejtes.ms](18-vasercfejtes.ms)                           | [palyak/18-vasercfejtes.txt](palyak/18-vasercfejtes.txt)             | 10 / 10 | 29    | kígyózás, kanyar a rögön                                                                  |
| 19. A vörös labirintus | [19-a-voros-labirintus.ms](19-a-voros-labirintus.ms)               | [palyak/19-a-voros-labirintus.txt](palyak/19-a-voros-labirintus.txt) | 10 / 10 | 74    | körök az útvesztőben                                                                      |
| 20. Kapuk              | [20-kapuk.ms](20-kapuk.ms)                                         | [palyak/20-kapuk.txt](palyak/20-kapuk.txt)                           | 11 / 11 | 50    | kevés kapuátkelés                                                                         |
| 21. Mohafény           | [21-mohafeny.ms](21-mohafeny.ms)                                   | [palyak/21-mohafeny.txt](palyak/21-mohafeny.txt)                     | 3 / 3   | 12    | a legmélyebb ág a végére                                                                  |
| 22. Szigetek           | [22-szigetek.ms](22-szigetek.ms)                                   | [palyak/22-szigetek.txt](palyak/22-szigetek.txt)                     | 8 / 8   | 29    | megkerülés vagy átkelés                                                                   |
| 23. Tükörtó            | [23-tukorto.ms](23-tukorto.ms)                                     | [palyak/23-tukorto.txt](palyak/23-tukorto.txt)                       | 8 / 8   | 36    | egy átjáró, két part                                                                      |
| 24. Smaragdkígyó       | [24-smaragdkigyo.ms](24-smaragdkigyo.ms)                           | [palyak/24-smaragdkigyo.txt](palyak/24-smaragdkigyo.txt)             | 12 / 12 | 42    | kígyójárat, két átjáró                                                                    |
| 24. Smaragdkígyó       | [24-smaragdkigyo-vakon.ms](24-smaragdkigyo-vakon.ms)               | ugyanaz                                                              | 12 / 12 | 804   | jobbkéz-szabály, sötétben                                                                 |
| 25. A tó szeme         | [25-a-to-szeme.ms](25-a-to-szeme.ms)                               | [palyak/25-a-to-szeme.txt](palyak/25-a-to-szeme.txt)                 | 12 / 13 | 59    | elérhetetlen rög a tó közepén                                                             |
| 26. Hamuréteg          | [26-hamureteg.ms](26-hamureteg.ms)                                 | [palyak/26-hamureteg.txt](palyak/26-hamureteg.txt)                   | 3 / 3   | 12    | útba ejtett közeli rög                                                                    |
| 27. Lávafolyó          | [27-lavafolyo.ms](27-lavafolyo.ms)                                 | [palyak/27-lavafolyo.txt](palyak/27-lavafolyo.txt)                   | 8 / 8   | 33    | kevés hídátkelés                                                                          |
| 28. Obszidiánkapu      | [28-obszidiankapu.ms](28-obszidiankapu.ms)                         | [palyak/28-obszidiankapu.txt](palyak/28-obszidiankapu.txt)           | 12 / 12 | 50    | körök fekete üvegben                                                                      |
| 29. Izzó tárnák        | [29-izzo-tarnak.ms](29-izzo-tarnak.ms)                             | [palyak/29-izzo-tarnak.txt](palyak/29-izzo-tarnak.txt)               | 13 / 13 | 65    | tárnánként, egy közös aknával                                                             |
| 30. A Szív             | [30-a-sziv.ms](30-a-sziv.ms)                                       | [palyak/30-a-sziv.txt](palyak/30-a-sziv.txt)                         | 13 / 13 | 55    | gyűrűk és rések                                                                           |

A futás végén az eredmény a ranglistára kerül (a szerver újraszámolja). A leállított futás nem kerül fel.

## Homokozó bemutatók

A Homokozó (a Pályák oldal alapértelmezett módja) hét bemutató pályája együtt a MineScript minden elemét lefedi. A pályákat a `demo2` és `demo3` seed-felhasználó „készítette”. Ezek a receptek a nyelvet mutatják be, nem a legrövidebb utat.

| Pálya            | Szerző | Program                                                            | Térképfájl                                                           | Arany | Lépés | Mit mutat                                |
| ---------------- | ------ | ------------------------------------------------------------------ | -------------------------------------------------------------------- | ----- | ----- | ---------------------------------------- |
| Lépés és csákány | demo2  | [homokozo/01-lepes-es-csakany.ms](homokozo/01-lepes-es-csakany.ms) | [homokozo/01-lepes-es-csakany.txt](homokozo/01-lepes-es-csakany.txt) | 2 / 2 | 4     | step forward, mine here                  |
| Négy irány       | demo3  | [homokozo/02-negy-irany.ms](homokozo/02-negy-irany.ms)             | [homokozo/02-negy-irany.txt](homokozo/02-negy-irany.txt)             | 4 / 4 | 13    | turn by 1, 2 és 3                        |
| Tapogatózás      | demo2  | [homokozo/03-tapogatozas.ms](homokozo/03-tapogatozas.ms)           | [homokozo/03-tapogatozas.txt](homokozo/03-tapogatozas.txt)           | 1 / 1 | 11    | isThere 0/1/2, if/else, print            |
| Menj a falig     | demo3  | [homokozo/04-menj-a-falig.ms](homokozo/04-menj-a-falig.ms)         | [homokozo/04-menj-a-falig.txt](homokozo/04-menj-a-falig.txt)         | 3 / 3 | 71    | while, not, számláló                     |
| Számlálás        | demo2  | [homokozo/05-szamlalas.ms](homokozo/05-szamlalas.ms)               | [homokozo/05-szamlalas.txt](homokozo/05-szamlalas.txt)               | 4 / 4 | 34    | + - *, < <= > >=                         |
| Logikai kapuk    | demo3  | [homokozo/06-logikai-kapuk.ms](homokozo/06-logikai-kapuk.ms)       | [homokozo/06-logikai-kapuk.txt](homokozo/06-logikai-kapuk.txt)       | 3 / 3 | 93    | and, or, not, = és <>, true/false        |
| Jobb kéz a falon | demo2  | [homokozo/07-jobb-kez-a-falon.ms](homokozo/07-jobb-kez-a-falon.ms) | [homokozo/07-jobb-kez-a-falon.txt](homokozo/07-jobb-kez-a-falon.txt) | 3 / 3 | 444   | egymásba ágyazott while, jobbkéz-szabály |

## Hibapróbák

Mindegyik az **1. Egyenes folyosó** pályán futtatandó. A felületnek a hibakódot és a hibás sort kell mutatnia.

| Program                                                                                | Várt hiba                          | Sor        | Lépés | Mit mutat                                                                                             |
| -------------------------------------------------------------------------------------- | ---------------------------------- | ---------- | ----- | ----------------------------------------------------------------------------------------------------- |
| [hibak/e-bedrock-hit.ms](hibak/e-bedrock-hit.ms)                                       | `E_BEDROCK_HIT`                    | 1          | 1     | a robot a térkép szélén megáll                                                                        |
| [hibak/e-no-gold.ms](hibak/e-no-gold.ms)                                               | `E_NO_GOLD`                        | 1          | 1     | bányászás arany nélkül                                                                                |
| [hibak/e-type-mismatch.ms](hibak/e-type-mismatch.ms)                                   | `E_TYPE_MISMATCH`                  | 2          | 2     | a változó típusa rögzül                                                                               |
| [hibak/e-uninitialized.ms](hibak/e-uninitialized.ms)                                   | `E_UNINITIALIZED`                  | 1          | 1     | értékadás nélküli változó                                                                             |
| [hibak/e-non-bool-condition.ms](hibak/e-non-bool-condition.ms)                         | `E_NON_BOOL_CONDITION`             | 2          | 2     | egész szám feltételként                                                                               |
| [hibak/e-bad-operand.ms](hibak/e-bad-operand.ms)                                       | `E_BAD_OPERAND`                    | 2          | 2     | logikai értékhez szám hozzáadása                                                                      |
| [hibak/e-bad-arg.ms](hibak/e-bad-arg.ms)                                               | `E_BAD_ARG`                        | 1          | 1     | `turn by true`                                                                                        |
| [hibak/e-int-overflow.ms](hibak/e-int-overflow.ms)                                     | `E_INT_OVERFLOW`                   | 3          | 7     | túl nagy egész szám                                                                                   |
| [hibak/instruction-count-limit-exceeded.ms](hibak/instruction-count-limit-exceeded.ms) | `INSTRUCTION_COUNT_LIMIT_EXCEEDED` | 1          | 1000  | végtelen ciklus: a robot pörög, majd az 1000. sor után leáll. Ezzel a leállítás gomb is kipróbálható. |
| [hibak/szintaktikai-hibak.ms](hibak/szintaktikai-hibak.ms)                             | szintaktikai hiba                  | 1, 2, 3, 4 | 0     | nem futtatható: dupla szóköz, ismeretlen utasítás, túl nagy szám, tabulátor                           |

## Hibás térképek

A **Térképszerkesztő** **Importálás** gombjával (vagy a fájl rácsra húzásával) próbáld betölteni őket: egyik sem töltődhet be, és mindegyikre érthető magyar hibaüzenetet kell kapnod.

| Fájl                                                                   | Várt hiba             |
| ---------------------------------------------------------------------- | --------------------- |
| [hibas-terkepek/ket-robot.txt](hibas-terkepek/ket-robot.txt)           | `MAP_MULTIPLE_ROBOTS` |
| [hibas-terkepek/nincs-robot.txt](hibas-terkepek/nincs-robot.txt)       | `MAP_NO_ROBOT`        |
| [hibas-terkepek/tul-nagy.txt](hibas-terkepek/tul-nagy.txt)             | `MAP_DIM_RANGE`       |
| [hibas-terkepek/hibas-fejlec.txt](hibas-terkepek/hibas-fejlec.txt)     | `MAP_HEADER`          |
| [hibas-terkepek/ismeretlen-jel.txt](hibas-terkepek/ismeretlen-jel.txt) | `MAP_BAD_SYMBOL`      |
| [hibas-terkepek/rovid-sor.txt](hibas-terkepek/rovid-sor.txt)           | `MAP_ROW_LENGTH`      |
| [hibas-terkepek/ures.txt](hibas-terkepek/ures.txt)                     | `MAP_EMPTY`           |

A `palyak/` mappa térképei ugyanígy importálhatók, és érvényesek.
