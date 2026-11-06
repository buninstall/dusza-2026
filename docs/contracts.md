# Szerződések

A típusok forrása a Rust (`crates/minescript-core`). Ha egy határon átmenő típus változik:

1. módosítsd a Rust-típust;
2. futtasd: `just types`;
3. commitold a `packages/engine/src/generated` változásait ugyanabban a commitban.

A CI a `just types` után `git diff --exit-code`-dal ellenőrzi, hogy a generált fájlok naprakészek.

Általános szabályok: minden mezőnév camelCase; az enumok `kind` címkével (`{ "kind": "ok" }`); a kódenumok SCREAMING_SNAKE_CASE stringek; a koordináták 0-alapúak; a diagnosztikák `line`/`colStart`/`colEnd` értéke 1-alapú, a `from`/`to` UTF-16 offset (D18).

## WASM API (`@minescript/engine`)

```ts
import { createEngine } from "@minescript/engine";
const engine = createEngine(await (await fetch(wasmUrl)).arrayBuffer());
```

| Függvény                | Visszatérés          | Megjegyzés                                                       |
| ----------------------- | -------------------- | ---------------------------------------------------------------- |
| `version()`             | `string`             | a core crate verziója                                            |
| `keywords()`            | `string[]`           | a 18 kulcsszó                                                    |
| `analyze(src)`          | `Analysis`           | `{ diagnostics, tokens, folds, symbols }`                        |
| `format(src, options?)` | `FormatResult`       | `{ text, changed, diagnostics }`, `options = { indentWidth: 4 }` |
| `complete(src, offset)` | `CompletionItem[]`   | `insertText` CodeMirror-snippet (`${név}`)                       |
| `hover(src, offset)`    | `Hover \| undefined` | `{ contents, span }`                                             |
| `parseMap(text)`        | `MapParseResult`     | `{ map: MineMap \| null, diagnostics }`                          |
| `serializeMap(map)`     | `string`             | kanonikus alak, záró `\n`-nel                                    |
| `mapInfo(map)`          | `MapInfo`            | `{ goldTotal, reachableGold, unreachable }`                      |
| `run(src, mapText)`     | `RunResult`          | hibás térképnél kivételt dob                                     |
| `astDump(src)`          | `string`             | a `ParseResult` JSON-ja                                          |

A futásidejű hibák `message` szövegei megegyeznek a `crates/minescript-core/src/runtime/error.rs` `message()` szövegeivel.

Hibás bemenet (például ellentmondásos `MineMap`) esetén a függvény nem pánikol, hanem magyar üzenetű `Error`-t dob.

### RunResult

```json
{
  "outcome": { "kind": "runtimeError", "code": "E_BEDROCK_HIT", "line": 1, "message": "…" },
  "events": [
    {
      "index": 0,
      "line": 1,
      "robot": { "pos": { "row": 0, "col": 1 }, "dir": "east" },
      "path": [{ "row": 0, "col": 1 }],
      "discovered": [],
      "mined": null,
      "gold": 0,
      "steps": 1,
      "print": null,
      "assigned": null
    }
  ],
  "gold": 0,
  "steps": 1,
  "console": [],
  "finalRobot": { "pos": { "row": 0, "col": 1 }, "dir": "east" },
  "discovered": [{ "row": 0, "col": 0 }, { "row": 0, "col": 1 }]
}
```

- Az eseménysor pontos szabályai: [D20](dontesek.md#d20--a-futás-eseménysora-trace). Röviden: `events[i]` az i-edik feldolgozott sor **utáni** állapot; a `steps` az addig feldolgozott sorok száma.
- `path`: az ebben a lépésben bejárt mezők sorrendben; `discovered`: az ebben a lépésben újonnan felfedezett mezők (például `isThere` célmezője).
- `outcome.kind`: `ok` | `runtimeError` (`code`, `line`, `message`) | `syntaxError` (`diagnostics`, ilyenkor `events` üres).
- `assigned`: `{ name, value }`, ahol `value` `{ "kind": "int", "value": 5 }` vagy `{ "kind": "bool", "value": true }`.

### Diagnostic

```json
{
  "code": "MAP_ROW_LENGTH",
  "severity": "error",
  "span": { "line": 3, "colStart": 1, "colEnd": 3, "from": 8, "to": 10 },
  "message": "Ez a sor 2 jelből áll, de a fejléc szerint 3 kell.",
  "help": null,
  "fixes": [{ "title": "…", "edits": [{ "from": 8, "to": 10, "insert": "…" }] }]
}
```

`severity`: `error` | `warning` | `info` | `hint`. A kódok listája: `packages/engine/src/generated/DiagCode.ts`, a futásidejű hibakódoké: `RuntimeErrorCode.ts`.

## REST API (`/api`)

Minden válasz JSON. Hiba esetén egységes formátum:

```json
{
  "error": {
    "code": "MAP_INVALID",
    "message": "A térkép nem felel meg a szabályoknak.",
    "details": []
  }
}
```

A nem-GET kérésekhez `Origin` fejléc kell, ami egyezik a hosttal (különben `403 CSRF_ORIGIN`). A védett végpontokhoz `ms_session` cookie kell (különben `401 UNAUTHENTICATED`). A web a típusos `hc<AppType>` klienst használja (`apps/web/src/lib/api.ts`).

Minden végpontra érvényes:

- A kérés törzse legfeljebb 1 MiB (különben `413 PAYLOAD_TOO_LARGE`, `Connection: close`). A nem JSON törzs `400 VALIDATION` („A kérés törzse nem érvényes JSON.”).
- A `:id` és a `?version=` csak tizes számrendszerbeli pozitív egész lehet (`^[1-9][0-9]{0,14}$`, különben `400 VALIDATION`); a nem létező azonosító `404 NOT_FOUND`.
- A mezőhibák (`details[i] = { path, message }`) üzenete magyar. A párosítatlan UTF-16 helyettesítő kódot tartalmazó szöveg `400 VALIDATION`.
- A cím (térkép, program) sortörései, tabulátorai és vezérlőkarakterei egy szóközzé válnak, a cím végeiről a szóköz lekerül, és kell benne látható karakter. A leírásban a `\r\n` és a `\r` `\n`-né válik, a `\n` és a tab kivételével a vezérlőkarakterek törlődnek.

### Rendszer és hitelesítés

| Metódus és útvonal        | Kérés                    | Válasz                                                                 |
| ------------------------- | ------------------------ | ---------------------------------------------------------------------- |
| `GET /api/health`         | –                        | `200 { ok: true, engineVersion }`                                      |
| `POST /api/auth/register` | `{ username, password }` | `201 { user }`; `400 VALIDATION`, `409 USERNAME_TAKEN`                 |
| `POST /api/auth/login`    | `{ username, password }` | `200 { user }` + cookie; `401 INVALID_CREDENTIALS`, `429 RATE_LIMITED` |
| `POST /api/auth/logout`   | –                        | `200 { ok: true }`, a cookie törlődik                                  |
| `GET /api/auth/me`        | –                        | `200 { user }`; `401`                                                  |

A felhasználónév 3–24 karakter `[A-Za-z0-9_]`, kis- és nagybetűtől függetlenül egyedi; a jelszó legalább 8 karakter. `user = { id, username, role: "admin" | "user", createdAt }`.

Példa:

```http
POST /api/auth/login
Origin: http://127.0.0.1:8080
Content-Type: application/json

{ "username": "demo1", "password": "demo2026" }
```

```json
{ "user": { "id": 2, "username": "demo1", "role": "user", "createdAt": 1793960000000 } }
```

### Térképek

| Metódus és útvonal                                  | Kérés                                           | Válasz                                                                     |
| --------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------- |
| `GET /api/maps?scope=all\|mine`                     | –                                               | `200 { maps: MapSummary[] }`                                               |
| `POST /api/maps`                                    | `{ title, description?, visibility?, content }` | `201 { map, warnings }`; `422 MAP_INVALID` (`details`: diagnosztikák)      |
| `GET /api/maps/:id`                                 | –                                               | `200 { map, version, info, warnings, versions, runCount, canEdit }`; `404` |
| `PUT /api/maps/:id`                                 | bármely mező a fentiekből                       | `200 { map, createdNewVersion }`; `403`, `422`                             |
| `DELETE /api/maps/:id`                              | –                                               | `200 { ok: true }` (tulajdonos vagy admin)                                 |
| `GET /api/maps/:id/export`                          | –                                               | `text/plain`, `Content-Disposition: attachment; filename="<cím>.txt"`      |
| `GET /api/maps/:id/leaderboard?version=<versionId>` | –                                               | `200 { mapId, title, versionId, currentVersionId, versions, entries }`     |

`MapSummary = { id, title, description, visibility, ownerId, ownerName, createdAt, updatedAt, versionId, version, content, rows, cols, goldTotal, reachableGold }`.

`entries[i] = { rank, runId, userId, username, gold, steps, outcomeKind, createdAt }`, felhasználónként a legjobb futás, `gold DESC, steps ASC, createdAt ASC` sorrendben (D13). A tartalom módosítása futás után új verziót hoz létre (D14).

### Programok, futások, saját adatok

| Metódus és útvonal         | Kérés                      | Válasz                                                                    |
| -------------------------- | -------------------------- | ------------------------------------------------------------------------- |
| `GET /api/programs`        | –                          | `200 { programs: { id, title, updatedAt }[] }`                            |
| `POST /api/programs`       | `{ title, source }`        | `201 { program }`                                                         |
| `GET /api/programs/:id`    | –                          | `200 { program }` (csak a saját)                                          |
| `PUT /api/programs/:id`    | `{ title?, source? }`      | `200 { program }`                                                         |
| `DELETE /api/programs/:id` | –                          | `200 { ok: true }`                                                        |
| `POST /api/runs`           | `{ mapVersionId, source }` | `201 { run, outcome, console }`; `422 SYNTAX_ERROR` (nem mentődik); `404` |
| `GET /api/runs/:id`        | –                          | `200 { run, map: { content } }`; `404` (nem a sajátod és nem vagy admin)  |
| `GET /api/me/runs`         | –                          | `200 { runs }` (legutóbbi 100)                                            |

A `POST /api/runs` a kliens által küldött egyéb mezőket (például `gold`) figyelmen kívül hagyja: az eredményt a szerver számolja.

A `GET /api/runs/:id` a visszajátszáshoz adja vissza egy futás adatait. Csak a futás gazdája és az admin olvashatja; mindenki más, illetve a nem létező azonosító `404 NOT_FOUND`. A `map.content` annak a térképverziónak a kanonikus tartalma, amelyen a futás történt (nem az aktuális verzióé), így az `engine.run(run.source, map.content)` pontosan ugyanazt az eseménysort adja:

```json
{
  "run": {
    "id": 1,
    "mapId": 3,
    "mapTitle": "3. Kis labirintus",
    "mapVersionId": 7,
    "version": 1,
    "gold": 3,
    "steps": 24,
    "outcomeKind": "ok",
    "errorCode": null,
    "errorLine": null,
    "createdAt": 1793960000000,
    "source": "step forward 3\n…"
  },
  "map": { "content": "7 7\n…" }
}
```

A `GET /api/me/runs` elemei ugyanezek a mezők a `source` nélkül.

### Adminisztráció (csak admin)

| Metódus és útvonal            | Kérés      | Válasz                                           |
| ----------------------------- | ---------- | ------------------------------------------------ |
| `GET /api/admin/users`        | –          | `200 { users }`                                  |
| `PATCH /api/admin/users/:id`  | `{ role }` | `200 { user }`; `409 SELF_CHANGE` a saját fiókra |
| `DELETE /api/admin/users/:id` | –          | `200 { ok: true }`; `409 SELF_CHANGE`            |

## Fixture-formátumok

A conformance-esetek formátuma: [`conformance/README.md`](../conformance/README.md).
