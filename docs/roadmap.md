# Roadmap

Prioritások: **P1** = a spec kötelező része, nélküle a beadás hiányos. **P2** = minőségi plusz, ami az értékelésben számít. **P3** = extra, ha marad idő.

Szerepek: **rust** (gergogyulai) – `crates/`, `packages/engine` kötés; **web** (futozs) – `apps/web`, `apps/server`, release; **testing** (hgagadev) – `conformance/`, `tools/reference-interpreter`, `e2e/`, beadandó.

## rust

### P1

- [x] Szkenner és parser a D19 és a D24 szerint, minden `SYN_*` kóddal és biztonságos javításokkal.
- [x] VM a D6–D12, D20 és D21 szerint, minden futásidejű hibával és a lépéskorláttal.
- [x] A conformance-tesztek bekapcsolva (293 eset), a WASM-teszt és a differenciális teszt kapu nélkül fut.

### P2

- [x] Formázó (D22, D25), linter (minden `LINT_*` kód), szemantikus tokenek, blokkhatárok, szimbólumok, környezetfüggő kiegészítés és súgó.
- [ ] `wasm-opt` a CI-ban, a `.wasm` méretének figyelése.
- [ ] A már nem használt `SYN_NOT_IMPLEMENTED` kód eltávolítása (a frontend összefésülése után).

### P3

- [ ] Golf-tippek (rövidebb program ugyanannyi aranyra).
- [ ] LSP-szerver a core-ból (VS Code-bővítményhez).

## web

### P1

- [x] Lejátszás a valódi trace-szel: lassított futás állítható sebességgel, az aktuális sor kiemelése, konzol, arany- és lépésszámláló, leállítás, a hibakód és a hibás sor jelölése.
- [x] Térképszerkesztő: méret (1–15), festés, robot és kezdőirány, import/export, élő ellenőrzés, csak érvényes térkép menthető, törlés.
- [x] Ranglista-oldal: térképenként és verziónként, több arany előrébb, egyenlőségnél a kevesebb lépés; verzióváltó és a saját sor kiemelése.
- [x] Program mentése a szerverre (`/api/programs`) és betöltése a játék oldalon (Programtár).
- [x] Felfedezett mezők: „Lámpafény” (csak a bejárt és az `isThere`-rel vizsgált mezők) és „Teljes térkép” nézet.
- [x] Programfájl importja: a szintaktikai hibás fájl betöltésekor hibaüzenet jelzi a hibák számát és az első hibás sort.

### P2

- [ ] Visszaléptetés és tekerés billentyűparancsokkal (például `,`/`.`), breakpoint a sorszámra kattintva.
- [x] Változó-panel típusjelöléssel.
- [ ] A szerveroldali ellenőrzés UI-ja: eltérés esetén figyelmeztetés a kliens és a szerver eredménye között.
- [x] Saját futások oldala (`/api/me/runs`).
- [ ] Demó-tutorial: lépésenkénti bevezető az első térképhez.
- [x] Reszponzív finomítás 320 px-re (a panelek egymás alá kerülnek, a nagy térkép a saját keretében görgethető).

### P3

- [ ] Saját futások visszajátszása és megosztható visszajátszás-link.
- [ ] Elérhetőségi vizualizáció (BFS-terület) a szerkesztőben.
- [ ] Pályagenerátor.

## testing

### P1

- [x] Conformance-készlet: 293 kézzel levezetett eset, minden spec-szabályra és D-döntésre (`docs/tesztterv.md`).
- [x] Független referencia-interpreter a specből, 100% sorlefedettséggel.
- [x] Seedelt generátor és differenciális teszt (2000 seed minden futáskor, egyszeri próbán 30 000 eltérés nélkül).
- [ ] `docs/beadando.md` kitöltése a végleges funkciókkal és képernyőképekkel.
- [ ] Demó-tartalom ellenőrzése a kész motorral (`--reset-demo`).

### P2

- [ ] e2e: a kiírás minden funkciója a felületen keresztül, 320 / 768 / 1024 / 1440 px-en, mindkét témában.

### P3

- [ ] Teljesítménymérés: 1000 lépéses trace lejátszása, Lighthouse.
