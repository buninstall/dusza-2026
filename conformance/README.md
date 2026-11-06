# Conformance-esetek

Ez a könyvtár a MineScript viselkedésének gépileg ellenőrizhető specifikációja. Ugyanezeket az eseteket futtatja a Rust-teszt (`crates/minescript-core/tests/conformance.rs`), a WASM-teszt (`packages/engine/test/conformance.test.ts`) és később a referencia-interpreter összevetése is.

Futtatás: `just conformance`.

## Szerkezet

Esetenként egy könyvtár, a neve `<nnn>-<slug>` (például `003-step-into-wall`). A sorszám a sorrendet adja, a slug röviden leírja az esetet. A fájlok bájtpontosak: a `.gitattributes` a `*crlf*` nevű esetekben megtartja a CRLF-et, és a sorvégi szóközt nem jelzi hibának.

### runtime/

| Fájl | Tartalom |
| --- | --- |
| `program.ms` | A futtatandó program. |
| `map.txt` | A térkép az 1. fejezet formátumában. |
| `expected.json` | Az elvárt eredmény. |

```json
{
  "description": "Rövid magyar leírás",
  "specRefs": ["2.2.3"],
  "decisions": ["D8"],
  "outcome": { "kind": "runtimeError", "code": "E_BEDROCK_HIT", "line": 1 },
  "gold": 0,
  "steps": 1,
  "console": [],
  "robot": { "row": 0, "col": 1, "dir": "east" }
}
```

- `outcome.kind`: `ok` | `runtimeError` | `syntaxError`; `code` és `line` csak `runtimeError` esetén.
- `robot` opcionális; 0-alapú `row`/`col`, az irány `north` | `east` | `south` | `west`.
- `steps` a feldolgozott sorok száma (D7), `gold` a kibányászott arany.

### syntax/

`program.ms` és `expected.json`:

```json
{ "description": "…", "specRefs": ["2.1"], "decisions": ["D3"], "valid": false, "diagnostics": [{ "code": "SYN_TAB", "line": 2 }] }
```

A `diagnostics` a hiba súlyosságú diagnosztikák listája sorszám szerint rendezve. A lint-figyelmeztetéseket a teszt nem vizsgálja.

### maps/

`map.txt` és `expected.json`:

```json
{ "valid": true, "goldTotal": 2, "reachableGold": 2, "warnings": [] }
{ "valid": false, "diagnostics": [{ "code": "MAP_ROW_LENGTH", "line": 3 }] }
```

A `line` a fájl 1-alapú sorszáma, és opcionális: ha hiányzik, csak a kódot ellenőrizzük. A `warnings` (ha megadott) a figyelmeztetések kódjainak listája.

## Szabályok

- Az elvárt értékeket kizárólag a specből (`docs/feladat.md`) és a D-döntésekből (`docs/dontesek.md`) vezetjük le, kézzel. Soha nem a Rust-implementáció kimenetéből.
- Minden új nyelvi szabályhoz és minden új D-döntéshez legalább egy eset tartozik.
- A `docs/tesztterv.md` spec-mátrixa minden esetre hivatkozik.
