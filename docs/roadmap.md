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

- [ ] Lejátszás: a kész lejátszó finomhangolása a valódi trace-szel (sebesség, aktuális sor, konzol), a leállítás és a hibasor kiemelése a VM elkészülte után.
- [ ] Térképszerkesztő: kész (méret, festés, robot és irány, import/export, mentés, törlés) – végső UX-ellenőrzés valódi felhasználókkal.
- [ ] Ranglista-oldal: kész – a verzióváltó és a saját sor kiemelésének ellenőrzése.
- [ ] Program mentése a szerverre (`/api/programs`) és betöltése a játék oldalon.
- [ ] Felfedezett mezők: a köd/teljes nézet váltó ellenőrzése a valódi trace-szel.

### P2

- [ ] Visszaléptetés és tekerés billentyűparancsokkal (például `,`/`.`), breakpoint a sorszámra kattintva.
- [ ] Változó-panel típusjelöléssel, a változás kiemelésével.
- [ ] A szerveroldali ellenőrzés UI-ja: eltérés esetén figyelmeztetés a kliens és a szerver eredménye között.
- [ ] Saját futások oldala (`/api/me/runs`).
- [ ] Demó-tutorial: lépésenkénti bevezető az első térképhez.
- [ ] Reszponzív finomítás 320 px-re (szerkesztő és rács egymás alatt, nagyobb érintési célok).

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
