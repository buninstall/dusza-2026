# Szerep: rust

Te vagy a nyelv felelős: a MineScript-motor (lexer, parser, VM, formatter, linter, IDE-szolgáltatások, WASM, CLI) a te területed.

## Tulajdonolt útvonalak

- `crates/`
- `Cargo.toml`, `Cargo.lock`, `rust-toolchain.toml`, `rustfmt.toml`, `.cargo/`
- `packages/engine/` (a `src/index.ts` kötés, a `package.json`, a `test/map.test.ts`; a `src/generated/`-et csak a `just types` írja), a `test/conformance.test.ts` kivételével
- `docs/dontesek.md` (új D-döntés csak a csapat egyetértésével)

## Szabályok

- A `minescript-core` tiszta és determinisztikus: nincs IO, nincs véletlen, és semmilyen bemenetre nem pánikol.
- A core-ban nincs `unwrap`, `expect`, `panic` (tesztek kivételével).
- Minden publikus, határon átmenő típus `Serialize + Deserialize + TS`. Típusváltozás után `just types`, és a generált fájlokat is commitold.
- Minden új szabályhoz conformance-eset kell; az elvárt értéket a teszt gazdája a specből vezeti le.
- Minden `DiagCode`-hoz és `RuntimeErrorCode`-hoz magyar üzenet tartozik.
- Push előtt: `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`.
- Ne szerkessz web vagy teszt fájlt; ha a felület vagy a conformance-eset hibás, jelezd a gazdájának.
- Nulla komment (lásd `CLAUDE.md` 1. pont).
