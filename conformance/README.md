# Conformance-esetek

Ez a könyvtár a MineScript viselkedésének gépileg ellenőrizhető specifikációja. Ugyanezeket az eseteket futtatja a Rust-teszt (`crates/minescript-core/tests/conformance.rs`), a WASM-teszt (`packages/engine/test/conformance.test.ts`) és a referencia-interpreter (`tools/reference-interpreter`). A WASM-teszt `conformance: referencia-interpreter` blokkja mindig fut: a kézzel levezetett elvárásokat a referencián is ellenőrzi.

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
- `outcome.diagnostics` (opcionális, csak `syntaxError` esetén): a várt hibadiagnosztikák `{ code, line }` alakban, ugyanúgy ellenőrizve, mint a `syntax/` eseteknél.
- `robot` opcionális; 0-alapú `row`/`col`, az irány `north` | `east` | `south` | `west`.
- `steps` a feldolgozott sorok száma (D7), `gold` a kibányászott arany.
- `discovered` (opcionális): a futás végén felfedezett összes mező `{ row, col }` alakban, a felfedezés sorrendjében, az első a kezdőmező (D11, D20).
- `events` (opcionális): a teljes elvárt eseménysor a `RunResult.events` alakjában (`index`, `line`, `robot`, `path`, `discovered`, `mined`, `gold`, `steps`, `print`, `assigned`, D20). Ha megadott, pontos egyezést várunk.

### syntax/

`program.ms` és `expected.json`:

```json
{ "description": "…", "specRefs": ["2.1"], "decisions": ["D3"], "valid": false, "diagnostics": [{ "code": "SYN_TAB", "line": 2 }] }
```

A `diagnostics` a hiba súlyosságú diagnosztikák listája sor, azon belül oszlop szerint rendezve. A `col` opcionális: a diagnosztika 1-alapú kezdőoszlopa (`span.colStart`); csak ott adjuk meg, ahol a D19 rögzíti a pozíciót (a hibás token eleje, a dupla szóköznél a második szóköz, a sorvégi szóköznél az első sorvégi szóköz). A lint-figyelmeztetéseket a teszt nem vizsgálja.

### maps/

`map.txt` és `expected.json`:

```json
{ "valid": true, "goldTotal": 2, "reachableGold": 2, "warnings": [] }
{ "valid": false, "diagnostics": [{ "code": "MAP_ROW_LENGTH", "line": 3 }] }
```

A `line` a fájl 1-alapú sorszáma, és opcionális: ha hiányzik, csak a kódot ellenőrizzük. A `warnings` (ha megadott) a figyelmeztetések kódjainak listája. Érvényes térképnél opcionális még a `robot` (`{ row, col, dir }`, a kezdőhelyzet) és az `unreachable` (az elérhetetlen aranyak `{ row, col }` listája sorfolytonos sorrendben, a `mapInfo` szerint).

## Szabályok

- Az elvárt értékeket kizárólag a specből (`docs/feladat.md`) és a D-döntésekből (`docs/dontesek.md`) vezetjük le, kézzel. Soha nem a Rust-implementáció kimenetéből.
- Minden új nyelvi szabályhoz és minden új D-döntéshez legalább egy eset tartozik.
- Az ismeretlen mezőket a Rust-teszt figyelmen kívül hagyja, az opcionális mezőket a WASM- és a referenciateszt ellenőrzi.
- A `docs/tesztterv.md` spec-mátrixa a legtöbb esetre hivatkozik; a hivatkozás nélküli esetek (r111, r112, r117–r120, s130, m055–m058) pótlandók.

A csapat AI-használatának leírása: [ai.md](../docs/ai.md).
