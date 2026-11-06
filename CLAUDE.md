# Dusza-2026 — csapat szabályok

Ez a fájl minden gépen betöltődik. A gépi szerepkör a `CLAUDE.local.md`-ből jön (lásd 4. pont).

## 1. Nulla komment

A repóban SEHOL nincs komment. Nincs kivétel.

- Nem írunk kommentet: kód, konfig, `.gitignore`, shell, YAML, SQL, Markdown HTML-komment, docstring, `TODO`/`FIXME`, inline magyarázat.
- Ha egy fájlt szerkesztesz, a régi kommenteket is töröld belőle.
- Commit előtt: `git diff --cached` ne tartalmazzon komment-jellegű sort.
- Ha egy nyelv működéshez megköveteli (pl. shebang `#!`), az nem komment, az marad.
- A commit üzenet és a PR leírás nem komment; a magyarázat oda való.

## 2. Git

- Main-re soha nem commitolunk és nem pusholunk közvetlenül.
- Mindenki a saját branchén dolgozik: `claude.teamflowBranch` (GitHub login).
- A commit és a push automatikus (team-sync hook). Conventional commit formátum: `<type>: <leírás>`, attribúció nélkül.
- Force push tilos.

## 3. Konfliktusmentes munkamegosztás

A konfliktus oka mindig az, hogy két ember ugyanazt a fájlt szerkeszti. Ezért a fájlok tulajdonosa egy ember.

- Mindenki csak a saját szerepének útvonalait szerkeszti (lásd `.claude/roles/`).
- Más területen hiba van? Nem javítod, hanem jelzed a csapatnak, és a terület gazdájának szólsz.
- Közös fájlok: `CLAUDE.md`, `AGENTS.md`, `.gitignore`, gyökér konfigurációk, csomagmanifesztek és lockfile-ok. Ezeket csak a csapat által kijelölt `shared` gazda módosítja, külön commitban, és szólnia kell a többieknek.
- Lockfile-t kézzel nem szerkesztünk. Az a terület gazdájának eszköze generálja.
- Kis, gyakori commitok. Ne halmozz fel nagy, több területet érintő változást.

## 4. Szerepkör gépenként

- A repóban három szerepfájl van: `.claude/roles/backend.md`, `.claude/roles/frontend.md`, `.claude/roles/testing.md`. Mindenki csak a sajátját szerkeszti.
- Minden gépen létrehozol egy `CLAUDE.local.md` fájlt, benne egyetlen sor a saját szereppel:

```
@.claude/roles/backend.md
```

- A `CLAUDE.local.md` gépi fájl, a `.gitignore` kizárja, soha nem kerül fel.

## 5. Ami nem kerül fel

A `.gitignore` kizárja a gépi adatokat: memória, session-előzmények, lokális beállítások, a `docs/` mappa és minden `*.local.*` fájl. A felkerülő Claude-tartalom csak ez: `CLAUDE.md`, `AGENTS.md`, `.claude/agents/`, `.claude/skills/`, `.claude/commands/`, `.claude/rules/`, `.claude/roles/`, `.claude/hooks/`, `.claude/settings.json`.
