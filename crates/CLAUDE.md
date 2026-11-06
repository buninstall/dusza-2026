# crates/

## Modultérkép

| Crate / modul                              | Tartalom                                                                               |
| ------------------------------------------ | -------------------------------------------------------------------------------------- |
| `minescript-core/src/source.rs`            | normalizálás (BOM, CRLF, D2), sorokra bontás, sor ↔ UTF-16 offset                      |
| `minescript-core/src/span.rs`              | `Span { line, colStart, colEnd, from, to }` (D18)                                      |
| `minescript-core/src/diagnostics/`         | `Diagnostic`, `DiagCode`, `Severity`, `Fix`, magyar üzenetek (`messages.rs`)           |
| `minescript-core/src/syntax/`              | `keywords`, `token`, `ast`, `scanner` (`raw_lines`), `parser` (`parse`, jelenleg stub) |
| `minescript-core/src/format/`              | `format`, `FormatOptions` (stub)                                                       |
| `minescript-core/src/lint/`                | `lint` (stub)                                                                          |
| `minescript-core/src/ide/`                 | `analyze`, `complete` (valódi), `hover` (valódi, kulcsszó-súgó)                        |
| `minescript-core/src/map/`                 | `Map`, `Cell`, `Dir`, `Pos`, `parse_map`, `serialize_map`, `map_info` (kész)           |
| `minescript-core/src/runtime/`             | `Value`, `RuntimeErrorCode`, `RobotState`, `Event`, `RunResult`, `run` (VM stub)       |
| `minescript-core/tests/conformance.rs`     | a `conformance/` esetek futtatása                                                      |
| `minescript-core/tests/export_bindings.rs` | ts-rs export (`just types` futtatja)                                                   |
| `minescript-wasm`                          | wasm-bindgen exportok, JSON-kompatibilis szerializálás, magyar `JsError`               |
| `minescript-cli`                           | `minescript check                                                                      | fmt | lint | run | ast | map-check`, ariadne-diagnosztikák |

## Invariánsok

- A core tiszta és determinisztikus: nincs IO, nincs idő, nincs véletlen, nincs wasm-bindgen.
- A core soha nem pánikol semmilyen bemenetre: nincs `unwrap`, `expect`, `panic`, indexelés helyett `get` (a Clippy kikényszeríti). A `parse_map_never_panics` tulajdonságteszt mintájára a parserhez és a VM-hez is kell ilyen.
- Minden `DiagCode`-hoz és `RuntimeErrorCode`-hoz magyar üzenet tartozik (teljes `match`, új kód nem maradhat ki), és a webes `i18n/hu.ts`-ben is szerepelnie kell.
- Minden új szabályhoz conformance-eset kell; az elvárt értéket a testing gazda vezeti le a specből.
- Határon átmenő típus: `Serialize + Deserialize + TS`, `#[serde(rename_all = "camelCase")]`, enumoknál `tag = "kind"`. Változás után `just types`, a generált fájlok commitolása.
- Az `#[ts(export)]` attribútumot nem használjuk (kommentfejlécet írna); az új gyökértípust az `tests/export_bindings.rs` listájába kell felvenni.

## A conformance bekapcsolása

Amikor a parser és a VM elkészül:

1. vedd le az `#[ignore]`-t a `syntax_conformance` és a `runtime_conformance` tesztről (`tests/conformance.rs`);
2. szólj a testing gazdának, hogy a `packages/engine/test/conformance.test.ts`-ből vegye ki a `CONFORMANCE` feltételt;
3. szólj a web gazdának, hogy a CI conformance-jobjából törölje a `continue-on-error`-t;
4. futtasd: `just conformance`.
