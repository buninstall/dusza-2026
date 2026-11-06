# crates/

## Modultérkép

| Crate / modul                        | Tartalom                                                                                                                                     |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `minescript-core/src/source.rs`      | normalizálás (BOM, CRLF, D2), sorokra bontás, sor ↔ UTF-16 offset                                                                            |
| `minescript-core/src/span.rs`        | `Span { line, colStart, colEnd, from, to }` (D18)                                                                                            |
| `minescript-core/src/diagnostics/`   | `Diagnostic`, `DiagCode`, `Severity`, `Fix`, magyar üzenetek (`messages.rs`)                                                                 |
| `minescript-core/src/syntax/`        | `keywords` (`Keyword`, `Command`), `lexeme` (tokenosztályok), `scanner` (sorok, szavak, szóközhibák), `ast`, `token`                         |
| `minescript-core/src/syntax/parser/` | `line` (soronkénti nyelvtan), `faults` (az első tokenszintű hiba), `layout` (behúzásverem), `report` (üzenetek, javítások), `repair`, `tree` |
| `minescript-core/src/format/`        | `whitespace` (D22/1), `indent` (D22/2), `format`                                                                                             |
| `minescript-core/src/lint/`          | `statements`, `sequences`, `variables`, `flow` (definit értékadás), `types` (statikus típusok)                                               |
| `minescript-core/src/ide/`           | `analyze`, `tokens`, `outline` (fold, szimbólum), `completion`, `hover`, `docs`                                                              |
| `minescript-core/src/map/`           | `Map`, `Cell`, `Dir`, `Pos`, `parse_map`, `serialize_map`, `map_info`                                                                        |
| `minescript-core/src/runtime/`       | `machine` (VM, eseménysor), `eval` (műveletek), `vm` (`run`, `run_program`), `trace`, `value`, `robot`, `error`                              |
| `minescript-core/tests/`             | `conformance`, `properties` (proptest), `samples` (seed-programok), `export_bindings`                                                        |
| `minescript-wasm`                    | wasm-bindgen exportok, JSON-kompatibilis szerializálás, magyar `JsError`                                                                     |
| `minescript-cli`                     | `minescript check`, `fmt`, `lint`, `run`, `ast`, `map-check`, ariadne-diagnosztikák                                                          |

## Invariánsok

- A core tiszta és determinisztikus: nincs IO, nincs idő, nincs véletlen, nincs wasm-bindgen.
- A core soha nem pánikol semmilyen bemenetre: nincs `unwrap`, `expect`, `panic`, indexelés helyett `get` (a Clippy kikényszeríti). A `parse_map_never_panics` tulajdonságteszt mintájára a parserhez és a VM-hez is kell ilyen.
- Minden `DiagCode`-hoz és `RuntimeErrorCode`-hoz magyar üzenet tartozik (teljes `match`, új kód nem maradhat ki), és a webes `i18n/hu.ts`-ben is szerepelnie kell.
- Minden új szabályhoz conformance-eset kell; az elvárt értéket a testing gazda vezeti le a specből.
- Határon átmenő típus: `Serialize + Deserialize + TS`, `#[serde(rename_all = "camelCase")]`, enumoknál `tag = "kind"`. Változás után `just types`, a generált fájlok commitolása.
- Az `#[ts(export)]` attribútumot nem használjuk (kommentfejlécet írna); az új gyökértípust az `tests/export_bindings.rs` listájába kell felvenni.

## Conformance

A `syntax_conformance`, a `runtime_conformance` és a `maps_conformance` mindig fut; a WASM-teszt és a referencia-interpreterrel végzett differenciális teszt is (`just conformance`). Új nyelvi szabályhoz előbb conformance-eset kell, és a referencia-interpreternek is követnie kell.

## Megvalósítási megjegyzések

- A soronkénti szintaxis-ellenőrzés sorrendje: szkennerhiba (`\r`, tab, üres sor), különben a sor első tokenszintű hibája oszlop szerint; azonos oszlopon a tokenosztály-hiba megelőzi a nyelvtani hibát. A `SYN_MISSING_TOKEN` a sor végén áll (az utolsó karakter utáni oszlopon), így a sorvégi szóköz megelőzi.
- `SYN_RESERVED_IDENT` csak azonosító helyén (a `set` neve, simpleval, a `calculatedval` első tagja) jön; rögzített kulcsszó és művelet helyén a rossz írásmód `SYN_UNEXPECTED_TOKEN`, utasítás helyén `SYN_UNKNOWN_COMMAND`. Blokkfejléc csak a pontos `if`, `while`, `else`.
- A javítások (`Fix`) csak akkor jelennek meg, ha biztosan helyesek: a kulcsszó-írásmód cseréje csak ott, ahol a kulcsszó elfogadott, az `1+2` és a `-5` szétbontása csak akkor, ha a sor utána nyelvtanilag helyes.
- A VM egy explicit veremmel járja be a blokkokat; minden feldolgozott sor egyetlen belépési ponton (`process`) megy át: limitellenőrzés, `steps += 1`, a sor hatásai, egy esemény.
- A formázó a D22 szerint először a szóközhibákat javítja, majd a sorokat az AST mélysége szerint húzza be (`indentWidth` 1 és 16 közé szorítva). Ha a javítás után is van hiba, az eredeti szöveget és az eredeti diagnosztikákat adja vissza.
- A linter súlyosságai: `LINT_LEADING_ZERO` és `LINT_TURN_MOD4` info, `LINT_MERGE_STEPS` és `LINT_MERGE_TURNS` hint, a többi figyelmeztetés. A `lint(program, source)` a forrást is megkapja a sortörlő javításokhoz.
- Térkép: soronként legfeljebb egy hiba (az első ismeretlen jel, különben a sorhossz), a `MAP_MULTIPLE_ROBOTS` egyszer, a második robotnál; a `MAP_EMPTY` az 1. sorra mutat.
