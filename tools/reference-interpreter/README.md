# @minescript/reference

A MineScript független, TypeScriptben írt referencia-interpretere differenciális teszteléshez. A gazdája a minőségért felelős tag (lásd `.claude/roles/testing.md`).

## Módszer

1. A referencia kizárólag a specifikáció (`docs/feladat.md`) és az értelmezési döntések (`docs/dontesek.md`) alapján készül. A Rust-forrásba nem nézünk bele, hogy a két implementáció ne ugyanazt a hibát kövesse el.
2. A visszatérési típusok a `@minescript/engine` generált típusai (`RunResult`, `Diagnostic`, `MineMap`, `MapInfo`, `Program`), így a két kimenet mezőről mezőre összevethető.
3. A `src/generate.ts` seedelhető PRNG-vel (`src/prng.ts`, mulberry32) szintaktikailag helyes, véletlen programokat és érvényes térképeket állít elő, és a helyes programok mutálásával szintaktikailag hibásakat is. Ugyanaz a seed mindig ugyanazt az esetet adja.
4. A `test/diff.test.ts` a conformance-eseteken és 2000 generált seeden veti össze a referenciát a WASM-motorral.

## Modulok

| Fájl              | Tartalom                                                             |
| ----------------- | -------------------------------------------------------------------- |
| `src/source.ts`   | normalizálás (BOM, CRLF, záró újsor, D2), sorokra bontás, konstansok |
| `src/scanner.ts`  | sorszintű hibák és tokenosztályok (D3, D5, D19)                      |
| `src/grammar.ts`  | egy sor nyelvtana, az első tokenszintű hiba kiválasztása (D17, D19)  |
| `src/parser.ts`   | behúzásverem, else-szabály, AST, `check` és `parse` (D4, D19)        |
| `src/map.ts`      | `parseMapText` és `mapInfo` (D2, D15)                                |
| `src/evaluate.ts` | értékek olvasása, műveletek, túlcsordulás (D6, D10, D21)             |
| `src/machine.ts`  | `run`: lépésszámlálás, robot API, eseménysor (D7–D12, D16, D20)      |
| `src/generate.ts` | `generateProgram`, `generateMap`, `generateInvalidProgram`           |

## Futtatás

```bash
bun test --cwd tools/reference-interpreter
bun test --coverage --cwd tools/reference-interpreter
just wasm
bun test --cwd tools/reference-interpreter test/diff.test.ts
```

Az összevetés minden tesztfuttatáskor lefut (a `just wasm` után); a generált esetek száma a `DIFF_SEEDS` környezeti változóval növelhető. Eltérésnél a teszt kiírja a seedet, a programot, a térképet és az első eltérő mezőt. Egy seed újrafuttatása: `generateProgram(seed)` vagy `generateInvalidProgram(seed)`.
