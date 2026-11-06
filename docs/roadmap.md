# Roadmap

Prioritások: **P1** = a spec kötelező része, nélküle a beadás hiányos. **P2** = minőségi plusz, ami az értékelésben számít. **P3** = extra, ha marad idő.

Szerepek: **rust** (gergogyulai) – `crates/`, `packages/engine` kötés; **web** (futozs) – `apps/web`, `apps/server`, release; **testing** (hgagadev) – `conformance/`, `tools/reference-interpreter`, `e2e/`, beadandó.

## rust

### P1

- [ ] Szkenner: sorokra bontás, behúzás, tokenizálás, `SYN_TAB`, `SYN_EMPTY_LINE`, `SYN_DOUBLE_SPACE`, `SYN_TRAILING_SPACE`, `SYN_LONE_CR` (D2, D3), a `scanner::raw_lines` kiinduló API-ra építve.
- [ ] Parser: a 8 utasítás és a `calculatedval` minden alakja, blokk-felépítés behúzás alapján, minden `SYN_*` kód (D4, D5, D17), a `SYN_NOT_IMPLEMENTED` stub eltávolítása.
- [ ] VM: `run()` teljes trace-szel, lépésszámlálás (D7), robot API (D8, D9, D11, D12), minden futásidejű hiba és a hibaelsőbbség (D6, D10), `E_INT_OVERFLOW`.
- [ ] A `#[ignore]` levétele a `syntax_conformance` és `runtime_conformance` tesztről, a `CONFORMANCE` feltétel levétele a WASM-tesztből, a CI conformance-jobjának `continue-on-error` törlése.
- [ ] Futásidejű hibák magyar `message` szövege az `Outcome::RuntimeError`-ban (a `RuntimeErrorCode::message` alapján, a sor számával).

### P2

- [ ] Formatter: kanonikus 4 szóközös behúzás, egy szóköz a tokenek között, `changed` jelzés.
- [ ] Linter: `LINT_UNUSED_VAR`, `LINT_MAYBE_UNINIT`, `LINT_EMPTY_BLOCK`, `LINT_LEADING_ZERO`, `LINT_ISTHERE_RANGE`, `LINT_TURN_MOD4`, `LINT_MERGE_STEPS`, `LINT_MERGE_TURNS`, `LINT_NOOP`, `LINT_CASE_COLLISION`, `LINT_TYPE_CHANGE`, `LINT_NON_BOOL_LITERAL_CONDITION`.
- [ ] Hibajavítási javaslatok (`Fix`): sorvégi szóköz törlése, dupla szóköz, tab cseréje, `1+2` → `1 + 2`, `-5` → `0 - 5`, kis-/nagybetűs kulcsszó javítása.
- [ ] IDE: `SemanticToken`, `FoldRange`, `Symbol`; változónév-kiegészítés a `set` után és az értékhelyeken.
- [ ] `wasm-opt` a CI-ban, a `.wasm` méretének figyelése.

### P3

- [ ] Golf-tippek (rövidebb program ugyanannyi aranyra).
- [ ] AST-nézet a `astDump` alapján.
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

- [ ] A conformance-készlet bővítése: minden spec-szabályhoz legalább egy eset (lásd `docs/tesztterv.md`, „hiányzik” sorok).
- [ ] Referencia-interpreter (`tools/reference-interpreter/src/index.ts`) a specből és a D-döntésekből.
- [ ] `docs/beadando.md` kitöltése a végleges funkciókkal és képernyőképekkel.
- [ ] Demó-tartalom: a seed mintaprogramjainak ellenőrzése a kész VM-mel (`--reset-demo`).

### P2

- [ ] Programgenerátor (`src/generate.ts`) és differenciális teszt (`REFERENCE=1`).
- [ ] e2e: térképszerkesztő (festés, import, export, mentés), lejátszás (szünet, léptetés, leállítás), ranglista.
- [ ] Vizuális regresszió 320 / 768 / 1024 / 1440 px-en.

### P3

- [ ] Teljesítménymérés: 1000 lépéses trace lejátszása, Lighthouse.
