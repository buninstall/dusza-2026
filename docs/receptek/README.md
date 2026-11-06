# Receptek – kész programok a kézi teszteléshez

Ebben a mappában minden oktató pályához van egy hibátlanul lefutó MineScript-program, és a hibakezelés kipróbálásához egy-egy hibát kiváltó program is. Így a játék programozás nélkül, vizuálisan végigpróbálható. Minden eredményt automata teszt ellenőriz (`apps/server/test/recipes.test.ts`); ha egy recept vagy egy pálya megváltozik, a teszt jelez.

## Hogyan használd

1. Indítsd el az alkalmazást (`just dev`, vagy a kész binárist), és lépj be: `demo1` / `demo2026`.
2. Nyisd meg a pályát a **Térképek** oldalon (**Játék**).
3. Töltsd be a receptet a két mód egyikével:
   - **Programtár**: minden demó-fiók programtárában megvan az összes recept („Recept – …” és „Hibapróba – …” néven);
   - **Importálás**: válaszd ki a megfelelő `.ms` fájlt ebből a mappából.
4. **Futtatás**, majd figyeld a robotot. A sebesség csúszkával állítható, a futás bármikor leállítható.

A demó-adatok bármikor visszaállíthatók: `--reset-demo` (például `bun run --filter @minescript/server dev -- --reset-demo`).

## Hibátlan receptek

A lépésszám a lehető legkevesebb: a recepteket útvonaltervező állította elő (minden parancssor egy lépés), és mindegyik az összes elérhető aranyat kibányássza.

| Pálya                 | Program                                                            | Térképfájl                                                           | Arany   | Lépés | Mit érdemes figyelni                                                                      |
| --------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------- | ------- | ----- | ----------------------------------------------------------------------------------------- |
| 1. Egyenes folyosó    | [01-egyenes-folyoso.ms](01-egyenes-folyoso.ms)                     | [palyak/01-egyenes-folyoso.txt](palyak/01-egyenes-folyoso.txt)       | 2 / 2   | 4     | többmezős lépés, bányászás                                                                |
| 1. Egyenes folyosó    | [01-egyenes-folyoso-ciklussal.ms](01-egyenes-folyoso-ciklussal.ms) | ugyanaz                                                              | 2 / 2   | 56    | a feladatkiírás példaprogramja: `while`, `if`/`else`, `isThere`, `print` (a konzolon `2`) |
| 2. Az első kanyar     | [02-az-elso-kanyar.ms](02-az-elso-kanyar.ms)                       | [palyak/02-az-elso-kanyar.txt](palyak/02-az-elso-kanyar.txt)         | 2 / 2   | 5     | fordulás jobbra (`turn by 3`)                                                             |
| 3. Kis labirintus     | [03-kis-labirintus.ms](03-kis-labirintus.ms)                       | [palyak/03-kis-labirintus.txt](palyak/03-kis-labirintus.txt)         | 3 / 3   | 24    | kanyargós járatok, visszafordulás                                                         |
| 4. Zsákutcák          | [04-zsakutcak.ms](04-zsakutcak.ms)                                 | [palyak/04-zsakutcak.txt](palyak/04-zsakutcak.txt)                   | 5 / 5   | 31    | zsákutcák ki-be járása                                                                    |
| 5. Kígyó              | [05-kigyo.ms](05-kigyo.ms)                                         | [palyak/05-kigyo.txt](palyak/05-kigyo.txt)                           | 3 / 3   | 12    | hosszú egyenesek                                                                          |
| 6. Elérhetetlen kincs | [06-elerhetetlen-kincs.ms](06-elerhetetlen-kincs.ms)               | [palyak/06-elerhetetlen-kincs.txt](palyak/06-elerhetetlen-kincs.txt) | 2 / 3   | 6     | a harmadik arany falakkal körülzárt, nem érhető el                                        |
| 7. Aranymező          | [07-aranymezo.ms](07-aranymezo.ms)                                 | [palyak/07-aranymezo.txt](palyak/07-aranymezo.txt)                   | 12 / 12 | 29    | sok bányászás nyílt terepen                                                               |
| 8. A nagy bánya       | [08-a-nagy-banya.ms](08-a-nagy-banya.ms)                           | [palyak/08-a-nagy-banya.txt](palyak/08-a-nagy-banya.txt)             | 9 / 9   | 84    | 15×15-ös térkép, köd, hosszú futás                                                        |

A futás végén az eredmény a ranglistára kerül (a szerver újraszámolja). A leállított futás nem kerül fel.

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

A **Térképszerkesztő** **Térkép importálása** gombjával próbáld betölteni őket: egyik sem töltődhet be, és mindegyikre érthető magyar hibaüzenetet kell kapnod.

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
