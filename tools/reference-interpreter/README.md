# @minescript/reference

A MineScript független, TypeScriptben írt referencia-interpretere differenciális teszteléshez. A gazdája a minőségért felelős tag (lásd `.claude/roles/testing.md`).

## Módszer

1. A `src/index.ts` `run(src, mapText)` függvénye kizárólag a specifikáció (`docs/feladat.md`) és az értelmezési döntések (`docs/dontesek.md`) alapján készül. A Rust-forrásba nem nézünk bele, hogy a két implementáció ne ugyanazt a hibát kövesse el.
2. A visszatérési típus ugyanaz a `RunResult`, amit a Rust-motor a `@minescript/engine`-en keresztül ad, így a két kimenet mezőről mezőre összevethető.
3. A `src/generate.ts` seedelhető PRNG-vel (`src/prng.ts`, mulberry32) szintaktikailag helyes, véletlen programokat és térképeket állít elő. Ugyanaz a seed mindig ugyanazt az esetet adja, így egy eltérés pontosan reprodukálható.
4. A `test/diff.test.ts` először a `conformance/runtime` eseteken, majd a generált programokon veti össze a referenciát a WASM-motorral.

## Futtatás

```bash
just wasm
bun test --cwd tools/reference-interpreter
```

Az összevetés alapból ki van kapcsolva; bekapcsolni a `REFERENCE=1` környezeti változóval lehet, amikor a referencia-interpreter és a motor is elkészült.

## Állapot

A `run` és a `generateProgram` még szándékosan hibát dob; a PRNG kész és tesztelt. A hátralévő munka a `docs/roadmap.md`-ben van.
