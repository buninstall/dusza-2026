# Tesztterv

A spec minden szabályához legalább egy automata teszt tartozik. A mátrix oszlopai: azonosító, spec-fejezet, szabály, a lefedő teszteset(ek), állapot.

Állapotok: **zöld** – a teszt lefut és átmegy; **vár** – a teszt megvan, de a parser vagy a VM még stub, ezért kikapcsolt vagy piros; **hiányzik** – még nincs teszt.

Jelölések: `rNNN` = `conformance/runtime/NNN-*`, `sNNN` = `conformance/syntax/NNN-*`, `mNNN` = `conformance/maps/NNN-*`; `core:…` Rust unit-teszt, `server:…` bun-teszt, `web:…` Vitest, `e2e:…` Playwright.

## 1. Térkép- és programformátum

| ID    | Spec  | Szabály                                                  | Teszteset(ek)                                                         | Állapot                       |
| ----- | ----- | -------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------- |
| T1.1  | 1     | Fejléc: két dimenzió egy szóközzel                       | m008, `core:reports_malformed_header`                                 | zöld                          |
| T1.2  | 1     | Mindkét dimenzió 1..15                                   | m005, m006, `core:reports_dimension_range`                            | zöld                          |
| T1.3  | 1     | Pontosan R sor                                           | m011, `core:reports_row_count`                                        | zöld                          |
| T1.4  | 1     | Soronként pontosan C jel                                 | m004                                                                  | zöld                          |
| T1.5  | 1     | Csak `.@#<>^v` jelek                                     | m007                                                                  | zöld                          |
| T1.6  | 1     | Pontosan egy robot                                       | m002, m003                                                            | zöld                          |
| T1.7  | 1     | A robot iránya a jelből                                  | m001, `core:parses_spec_example`                                      | zöld                          |
| T1.8  | 1     | A spec példatérképe érvényes                             | m001                                                                  | zöld                          |
| T1.9  | 1, D2 | CRLF és BOM elfogadott                                   | m010, s016                                                            | zöld (m), vár (s)             |
| T1.10 | 1     | Az üres program érvényes                                 | r002, s017                                                            | vár                           |
| T1.11 | 1     | Hibás import nem töltődik be, érthető hibát ad           | `server:maps.test` (422), `web:MapEditor` import                      | zöld (server), hiányzik (web) |
| T1.12 | D15   | Arany nélküli és elérhetetlen arany: csak figyelmeztetés | m009, `core:map_without_gold_is_only_a_warning`                       | zöld                          |
| T1.13 | 1     | Szerializálás → beolvasás változatlan                    | `core:serialize_then_parse_round_trips` (proptest), `engine:map.test` | zöld                          |

## 2. Nyelvtan és tokenizálás

| ID    | Spec      | Szabály                                             | Teszteset(ek)                            | Állapot                 |
| ----- | --------- | --------------------------------------------------- | ---------------------------------------- | ----------------------- |
| T2.1  | 2         | Kulcsszavak kis-/nagybetűérzékenyek                 | s005, `core:keywords_are_case_sensitive` | vár                     |
| T2.2  | 2         | Azonosító nem lehet kulcsszó (semmilyen írásmódban) | s006, `core:reserved_check_ignores_case` | vár                     |
| T2.3  | 2         | Azonosító: betű, majd betű/számjegy                 | s013                                     | vár                     |
| T2.4  | 2, D5     | Számliterál 0..100                                  | s007, r022                               | vár                     |
| T2.5  | D5        | Negatív literál nincs                               | s008 (`1+2`)                             | vár; `-5` eset hiányzik |
| T2.6  | 2.1/1, D4 | A legfelső szint nincs behúzva                      | s010                                     | vár                     |
| T2.7  | 2.1/1, D4 | Visszahúzás csak nyitott szintre                    | s011                                     | vár                     |
| T2.8  | 2.1/1, D4 | Blokkfejléc nélkül nincs behúzás                    | s012                                     | vár                     |
| T2.9  | 2.1/1, D4 | Blokkon belül egységes behúzás                      | –                                        | hiányzik                |
| T2.10 | 2.1/1     | Tab nem használható                                 | s001                                     | vár                     |
| T2.11 | 2.1/2, D3 | Pontosan egy szóköz a tokenek között                | s003                                     | vár                     |
| T2.12 | D3        | Sorvégi szóköz hiba                                 | s004                                     | vár                     |
| T2.13 | 2.1/5     | Üres sor nem lehet                                  | s002                                     | vár                     |
| T2.14 | 2.1/3     | Ismeretlen utasítás                                 | s005                                     | vár                     |
| T2.15 | 2.1/1, D4 | else csak if után                                   | s009                                     | vár                     |
| T2.16 | 2, D17    | A hibás fejléc is blokkot nyit                      | s014                                     | vár                     |
| T2.17 | D17       | Minden sor ellenőrzése, több hiba                   | s015                                     | vár                     |
| T2.18 | 2, D1     | Az üres blokk szabályos                             | s018, r015                               | vár                     |
| T2.19 | 2.1/4     | Minden simpleval egy token                          | s008                                     | vár                     |
| T2.20 | D2        | Magányos `\r` hiba                                  | –                                        | hiányzik                |

## 3. Szemantika

| ID    | Spec       | Szabály                                        | Teszteset(ek) | Állapot  |
| ----- | ---------- | ---------------------------------------------- | ------------- | -------- |
| T3.1  | 2.2.1      | Aritmetika egész operandusokkal                | r018, r022    | vár      |
| T3.2  | 2.2.1      | Összehasonlítás egész operandusokkal           | r018          | vár      |
| T3.3  | 2.2.1, D10 | `=`/`<>` azonos típus, egyébként E_BAD_OPERAND | r013          | vár      |
| T3.4  | 2.2.1, D10 | Logikai művelet logikai operandussal           | r012          | vár      |
| T3.5  | 2.2.1, D10 | Nincs rövidzár (`true or c`)                   | r011          | vár      |
| T3.6  | 2.2.2      | A típus az első értékadáskor rögzül            | r009          | vár      |
| T3.7  | 2.2.2      | Inicializálatlan változó olvasása              | r008, r011    | vár      |
| T3.8  | 2.2.2, D10 | Az if/while feltétele logikai                  | r010          | vár      |
| T3.9  | 2.2.1      | if/else ágválasztás                            | r016, r017    | vár      |
| T3.10 | 2.2.1      | while ciklus                                   | r018          | vár      |
| T3.11 | D6         | Egész túlcsordulás E_INT_OVERFLOW              | r019          | vár      |
| T3.12 | 2.2.2      | `not` logikai operandussal                     | –             | hiányzik |

## 4. Robot API és futásidejű hibák

| ID    | Spec       | Szabály                                      | Teszteset(ek)                                           | Állapot                   |
| ----- | ---------- | -------------------------------------------- | ------------------------------------------------------- | ------------------------- |
| T4.1  | 2.2.3, D8  | step forward mezőnként, falnál E_BEDROCK_HIT | r003, `core:steps_until_wall_and_keeps_last_valid_cell` | vár (r), zöld (core)      |
| T4.2  | 2.2.3, D8  | Lelépés a térképről E_BEDROCK_HIT            | r004, `core:leaving_the_map_is_blocked`                 | vár (r), zöld (core)      |
| T4.3  | D8         | step forward 0 és turn by 0 érvényes         | r021                                                    | vár                       |
| T4.4  | 2.2.3      | Áthaladáskor az arany a helyén marad         | `core:walks_over_gold_without_mining`                   | zöld                      |
| T4.5  | 2.2.3, D9  | turn by n balra, mod 4                       | r007, `core:turn_left_by_uses_modulo_four`              | vár (r), zöld (core)      |
| T4.6  | 2.2.3      | mine here aranyon                            | r006                                                    | vár                       |
| T4.7  | 2.2.4      | mine here arany nélkül E_NO_GOLD             | r005                                                    | vár                       |
| T4.8  | 2.2.3      | A kibányászott mezőn nincs több arany        | –                                                       | hiányzik                  |
| T4.9  | 2.2.3, D11 | isThere pályán kívül falat lát               | r020                                                    | vár                       |
| T4.10 | 2.2.4      | isThere 3 → E_BAD_ARG                        | r014                                                    | vár                       |
| T4.11 | 2.2.4      | turn by true → E_BAD_ARG                     | –                                                       | hiányzik                  |
| T4.12 | 2.2.3, D12 | print egész és logikai, negatív is           | r001, r022                                              | vár                       |
| T4.13 | 2.2.3      | A spec példaprogramja                        | r001                                                    | vár                       |
| T4.14 | D11        | isThere felfedezi a célmezőt                 | `web:derive.test` (szintetikus)                         | zöld (web), core hiányzik |

## 5. Futtatás, lépésszámlálás, felület

| ID    | Spec     | Szabály                                             | Teszteset(ek)                                                        | Állapot |
| ----- | -------- | --------------------------------------------------- | -------------------------------------------------------------------- | ------- |
| T5.1  | 3.4, D7  | Minden végrehajtott sor egy lépés                   | r016, r017, r018                                                     | vár     |
| T5.2  | 3.4, D7  | A while sora a hamis kiértékelésnél is számít       | r018                                                                 | vár     |
| T5.3  | 3.4, D7  | Az else sora csak az else-ágnál számít              | r016, r017                                                           | vár     |
| T5.4  | 3.4, D7  | 1000 sor után INSTRUCTION_COUNT_LIMIT_EXCEEDED      | r015                                                                 | vár     |
| T5.5  | 3.4, D16 | Hibás program nem fut                               | `core:syntax_errors_prevent_running`, `engine:map.test`, `e2e:smoke` | zöld    |
| T5.6  | 3.4      | A hibás sor jelölése a felületen                    | `e2e:smoke` (szintaktikai hiba üzenet)                               | zöld    |
| T5.7  | 3.4      | Lassított lejátszás, aktuális sor, konzol           | `web:playback-store.test`, `web:derive.test`                         | zöld    |
| T5.8  | 3.4      | A futás leállítható                                 | `web:playback-store.test` (stop)                                     | zöld    |
| T5.9  | 3.4      | Felfedezett és felderítetlen mezők megkülönböztetve | `web:MapGrid.test` (köd mód)                                         | zöld    |
| T5.10 | 3.4      | Indításkor alaphelyzet                              | `web:playback-store.test` (load)                                     | zöld    |

## 6. Felhasználók, térképek, ranglista

| ID   | Spec     | Szabály                                                              | Teszteset(ek)                                               | Állapot |
| ---- | -------- | -------------------------------------------------------------------- | ----------------------------------------------------------- | ------- |
| T6.1 | 3.1      | Funkciók csak bejelentkezés után                                     | `server:runs.test` (401), `e2e:smoke` (átirányítás)         | zöld    |
| T6.2 | 3.1      | Regisztráció, belépés, kilépés                                       | `server:auth.test`, `e2e:smoke`, `e2e:keyboard`             | zöld    |
| T6.3 | 3.2      | Csak szabályos térkép menthető                                       | `server:maps.test` (422)                                    | zöld    |
| T6.4 | 3.2      | Térkép export fájlba                                                 | `server:maps.test` (export)                                 | zöld    |
| T6.5 | D14      | Futás után új verzió, külön ranglista                                | `server:maps.test` (D14)                                    | zöld    |
| T6.6 | 3.5, D13 | Rendezés: arany DESC, lépés ASC, idő ASC; felhasználónként a legjobb | `server:leaderboard.test`                                   | zöld    |
| T6.7 | D13      | A szerver számolja az eredményt                                      | `server:runs.test` (a kliens `gold` mezője figyelmen kívül) | zöld    |
| T6.8 | D13      | Szintaktikai hiba nem kerül a ranglistára                            | `server:runs.test`                                          | zöld    |
| T6.9 | 3.2      | Privát térkép csak a tulajdonosnak és az adminnak                    | `server:maps.test`                                          | zöld    |

## 7. Akadálymentesség és biztonság

| ID   | Forrás        | Szabály                                                    | Teszteset(ek)                                    | Állapot |
| ---- | ------------- | ---------------------------------------------------------- | ------------------------------------------------ | ------- |
| T7.1 | 4 (értékelés) | Nincs serious/critical axe-találat (világos és sötét téma) | `e2e:a11y`                                       | zöld    |
| T7.2 | 4             | Teljes belépés és navigáció billentyűzettel                | `e2e:keyboard`                                   | zöld    |
| T7.3 | 4             | A térképrács szerepkörei és nyílbillentyűs navigációja     | `web:MapGrid.test`                               | zöld    |
| T7.4 | –             | CSRF Origin-ellenőrzés                                     | `server:csrf.test`                               | zöld    |
| T7.5 | –             | Bejelentkezési korlát                                      | `server:auth.test`                               | zöld    |
| T7.6 | –             | Minden kód magyar szöveggel                                | `web:i18n.test`, `core:every_code_has_a_message` | zöld    |
