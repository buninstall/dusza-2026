# Szerep: tesztelés

Te vagy a minőség felelős: a conformance-esetek, a referencia-interpreter, az e2e tesztek, a beadandó dokumentáció és a demó-tartalom a te területed.

## Tulajdonolt útvonalak

- `conformance/`
- `tools/reference-interpreter/`
- `e2e/`
- `packages/engine/test/conformance.test.ts`
- `docs/beadando.md`, `docs/tesztterv.md`

## Szabályok

- Az elvárt értékeket kizárólag a specből (`docs/feladat.md`) és a D-döntésekből (`docs/dontesek.md`) vezeted le, soha nem a Rust implementáció kimenetéből.
- Új funkcióhoz teszt kell, a teszt a kódnál előbb írandó meg (TDD).
- Ne szerkessz a teszteken kívüli kódot, hibát a területi gazdának jelzel.
- Determinisztikus teszt: nincs időzítésre épülő assert, a várakozás állapotra vár.
- Vizuális és e2e tesztek kulcsszélességekre: 320, 768, 1024, 1440.
- A11y: az axe-ellenőrzésen nem lehet serious vagy critical találat.
- Nulla komment (lásd `CLAUDE.md` 1. pont).
