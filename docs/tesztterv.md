# Tesztterv

A spec minden mondatához és szabályához, valamint minden D-döntéshez legalább egy automata teszt tartozik. A mátrix oszlopai: azonosító, spec-hely, szabály, a lefedő teszteset(ek), állapot.

## Jelölések és állapotok

- `rNNN` = `conformance/runtime/NNN-*`, `sNNN` = `conformance/syntax/NNN-*`, `mNNN` = `conformance/maps/NNN-*`.
- `ref:…` = a referencia-interpreter unit-tesztje (`tools/reference-interpreter/test`), `gen:…` = a generátor tesztje, `diff` = a differenciális teszt (minden conformance-eset és 2000-2000 generált helyes program, hibás program és térkép; a `DIFF_SEEDS` környezeti változóval növelhető, egyszeri próbán 30 000 seeden is eltérés nélkül).
- `core:…` Rust unit-teszt, `server:…` bun-teszt, `web:…` Vitest, `e2e:…` Playwright.
- `mut` = a mutációs ellenőrzés (`tools/reference-interpreter/test/mutation.test.ts`), `prop` = az invariáns- és metamorf tesztek (`properties.test.ts`, a `PROPERTY_SEEDS` változóval növelhető), `rob` = a robusztussági tesztek (`robustness.test.ts`).

Állapotok:

- **zöld (Rust, WASM, referencia)**: a kézzel levezetett elvárást a Rust-motor (`crates/minescript-core/tests/conformance.rs`), a WASM-build (`packages/engine/test/conformance.test.ts`) és a független referencia-interpreter is teljesíti, és a két interpreter eseménysora mezőről mezőre egyezik.
- **zöld**: nem conformance-teszt, és átmegy.

Összesen 301 conformance-eset: 116 runtime, 131 syntax, 54 maps. Minden `SYN_*` kód (a `SYN_NOT_IMPLEMENTED` kivételével), minden `MAP_*` kód és minden `RuntimeErrorCode` legalább egy esetben szerepel. A referencia-interpreter `src/` sorlefedettsége 100%.

## 1. A térkép és a program formátuma (spec 1)

| ID    | Spec | Szabály                                                                    | Teszteset(ek)                                                                                                                                                              | Állapot                       |
| ----- | ---- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| T1.1  | 1    | A spec példatérképe érvényes, 3 sor és 15 oszlop, a robot keletre néz      | m001, m010, r001, r023                                                                                                                                                     | zöld (Rust, WASM, referencia) |
| T1.2  | 1    | A spec példaprogramja: `isThere 2` eredménye az `arany` változóba, print   | r001                                                                                                                                                                       | zöld (Rust, WASM, referencia) |
| T1.3  | 1    | Fejléc: a két dimenzió egy szóközzel elválasztva                           | m008, m016–m026, m041                                                                                                                                                      | zöld (Rust, WASM, referencia) |
| T1.4  | 1    | Mindkét dimenzió legalább 1, legfeljebb 15                                 | m005, m006, m027–m029, m042, m043, `e2e:map-rules` (méretmezők)                                                                                                            | zöld (Rust, WASM, referencia) |
| T1.5  | 1    | `.` üres kamra, `@` arany, `#` fal; más jel hiba                           | m001, m042, m049, m007, m030, m039, m040                                                                                                                                   | zöld (Rust, WASM, referencia) |
| T1.6  | 1    | `>` kelet, `<` nyugat, `^` észak, `v` dél, a robot a jel helyén áll        | m044–m047, r088, r089, r004, `e2e:map-rules` (négy irány)                                                                                                                  | zöld (Rust, WASM, referencia) |
| T1.7  | 1    | A térképen pontosan egy robot van                                          | m002, m038, m003, m036, m037, `e2e:map-rules` (egy robot)                                                                                                                  | zöld (Rust, WASM, referencia) |
| T1.8  | 1    | A robot aranyrögöt nem tartalmazó kamrában áll                             | r109, m001, `e2e:map-rules` (robot nem állhat aranyon)                                                                                                                     | zöld (Rust, WASM, referencia) |
| T1.9  | 1    | Pontosan R sor, mindegyik pontosan C jel                                   | m004, m011, m031–m035                                                                                                                                                      | zöld (Rust, WASM, referencia) |
| T1.10 | 1    | A program lehet üres                                                       | r002, r107, s017, s027, s032                                                                                                                                               | zöld (Rust, WASM, referencia) |
| T1.11 | 1    | `isThere x`: 0 üres kamra, 1 fal, 2 arany                                  | r001, r041, r042, r082, r083                                                                                                                                               | zöld (Rust, WASM, referencia) |
| T1.12 | 1    | Hibás importált fájl: érthető hiba, nem töltődik be, nincs összeomlás      | m002–m040, s129, `server:maps.test` (422), `web` import, `e2e:map-rules` (minden `docs/receptek/hibas-terkepek` fájl), `e2e:program` (bináris, NUL, nem UTF-8, túl hosszú) | zöld (Rust, WASM, referencia) |
| T1.13 | D2   | BOM, CRLF és egy záró újsor elfogadott; csak újsoros fájl üres             | m010, m012–m015, m035, m053, m054, r104–r108, s016, s027–s034, `e2e:program` (BOM és CRLF)                                                                                 | zöld (Rust, WASM, referencia) |
| T1.14 | D15  | Arany nélküli és elérhetetlen arany: csak figyelmeztetés (BFS, 4-szomszéd) | m009, m043–m046, m048–m052                                                                                                                                                 | zöld (Rust, WASM, referencia) |
| T1.15 | D15  | Szerializálás → beolvasás változatlan                                      | `core:serialize_then_parse_round_trips`, `engine:map.test`                                                                                                                 | zöld                          |

## 2. A nyelvtan (spec 2, EBNF)

| ID    | Spec  | Szabály                                                                     | Teszteset(ek)                           | Állapot                       |
| ----- | ----- | --------------------------------------------------------------------------- | --------------------------------------- | ----------------------------- |
| T2.1  | 2     | `programme = { command }`, a 8 utasítás és minden operátor szabályos alakja | s127, s099, s108                        | zöld (Rust, WASM, referencia) |
| T2.2  | 2     | `step "forward" simpleval`                                                  | s042, s060, s063, s073, s089, s098      | zöld (Rust, WASM, referencia) |
| T2.3  | 2     | `turn "by" simpleval`                                                       | s049, s062, s064                        | zöld (Rust, WASM, referencia) |
| T2.4  | 2     | `mine "here"`                                                               | s046, s054, s065                        | zöld (Rust, WASM, referencia) |
| T2.5  | 2     | `print simpleval`                                                           | s047, s053, s067, s078                  | zöld (Rust, WASM, referencia) |
| T2.6  | 2     | `isThere simpleval` csak a `set` értékeként                                 | s050, s057, s058, s072, s082            | zöld (Rust, WASM, referencia) |
| T2.7  | 2     | `set ident "to" calculatedval`                                              | s043, s048, s066, s068, s074–s076       | zöld (Rust, WASM, referencia) |
| T2.8  | 2     | `if`, `if … else`, `while` simpleval feltétellel és blokkal                 | s045, s052, s055, s061, s081, s117      | zöld (Rust, WASM, referencia) |
| T2.9  | 2, D1 | `block = { command }`: az üres blokk szabályos                              | s018, s114, s115, r015, r037–r040       | zöld (Rust, WASM, referencia) |
| T2.10 | 2     | `calculatedval` = simpleval / függvény / binop / unop, semmi más            | s044, s051, s056, s058, s059, s069–s072 | zöld (Rust, WASM, referencia) |
| T2.11 | 2     | `binoperator` és `unoperator` (`and`, `or` bináris, `not` unáris)           | s071, s127, r056, r057, r068            | zöld (Rust, WASM, referencia) |
| T2.12 | 2     | `boolean-lit = true \| false`                                               | s075, r055, r056                        | zöld (Rust, WASM, referencia) |
| T2.13 | 2     | `ident = letter { letter \| digit }`, csak angol betű                       | s013, s090, s093–s095, r076             | zöld (Rust, WASM, referencia) |
| T2.14 | 2, D5 | `number = digit { digit }`, vezető nulla érvényes                           | s099, r075                              | zöld (Rust, WASM, referencia) |
| T2.15 | 2     | A kulcsszavak kis- és nagybetűérzékenyek                                    | s005, s073, s074, s086, s128            | zöld (Rust, WASM, referencia) |
| T2.16 | 2     | Az azonosítók kis- és nagybetűérzékenyek (`arany` ≠ `Arany`)                | r073, r074                              | zöld (Rust, WASM, referencia) |
| T2.17 | 2, D5 | A számliterál 0..100; 101, 0101 és a hosszú szám hiba                       | s007, s096–s099, r075                   | zöld (Rust, WASM, referencia) |
| T2.18 | 2     | Kulcsszó semmilyen írásmódban nem azonosító (mind a 18)                     | s006, s075–s081                         | zöld (Rust, WASM, referencia) |
| T2.19 | D5    | Negatív literál nincs, csak kivonással                                      | s088, s089, s062, r022                  | zöld (Rust, WASM, referencia) |
| T2.20 | 2     | A 2. fejezet bányászó példaprogramja                                        | r023–r027                               | zöld (Rust, WASM, referencia) |

## 3. Soronkénti feldolgozás (spec 2.1)

| ID    | Spec    | Szabály                                                               | Teszteset(ek)                                               | Állapot                       |
| ----- | ------- | --------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------- |
| T3.1  | 2.1/1   | Minden sor egy utasítás, nincs más elválasztó                         | s015, s125, s056                                            | zöld (Rust, WASM, referencia) |
| T3.2  | 2.1/1   | A behúzás adja a szintet, szinten belül egységes                      | s103, s104                                                  | zöld (Rust, WASM, referencia) |
| T3.3  | 2.1/1   | A behúzás jelöli a törzset; csökkenésével a törzs lezárul             | r036, s106, s109                                            | zöld (Rust, WASM, referencia) |
| T3.4  | 2.1/1   | Az else az if törzsével azonos behúzáson áll                          | s110, s118, s119                                            | zöld (Rust, WASM, referencia) |
| T3.5  | 2.1/1   | Behúzás csak szóközzel, tab sehol                                     | s001, s023, s024, s122                                      | zöld (Rust, WASM, referencia) |
| T3.6  | 2.1/1   | Blokkonként eltérő behúzás megengedett                                | s108, r036                                                  | zöld (Rust, WASM, referencia) |
| T3.7  | 2.1/2   | Pontosan egy szóköz a tokenek között; sorvégi szóköz hiba             | s003, s004, s035–s041                                       | zöld (Rust, WASM, referencia) |
| T3.8  | 2.1/2   | A szóköz választja el a tokeneket (`1+2`, `1<2`, `a+1`)               | s008, s092, s095                                            | zöld (Rust, WASM, referencia) |
| T3.9  | 2.1/3   | Az első token adja az utasítást; más első token ismeretlen utasítás   | s005, s082–s087, s128                                       | zöld (Rust, WASM, referencia) |
| T3.10 | 2.1/3   | A rögzített kulcsszavak helyén más token hiba                         | s063–s066, s073, s074                                       | zöld (Rust, WASM, referencia) |
| T3.11 | 2.1/3   | A nem rögzített tokenek simpleval-ok                                  | s067, s070, s072, s078, s080                                | zöld (Rust, WASM, referencia) |
| T3.12 | 2.1/4   | Nincs beágyazott kifejezés, minden simpleval egy token                | s044, s056, s058, s062                                      | zöld (Rust, WASM, referencia) |
| T3.13 | 2.1/5   | Nincs üres (vagy csak szóközös) sor                                   | s002, s025, s026, s028–s030, s034                           | zöld (Rust, WASM, referencia) |
| T3.14 | 2.1/5   | Futtatás előtt kötelező ellenőrzés, hibás program nem fut (D16)       | r102, r103, `e2e:smoke`, `e2e:run`                          | zöld (Rust, WASM, referencia) |
| T3.15 | 2.1/5   | A hibás sor megjelölése, minden sor ellenőrzése (D17)                 | s015, s125, r103                                            | zöld (Rust, WASM, referencia) |
| T3.16 | D2, D19 | Magányos `\r` hiba, és elsőbbsége a tabbal szemben                    | s019–s022                                                   | zöld (Rust, WASM, referencia) |
| T3.17 | D4, D19 | Legfelső szintű behúzás, a kihagyott sor utáni első sorban is         | s010, s100, s101                                            | zöld (Rust, WASM, referencia) |
| T3.18 | D4, D19 | Váratlan behúzás blokkfejléc nélkül                                   | s012, s086, s102, s121                                      | zöld (Rust, WASM, referencia) |
| T3.19 | D4, D19 | Visszahúzás nem nyitott szintre, utána helyreáll                      | s011, s105, s106                                            | zöld (Rust, WASM, referencia) |
| T3.20 | D4, D19 | Else csak közvetlenül az azonos mélységű if után, legfeljebb egyszer  | s009, s110–s116, s120                                       | zöld (Rust, WASM, referencia) |
| T3.21 | D17     | A hibás fejléc is blokkot nyit                                        | s014, s052, s081, s117, s035                                | zöld (Rust, WASM, referencia) |
| T3.22 | D17     | A szkennerhibás sor kimarad a behúzás-elemzésből                      | s101, s122–s124                                             | zöld (Rust, WASM, referencia) |
| T3.23 | D17     | Soronként egy behúzás- és egy (az első) tokenszintű hiba              | s040, s041, s107, s120, s121                                | zöld (Rust, WASM, referencia) |
| T3.24 | D19     | MISSING, EXTRA és UNEXPECTED minden D19-es példája                    | s042–s076                                                   | zöld (Rust, WASM, referencia) |
| T3.25 | D19     | Token-osztályok: érvénytelen token és azonosító, a `#` nem megjegyzés | s008, s013, s087–s095, s129                                 | zöld (Rust, WASM, referencia) |
| T3.26 | D19     | Diagnosztikák oszlop szerint (dupla szóköz: a második szóköz)         | s038, s039, s107, s120                                      | zöld (Rust, WASM, referencia) |
| T3.27 | –       | Generált helyes programok hibátlanok, mutált programok hibásak        | `gen:generateProgram`, `gen:generateInvalidProgram`, `diff` | zöld (Rust, WASM, referencia) |

## 4. Szemantika (spec 2.2.1, 2.2.2)

| ID    | Spec       | Szabály                                                                         | Teszteset(ek)                   | Állapot                       |
| ----- | ---------- | ------------------------------------------------------------------------------- | ------------------------------- | ----------------------------- |
| T4.1  | 2.2.1      | Aritmetika: egész operandus, egész eredmény                                     | r018, r022, r055, r064, r065    | zöld (Rust, WASM, referencia) |
| T4.2  | 2.2.1      | Összehasonlítás: egész operandus, logikai eredmény, határértékek                | r068, r063                      | zöld (Rust, WASM, referencia) |
| T4.3  | 2.2.1      | `=`/`<>` egészre és logikaira, azonos típussal                                  | r056, r013, r066, r067          | zöld (Rust, WASM, referencia) |
| T4.4  | 2.2.1      | `and`/`or`/`not` logikai operandussal                                           | r057, r012, r060–r062, r059     | zöld (Rust, WASM, referencia) |
| T4.5  | 2.2.1, D21 | `set`: előbb kiértékel, siker esetén ír; az első értékadás hozza létre          | r077, r072, r009, r101          | zöld (Rust, WASM, referencia) |
| T4.6  | 2.2.1, D21 | Balról jobbra, minden operandus azonnali típusellenőrzése, első hibánál megáll  | r012, r059, r063–r065           | zöld (Rust, WASM, referencia) |
| T4.7  | 2.2.1, D10 | Nincs rövidzár: `true or c` és `false and c` a c-t is beolvassa                 | r011, r058, r113, `mut`         | zöld (Rust, WASM, referencia) |
| T4.8  | 2.2.1, D21 | `=`/`<>` első operandusa bármi, az egyezés a második után                       | r013, r066, r067                | zöld (Rust, WASM, referencia) |
| T4.9  | 2.2.1      | `if`: then- vagy else-ág                                                        | r016, r017, r093                | zöld (Rust, WASM, referencia) |
| T4.10 | 2.2.1      | `while`: a törzs ismétlődik, amíg a feltétel igaz                               | r018, r035, r094                | zöld (Rust, WASM, referencia) |
| T4.11 | 2.2.2      | Két típus, nincs implicit konverzió                                             | r013, r048, r053, r064          | zöld (Rust, WASM, referencia) |
| T4.12 | 2.2.2      | Nincs deklaráció, a változó a program végéig él                                 | r097, r098                      | zöld (Rust, WASM, referencia) |
| T4.13 | 2.2.2      | A típus az első értékadáskor véglegesen rögzül                                  | r009, r099, r100                | zöld (Rust, WASM, referencia) |
| T4.14 | 2.2.2      | Az if és a while feltétele logikai                                              | r010, r084–r086                 | zöld (Rust, WASM, referencia) |
| T4.15 | 2.2.2      | Minden típusellenőrzés futásidőben, szintaktikailag helyes                      | s126, r010                      | zöld (Rust, WASM, referencia) |
| T4.16 | 2.2.2      | Fentről lefelé, szekvenciálisan; a blokk az azonos mélységű sorok               | r036, r088                      | zöld (Rust, WASM, referencia) |
| T4.17 | D6         | Ellenőrzött egész a ±(2^53 − 1) határon, `E_INT_OVERFLOW`                       | r019, r069–r072, `ref:evaluate` | zöld (Rust, WASM, referencia) |
| T4.18 | 2, 2.2.2   | A JavaScript beépített nevei (`constructor`, `toString`, …) közönséges változók | r114, r115, s131                | zöld (Rust, WASM, referencia) |

## 5. Robot API és futásidejű hibák (spec 2.2.3, 2.2.4)

| ID    | Spec       | Szabály                                                              | Teszteset(ek)                                        | Állapot                       |
| ----- | ---------- | -------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------- |
| T5.1  | 2.2.3, D8  | `step forward n`: n mező előre, a köztes mezőket is érintve          | r045, r054, r087, r088                               | zöld (Rust, WASM, referencia) |
| T5.2  | 2.2.3, D8  | Az áthaladt aranyat a helyén hagyja                                  | r044                                                 | zöld (Rust, WASM, referencia) |
| T5.3  | 2.2.3      | n nemnegatív egész                                                   | r052, r053, r051                                     | zöld (Rust, WASM, referencia) |
| T5.4  | 2.2.3, D9  | `turn by n`: n negyedfordulat balra, 0 nem változtat, mod 4          | r007, r021, r046, r090, r091, r032                   | zöld (Rust, WASM, referencia) |
| T5.5  | 2.2.3      | `mine here`: kibányássza, utána nincs több arany a mezőn             | r006, r043, r096                                     | zöld (Rust, WASM, referencia) |
| T5.6  | 2.2.3      | `isThere w` a robot előtti mezőt vizsgálja                           | r001, r082, r083, r042                               | zöld (Rust, WASM, referencia) |
| T5.7  | 2.2.3, D11 | A térkép szélén túl falat lát                                        | r020, r027, r041                                     | zöld (Rust, WASM, referencia) |
| T5.8  | 2.2.3, D12 | `print`: egész (negatív is) és logikai érték a konzolra              | r022, r055, r069, r071, r092                         | zöld (Rust, WASM, referencia) |
| T5.9  | 2.2.3      | Az n, w, x paraméter simpleval                                       | s062, s067, r054, r082                               | zöld (Rust, WASM, referencia) |
| T5.10 | 2.2.4      | `E_TYPE_MISMATCH`                                                    | r009, r077, r099, r100                               | zöld (Rust, WASM, referencia) |
| T5.11 | 2.2.4      | `E_UNINITIALIZED`                                                    | r008, r011, r050, r051, r058, r059, r062, r081, r098 | zöld (Rust, WASM, referencia) |
| T5.12 | 2.2.4      | `E_NON_BOOL_CONDITION`                                               | r010, r085, r086                                     | zöld (Rust, WASM, referencia) |
| T5.13 | 2.2.4      | `E_BAD_OPERAND` (aritmetika, összehasonlítás, logika, egyenlőség)    | r012, r013, r060, r061, r063, r064, r067             | zöld (Rust, WASM, referencia) |
| T5.14 | 2.2.4, D8  | `E_BEDROCK_HIT`: falra lépés vagy lelépés a soron következő lépésnél | r003, r004, r045, r087, r110                         | zöld (Rust, WASM, referencia) |
| T5.15 | 2.2.4      | `E_NO_GOLD`: nincs vagy már nincs arany                              | r005, r043, r096, r109                               | zöld (Rust, WASM, referencia) |
| T5.16 | 2.2.4      | `E_BAD_ARG`: isThere 0..2-n kívül, `turn by true`, negatív lépés     | r014, r047–r049, r052, r053, r078–r080               | zöld (Rust, WASM, referencia) |
| T5.17 | 2.2.4      | Hiba esetén a végrehajtás befejeződik                                | r043, r095, r109                                     | zöld (Rust, WASM, referencia) |
| T5.18 | D10, D21   | API-paraméter: előbb inicializálás, utána típus és tartomány         | r050, r051, r081, r079                               | zöld (Rust, WASM, referencia) |

## 6. Futtatás és lépésszámlálás (spec 3.4)

| ID    | Spec     | Szabály                                                                       | Teszteset(ek)                                                                                                        | Állapot                       |
| ----- | -------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| T6.1  | 3.4, D16 | Csak szintaktikailag helyes program fut; a hiba és a sor látszik              | r102, r103, `e2e:smoke`, `e2e:run` (minden hibás sor a hibalistán)                                                   | zöld (Rust, WASM, referencia) |
| T6.2  | 3.4      | Indításkor a térkép és a robot alaphelyzetben                                 | r102, `web:playback-store.test`, `e2e:run` (kétszeri futtatás)                                                       | zöld (Rust, WASM, referencia) |
| T6.3  | 3.4, D20 | Az aktuális sor és a print kimenete követhető (eseménysor)                    | r092–r096, `web:derive.test`, `e2e:run` (`aria-current` sor, konzol)                                                 | zöld (Rust, WASM, referencia) |
| T6.4  | 3.4, D20 | A robot helyzete és iránya minden sor után                                    | r088, r046, r083, `e2e:run` (cellacímkék, műszerek)                                                                  | zöld (Rust, WASM, referencia) |
| T6.5  | 3.4, D11 | Felfedezett mezők: amin járt és amire isThere hívódott, sorrendben            | r023–r027, r041, r045, r077, r078, r083, r087, r088, `e2e:run` (isThere felfedez)                                    | zöld (Rust, WASM, referencia) |
| T6.6  | 3.4      | A kibányászott arany helyét nem kell jelölni (üres kamra lesz)                | r042                                                                                                                 | zöld (Rust, WASM, referencia) |
| T6.7  | 3.4, D7  | Minden végrehajtott sor egy lépés, a hibát okozó sor is                       | r018, r036, r003, r033                                                                                               | zöld (Rust, WASM, referencia) |
| T6.8  | 3.4, D7  | A törzs sorai minden lefutáskor, a while sora minden kiértékeléskor számít    | r018, r035, r094, r032                                                                                               | zöld (Rust, WASM, referencia) |
| T6.9  | 3.4, D7  | Az else sora csak akkor számít, ha az else-ág fut                             | r016, r017, r038, r039, r093, r031                                                                                   | zöld (Rust, WASM, referencia) |
| T6.10 | 3.4, D7  | Pontosan 1000 sor hibátlan; az 1001. előtt `INSTRUCTION_COUNT_LIMIT_EXCEEDED` | r028, r029, r015, `e2e:run` (1000 lépés után)                                                                        | zöld (Rust, WASM, referencia) |
| T6.11 | 3.4, D7  | A limit az else során és az ismételt while soron is                           | r030, r032                                                                                                           | zöld (Rust, WASM, referencia) |
| T6.12 | 3.4, D7  | Az 1000. sor futásidejű hibája nyer; az 1001. hibás sor helyett a limit       | r033, r034                                                                                                           | zöld (Rust, WASM, referencia) |
| T6.13 | 3.4      | Vége: hiba nélkül, futásidejű hibával vagy a limittel; a kód és a sor         | r001, r003, r015, minden `runtimeError` eset, `e2e:run` (minden hibapróba kódja és sora)                             | zöld (Rust, WASM, referencia) |
| T6.14 | 3.4, 3.5 | Kibányászott arany és lépésszám minden futásnál                               | minden runtime eset `gold`/`steps` mezője, `server:runs.test`, `e2e:run` (minden recept pontos arany- és lépésszáma) | zöld (Rust, WASM, referencia) |
| T6.15 | 3.4      | A futás leállítható                                                           | `web:playback-store.test` (stop), `e2e:run` (leállítás, nem kerül a ranglistára)                                     | zöld                          |
| T6.16 | 3.4      | Felfedezett és felderítetlen mezők megkülönböztetve a felületen               | `web:MapGrid.test` (köd mód), `e2e:run` (lámpafény és teljes térkép cellacímkéi)                                     | zöld                          |
| T6.17 | D20      | A referencia és a motor eseménysora mezőről mezőre egyezik                    | `diff`                                                                                                               | zöld (Rust, WASM, referencia) |
| T6.18 | 2, 3.4   | A spec 2. fejezetének programja a `>.@.@#` térképen: 35 lépés, 2 arany             | r116                                                          | zöld (Rust, WASM, referencia) |
| T6.19 | 3.4      | Invariánsok minden generált futásra (lépés ≤ 1000, robot a pályán, arany ≤ térkép) | `prop`                                                        | zöld                          |
| T6.20 | 3.4, D9  | `turn by n` ≡ `turn by (n mod 4)`; `step a` + `step b` ≡ `step a+b`; determinizmus | `prop`                                                        | zöld                          |
| T6.21 | 3.4      | Óriási, mélyen beágyazott és szokatlan karakteres bemenetre sincs összeomlás       | `rob`                                                         | zöld                          |
| T6.22 | 3.4      | A felület minden kulcsszélességen (320, 768, 1024, 1440) túlcsordulás nélkül       | `e2e:responsive`                                              | zöld                          |

## 7. D-döntések

| Döntés | Téma                          | Teszteset(ek)                                                                            | Állapot                       |
| ------ | ----------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------- |
| D1     | Üres blokk                    | s018, s114, s115, r015, r037–r040                                                        | zöld (Rust, WASM, referencia) |
| D2     | Normalizálás                  | T1.13 sorai, s019–s022, m026, m030, `e2e:program`                                        | zöld (Rust, WASM, referencia) |
| D3     | Szóközök                      | s001–s004, s023–s026, s035–s039                                                          | zöld (Rust, WASM, referencia) |
| D4     | Behúzás                       | s009–s012, s100–s113, s118, s119, r036                                                   | zöld (Rust, WASM, referencia) |
| D5     | Számliterálok                 | s007, s088, s089, s096–s099, r022, r075                                                  | zöld (Rust, WASM, referencia) |
| D6     | Futásidejű egész              | r019, r069–r072                                                                          | zöld (Rust, WASM, referencia) |
| D7     | Lépésszámlálás                | r015–r018, r028–r035, r093, r094                                                         | zöld (Rust, WASM, referencia) |
| D8     | step forward n                | r003, r004, r021, r044, r045, r052, r054, r087, r110                                     | zöld (Rust, WASM, referencia) |
| D9     | turn by n                     | r007, r021, r032, r046–r049, r090, r091                                                  | zöld (Rust, WASM, referencia) |
| D10    | Hibaelsőbbség                 | r008, r010–r014, r047–r051, r058, r059, r063, r079, r081, r084, r085                     | zöld (Rust, WASM, referencia) |
| D11    | Felfedezés                    | r020, r023–r027, r041, r042, r045, r077, r078, r082, r083, r087, r088                    | zöld (Rust, WASM, referencia) |
| D12    | print                         | r022, r055, r069, r071, r092                                                             | zöld (Rust, WASM, referencia) |
| D13    | Ranglista                     | `server:leaderboard.test`, `server:runs.test`, `e2e:leaderboard`, `e2e:run` (leállítás)  | zöld                          |
| D14    | Térképverziók                 | `server:maps.test` (D14), `e2e:map-rules`                                                | zöld                          |
| D15    | Térképformátum                | m001–m054, r106                                                                          | zöld (Rust, WASM, referencia) |
| D16    | Hibás program nem fut         | r102, r103, `ref:machine`                                                                | zöld (Rust, WASM, referencia) |
| D17    | Minden sor ellenőrzése        | s014, s015, s035, s040, s041, s052, s081, s086, s101, s106, s107, s117, s120–s125        | zöld (Rust, WASM, referencia) |
| D18    | Koordináták                   | r088, r089 és minden `robot`/`discovered`/`events` mező (0-alapú)                        | zöld (Rust, WASM, referencia) |
| D19    | Szintaktikai hibák leképezése | s019–s129 (`decisions` szerint), `ref:scanner`, `ref:parser`                             | zöld (Rust, WASM, referencia) |
| D20    | Eseménysor                    | r023, r045, r046, r077, r078, r083, r087, r088, r092–r096, r102, r107                    | zöld (Rust, WASM, referencia) |
| D21    | Kiértékelés lépésről lépésre  | r030, r032, r043, r047–r053, r058–r072, r077–r081, r084–r086, r099, r100                 | zöld (Rust, WASM, referencia) |
| D22    | Formázó                       | `core:format` unit-tesztek, `core:properties` (idempotencia, `run(format(x)) == run(x)`) | zöld                          |
| D23    | Programfájl importja          | s129 (a motor oldala), `web` import, `e2e:program`                                       | zöld (Rust, WASM, referencia) |

## 8. Felhasználók, térképek, ranglista (spec 3.1, 3.2, 3.5)

| ID    | Spec     | Szabály                                                              | Teszteset(ek)                                                                                  | Állapot |
| ----- | -------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------- |
| T8.1  | 3.1      | Funkciók csak bejelentkezés után                                     | `server:runs.test` (401), `e2e:smoke` (átirányítás), `e2e:auth` (minden védett útvonal és API) | zöld    |
| T8.2  | 3.1      | Regisztráció, belépés, kilépés                                       | `server:auth.test`, `e2e:smoke`, `e2e:keyboard`, `e2e:auth` (mezőhibák, foglalt név)           | zöld    |
| T8.3  | 3.2      | Csak szabályos térkép menthető                                       | `server:maps.test` (422), m002–m040, `e2e:map-rules` (mentés letiltva)                         | zöld    |
| T8.4  | 3.2      | Térkép export fájlba                                                 | `server:maps.test` (export), `e2e:map-rules` (minden mintapálya exportja bájtra)               | zöld    |
| T8.5  | D14      | Futás után új verzió, külön ranglista                                | `server:maps.test` (D14), `e2e:map-rules`                                                      | zöld    |
| T8.6  | 3.5, D13 | Rendezés: arany DESC, lépés ASC, idő ASC; felhasználónként a legjobb | `server:leaderboard.test`, `e2e:leaderboard` (öt felhasználó a felületen)                      | zöld    |
| T8.7  | D13      | A szerver számolja az eredményt                                      | `server:runs.test` (a kliens `gold` mezője figyelmen kívül)                                    | zöld    |
| T8.8  | D13      | Szintaktikai hiba nem kerül a ranglistára                            | `server:runs.test`, `e2e:run`                                                                  | zöld    |
| T8.9  | 3.2      | Privát térkép csak a tulajdonosnak és az adminnak                    | `server:maps.test`                                                                             | zöld    |
| T8.10 | 3.3      | Program importja fájlból, szerkesztése és exportja bájtra pontosan   | `e2e:program`                                                                                  | zöld    |

## 9. Akadálymentesség és biztonság

| ID   | Forrás        | Szabály                                                           | Teszteset(ek)                                            | Állapot |
| ---- | ------------- | ----------------------------------------------------------------- | -------------------------------------------------------- | ------- |
| T9.1 | 4 (értékelés) | Nincs serious/critical axe-találat (világos és sötét téma)        | `e2e:a11y` (minden oldal és állapot)                     | zöld    |
| T9.2 | 4             | Teljes belépés és navigáció billentyűzettel                       | `e2e:keyboard`, `e2e:keyboard` (teljes recept futtatása) | zöld    |
| T9.3 | 4             | A térképrács szerepkörei és nyílbillentyűs navigációja            | `web:MapGrid.test`                                       | zöld    |
| T9.4 | –             | CSRF Origin-ellenőrzés                                            | `server:csrf.test`                                       | zöld    |
| T9.5 | –             | Bejelentkezési korlát                                             | `server:auth.test`                                       | zöld    |
| T9.6 | –             | Minden kód magyar szöveggel                                       | `web:i18n.test`, `core:every_code_has_a_message`         | zöld    |
| T9.7 | 4             | 320–1440 px, mindkét téma: nincs kilógás, takarás, 24 px-es célok | `e2e:responsive`                                         | zöld    |
| T9.8 | 4             | `prefers-reduced-motion`: nincs futó animáció                     | `e2e:a11y` (csökkentett mozgás)                          | zöld    |
| T9.9 | 4             | Látható fókusz minden tabulátor-megállón                          | `e2e:keyboard`                                           | zöld    |
| ----- | ------------- | ---------------------------------------------------------- | ------------------------------------------------ | ------- |
| T9.10 | –             | A süti HttpOnly és SameSite=Lax, kilépés után érvénytelen  | `e2e:security`                                   | zöld    |
| T9.11 | –             | Jelszó és hash sehol a válaszban és a böngészőtárolóban    | `e2e:security`                                   | zöld    |
| T9.12 | –             | Injektálás-jellegű bemenet 400, stack trace nélkül         | `e2e:security`                                   | zöld    |
| T9.13 | –             | HTML a címben és a leírásban szövegként jelenik meg        | `e2e:security` (XSS)                             | zöld    |
| T9.14 | –             | Biztonsági fejlécek (CSP, X-Frame-Options, nosniff)        | `e2e:security`                                   | zöld    |

## Futtatás

```bash
bun test --cwd tools/reference-interpreter
bun test --cwd packages/engine
just conformance
DIFF_SEEDS=30000 bun test --timeout 600000 --cwd tools/reference-interpreter test/diff.test.ts
PROPERTY_SEEDS=5000 bun test --cwd tools/reference-interpreter test/properties.test.ts
just e2e
```

## QA-jelentés (2026. november 6.)

Minden szám ebben a munkamenetben, Windows 11-en, ténylegesen lefuttatott parancsból származik.

### Eredmények

| Parancs                                                 | Terület                                                        | Eredmény                             |
| ------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------ |
| `just conformance`                                      | 301 eset Rustban, WASM-on és a referencián                     | zöld (WASM-csomag: 610 teszt)        |
| `bun test --coverage --cwd tools/reference-interpreter` | referencia, differenciális, mutációs, invariáns, robusztussági | 148/148 zöld                         |
| `just test`                                             | Rust, engine, referencia, szerver, web                         | egy piros: BUG-1 (Rust CLI, Windows) |
| `just e2e`                                              | Playwright, chromium                                           | 83/83 zöld                           |
| `just lint`                                             | rustfmt, clippy, Biome, typecheck                              | zöld                                 |

### Lefedettség

A referencia-interpreter `src/` mappája: 100% függvény, 100% sor. Ágra csak a `machine.ts` 152. sora hiányzik, ez a nem `Fault` kivétel továbbdobása, normál futásban nem érhető el.

### Mutációs ellenőrzés

`mut`: 15 szándékosan elrontott referencia-változat, ideiglenes másolatban. Mindegyiknél elvárás, hogy a conformance-csomag legalább egy esete elbukjon, a változatlan másolatnál pedig egy se.

- Az első futáson a „rövidzáras `and`” mutáns túlélt: a csomagban nem volt `false and c` eset. Ezt pótolja az r113, azóta mind a 15 mutánst megfogja a csomag.
- A mutánsok: `or`/`and` rövidzár, `=`/`<>` típusegyezés nélkül, jobbra forgás, mod 3, falon átlépés, újrabányászás, a pályán kívüli `isThere` üres kamrát lát, `isThere` felfedezés nélkül, típusrögzítés nélkül, 1002-es limit, nem számoló `else`, nem számoló utolsó `while`, 101-es literál, 16-os térkép.

### Fuzz és differenciális futások

| Teszt                                            | Seedek | Találat   |
| ------------------------------------------------ | ------ | --------- |
| `diff`, helyes programok                         | 1–2000 | 0 eltérés |
| `diff`, hibás programok                          | 1–2000 | 0 eltérés |
| `diff`, térképek                                 | 1–2000 | 0 eltérés |
| `prop`, invariánsok (referencia és WASM)         | 1–500  | 0 sértés  |
| `prop`, determinizmus, formázás-invariancia      | 1–200  | 0 eltérés |
| `prop`, térkép-körút (parse → serialize → parse) | 1–500  | 0 eltérés |

Az 500 generált futás kimenetele: 156 `E_BEDROCK_HIT`, 142 `ok`, 83 `E_UNINITIALIZED`, 70 `E_NO_GOLD`, 24 limit, 10 `E_BAD_ARG`, 8 `E_TYPE_MISMATCH`, 4 `E_BAD_OPERAND`, 2 `E_INT_OVERFLOW`, 1 `E_NON_BOOL_CONDITION`. Aranyat csak 2 futás bányászik ki, ezért az arany-invariánsokat a generátor gyengén terheli (lásd a fennmaradó feladatokat).

### Sérülékenység és robusztusság

| Pont                                                                                              | Állapot                                                    | Bizonyíték                      |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------- |
| B3 JavaScript-nevek (`constructor`, `toString`, `valueOf`, `prototype`, `hasOwnProperty`)         | megvizsgálva, nincs hiba                                   | r114, r115                      |
| B3 `__proto__`                                                                                    | megvizsgálva, `SYN_INVALID_IDENT`                          | s131, `rob`                     |
| B3 nagy számok                                                                                    | megvizsgálva, `E_INT_OVERFLOW` (D6)                        | r019, r069–r072                 |
| B4 100 000 soros program, 100 000 karakteres azonosító, 2000 szint mély beágyazás, 1 MB-os térkép | megvizsgálva, nincs hiba                                   | `rob`                           |
| B4 BOM, NBSP, teljes szélességű szóköz, NUL, `\r`, RTL, emoji, ékezet, helyettesítő kód           | megvizsgálva, mindkét motor azonos hibát ad                | `rob`                           |
| B4 bináris programfájl importja                                                                   | megvizsgálva, nincs hiba                                   | `e2e:play`                      |
| B4 túl nagy kéréstörzs                                                                            | megvizsgálva, 413 és kapcsolatzárás, a szerver utána is él | `e2e:security`                  |
| B5 XSS (cím, leírás)                                                                              | megvizsgálva, nincs hiba                                   | `e2e:security`                  |
| B5 injektálás a belépésnél                                                                        | megvizsgálva, nincs hiba (400)                             | `e2e:security`                  |
| B5 hitelesítés, IDOR, admin                                                                       | megvizsgálva, nincs hiba                                   | `e2e:security`                  |
| B5 ranglista-hamisítás                                                                            | megvizsgálva, nincs hiba (a szerver újraszámol)            | `e2e:security`                  |
| B5 süti, jelszó, brute force                                                                      | megvizsgálva, nincs hiba                                   | `e2e:security`                  |
| B5 hibaüzenetek és fejlécek, CORS                                                                 | megvizsgálva, nincs hiba                                   | `e2e:security`                  |
| B5 titkok a repóban                                                                               | nem vizsgált                                               | csak kézi átnézéssel lehetséges |
| B5 függőség-audit                                                                                 | nem vizsgált                                               | a `bun audit` hálózatot igényel |
| B5 versenyhelyzetek (dupla kattintás, két lap)                                                    | nem vizsgált                                               | későbbi e2e feladat             |

### A prompt nyitott kérdései és a csapat döntései

| #      | Kérdés                             | Döntés                                                                           |
| ------ | ---------------------------------- | -------------------------------------------------------------------------------- |
| T1, T2 | Üres blokk                         | D1: szabályos, `LINT_EMPTY_BLOCK` figyelmeztetéssel                              |
| T3     | Futásidejű hiba sora               | D7, D20: a hibát okozó sor, `while` feltételnél a `while` sora                   |
| T4     | A limit hibasora                   | D7: az 1001.-ként feldolgozandó sor, a lépésszám 1000                            |
| T5, T6 | Holtverseny, több futás            | D13: felhasználónként a legjobb futás, azonos eredménynél a korábbi időpont nyer |
| T7     | `\r\n`                             | D2: elfogadott                                                                   |
| T8     | A kezdőmező felfedezett            | D11: igen                                                                        |
| T9     | A robot helye `E_BEDROCK_HIT` után | D8: az utolsó érvényes mezőn                                                     |
| T10    | Hibás futás mentése                | D13: igen, a leállított és a szintaktikailag hibás futás nem                     |

### Hibajelentések

```text
ID:            BUG-1
Felelős:       gergogyulai
Terület:       import/export (CLI)
Fájl és sor:   crates/minescript-cli/tests/cli.rs:64 (a hibás üzenet a CLI fájlolvasásából jön)
Súlyosság:     alacsony
Követelmény:   1 „érthető hibaüzenettel kell jeleznie a hibát”
Reprodukció:   Windowson: minescript check <egy mappa útvonala>
Elvárt:        „… ez egy mappa, nem fájl”
Tényleges:     „Nem olvasható a fájl (…): nincs jogosultság a fájl olvasásához”
Teszt:         cargo test -p minescript-cli --test cli unreadable_inputs_are_reported_in_hungarian
```

```text
ID:            BUG-2
Felelős:       futozs
Terület:       felhasználó (szerver-tesztek környezete)
Fájl és sor:   apps/server (a tesztek a saját mappájukból futnak)
Súlyosság:     közepes
Követelmény:   README: „a Bun a futtatás könyvtárából a .env-et magától betölti”
Reprodukció:   a gyökérben .env a .env.example alapján, Docker-MySQL, majd just test
Elvárt:        a szerver-tesztek a .env TEST_DATABASE_URL értékével csatlakoznak
Tényleges:     41 szerver-teszt ER_ACCESS_DENIED_ERROR-ral bukik (root jelszó nélkül); környezeti változóval megadva mind zöld
Teszt:         just test (apps/server)
```

### Fennmaradó feladatok

- A generátor ritkán bányászik aranyat: kell egy arany felé tartó programminta, hogy az arany-invariánsok érdemben terhelődjenek.
- B5 versenyhelyzetek: dupla kattintás a futtatáson, két böngészőlap, térképváltás futás közben.
- B5 függőség-audit és titokkeresés.
- A futásidejű hiba a felületen `status` szerepű elemben jelenik meg, nem `alert`-ben. Ez nem hiba, de érdemes megbeszélni a webes szereppel.
