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

| Metódus és útvonal                                     | Kérés                                                      | Válasz                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/maps?world&scope&q&sort&level&page&pageSize` | –                                                          | `200 { maps: MapSummary[], page, pageSize, total, pageCount }` (a napi pályák nélkül); `world=all\|sandbox\|story`, `scope=all\|mine\|favorites`, `sort=order\|recent\|size\|gold\|popular`, `level=all\|easy\|medium\|hard`, `pageSize` ≤ 60 (alapból 24), a túl nagy `page` az utolsó oldalra igazodik |
| `GET /api/maps/story`                                  | –                                                          | `200 { maps: MapSummary[] }`: a Történet pályái egyben                                                                                                                                                                                                                                                   |
| `GET /api/maps/stats`                                  | –                                                          | `200 { maps, authors }`: a látható homokozó-pályák és készítőik száma                                                                                                                                                                                                                                    |
| `POST /api/maps/match`                                 | `{ contents: string[] }` (≤ 64)                            | `200 { ids: (number \| null)[] }`: kanonikus tartalom szerinti egyezés                                                                                                                                                                                                                                   |
| `PUT /api/maps/:id/favorite`                           | –                                                          | `200 { isFavorite: true, favoriteCount }`, idempotens; `404`, `409 DAILY_FAVORITE`                                                                                                                                                                                                                       |
| `DELETE /api/maps/:id/favorite`                        | –                                                          | `200 { isFavorite: false, favoriteCount }`, idempotens                                                                                                                                                                                                                                                   |
| `GET /api/maps/daily`                                  | –                                                          | `200 { map: MapSummary, date }`; a mai napi pályát szükség esetén létrehozza                                                                                                                                                                                                                             |
| `POST /api/maps`                                       | `{ title, description?, visibility?, parSteps?, content }` | `201 { map, warnings }`; `422 MAP_INVALID` (`details`: diagnosztikák)                                                                                                                                                                                                                                    |
| `POST /api/maps/generate`                              | `{ rows, cols, difficulty, seed? }`                        | `200 { content, parSteps, seed }`; `400` (méret 5–15, nehézség `easy\|medium\|hard`)                                                                                                                                                                                                                     |
| `POST /api/maps/par`                                   | `{ content }`                                              | `200 { parSteps \| null }`; `422 MAP_INVALID`                                                                                                                                                                                                                                                            |
| `GET /api/maps/:id`                                    | –                                                          | `200 { map, version, info, warnings, versions, runCount, canEdit, isFavorite, next, player }`; `next`: a következő pálya `{ id, title }` vagy `null`; `404`                                                                                                                                              |
| `PUT /api/maps/:id`                                    | bármely mező a fentiekből                                  | `200 { map, createdNewVersion }`; `403`, `422`                                                                                                                                                                                                                                                           |
| `DELETE /api/maps/:id`                                 | –                                                          | `200 { ok: true }` (tulajdonos vagy admin; napi pálya nem törölhető)                                                                                                                                                                                                                                     |
| `GET /api/maps/:id/export`                             | –                                                          | `text/plain`, `Content-Disposition: attachment; filename="<cím>.txt"`                                                                                                                                                                                                                                    |
| `GET /api/maps/:id/leaderboard?version=<versionId>`    | –                                                          | `200 { mapId, title, versionId, currentVersionId, versions, entries }`                                                                                                                                                                                                                                   |

`MapSummary = { id, title, description, visibility, ownerId, ownerName, parSteps, createdAt, updatedAt, versionId, version, content, rows, cols, goldTotal, reachableGold, difficulty, best, stars }`, ahol `difficulty` a beépített útvonaltervező megoldásának hosszából számolt nehézség (`easy` legfeljebb 12, `medium` legfeljebb 40 lépés, fölötte `hard`; arany nélkül `null`), `best` a kérdező saját legjobb futása az aktuális verzión (`{ gold, steps } | null`), `stars` pedig az ebből számolt rögök száma (0–3, arany nélküli pályán `null`; a felületen aranyrögként jelenik meg).

`player = { best, stars, isDaily, difficulty }` a kérdező szemszögéből. A napi pálya (`map.dailyDate`) senkinek nem szerkeszthető.

Rögök (`stars`): 1, ha a futás legalább egy aranyat kibányászott; 2, ha minden elérhető aranyat; 3, ha mindet legfeljebb `parSteps` lépésből (célérték nélkül legfeljebb 2). A célérték a pálya metaadata (1–1000), módosítása nem hoz létre új verziót. Az oktató pályák célértéke a receptek lépésszáma, a generált pályáké az útvonaltervező programjának lépésszáma (`/api/maps/par` ugyanezt számolja tetszőleges térképre).

`entries[i] = { rank, runId, userId, username, gold, steps, outcomeKind, createdAt }`, felhasználónként a legjobb futás, `gold DESC, steps ASC, createdAt ASC` sorrendben (D13). A tartalom módosítása futás után új verziót hoz létre (D14).

### Programok, futások, saját adatok

| Metódus és útvonal                       | Kérés                      | Válasz                                                                                                                                                                                       |
| ---------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/programs?q&sort&page&pageSize` | –                          | `200 { programs: { id, title, updatedAt, lines }[], page, pageSize, total, pageCount, quota: { used, limit } }`; a `q` a címben és a forrásban keres, `sort=recent\|title`, `pageSize` ≤ 100 |
| `POST /api/programs`                     | `{ title, source }`        | `201 { program }`; `409 PROGRAM_LIMIT` 500 program felett                                                                                                                                    |
| `GET /api/programs/:id`                  | –                          | `200 { program }` (csak a saját)                                                                                                                                                             |
| `PUT /api/programs/:id`                  | `{ title?, source? }`      | `200 { program }`                                                                                                                                                                            |
| `DELETE /api/programs/:id`               | –                          | `200 { ok: true }`                                                                                                                                                                           |
| `POST /api/runs`                         | `{ mapVersionId, source }` | `201 { run, outcome, console, standing }`; `422 SYNTAX_ERROR` (nem mentődik); `404`                                                                                                          |
| `GET /api/runs/:id`                      | –                          | `200 { run, map: { content } }`; `404` (privát térkép, és nem vagy érintett)                                                                                                                 |
| `GET /api/me/runs?page&pageSize`         | –                          | `200 { runs, page, pageSize, total, pageCount }`, a legfrissebb elöl, `pageSize` ≤ 100 (alapból 20)                                                                                          |

A `POST /api/runs` a kliens által küldött egyéb mezőket (például `gold`) figyelmen kívül hagyja: az eredményt a szerver számolja. A `standing` a rögzítés utáni állás az adott térképverzió ranglistáján: `{ rank, players, isPersonalBest, stars }`, ahol `rank` a játékos helyezése a legjobb futásával, `players` a ranglistán szereplő játékosok száma, `isPersonalBest` pedig igaz, ha éppen ez a futás lett a játékos legjobbja. A `stars = { run, best, previous, parSteps } | null`: ennek a futásnak, a mostani legjobbnak és a futás előtti legjobbnak a rögszáma (arany nélküli pályán `null`).

A `GET /api/runs/:id` a visszajátszáshoz adja vissza egy futás adatait, a programmal együtt. Nyilvános térkép futását minden bejelentkezett felhasználó megnézheti (ez a megosztható link); privát térképnél csak a futás gazdája, a térkép gazdája és az admin, mindenki más és a nem létező azonosító `404 NOT_FOUND`. A `run.username` a futtató neve, a `run.isOwn` igaz, ha a kérdező futása. A `map.content` annak a térképverziónak a kanonikus tartalma, amelyen a futás történt (nem az aktuális verzióé), így az `engine.run(run.source, map.content)` pontosan ugyanazt az eseménysort adja:

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
    "source": "step forward 3\n…",
    "username": "demo1",
    "isOwn": true
  },
  "map": { "content": "7 7\n…" }
}
```

A `GET /api/me/runs` elemei ugyanezek a mezők a `source` nélkül.

A `MapSummary` a pálya adatai mellett a `favoriteCount` és az `isFavorite` mezőt is tartalmazza; a `difficulty` a térképverzión tárolt érték.

### Adminisztráció (csak admin)

| Metódus és útvonal                     | Kérés                           | Válasz                                                                                                                    |
| -------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/admin/users?q&page&pageSize` | –                               | `200 { users, page, pageSize, total, pageCount, admins }`; a `q` a felhasználónévben keres, `pageSize` ≤ 100 (alapból 20) |
| `POST /api/admin/users`                | `{ username, password, role? }` | `201 { user }`; `409 USERNAME_TAKEN`; a `role` alapból `user`                                                             |
| `PATCH /api/admin/users/:id`           | `{ role }`                      | `200 { user }`; `409 SELF_CHANGE` a saját fiókra                                                                          |
| `DELETE /api/admin/users/:id`          | –                               | `200 { ok: true }`; `409 SELF_CHANGE`                                                                                     |

### Asztali alkalmazás (nyilvános)

A kiadások a privát GitHub-repóban vannak. A szerver a `MINESCRIPT_GITHUB_TOKEN` (csak olvasási jogú, egy repóra szűkített token) birtokában olvassa őket, a token soha nem jut ki; a repó a `MINESCRIPT_DESKTOP_REPO` (alapból `buninstall/dusza-2026`, `off` kikapcsolja). A legfrissebb közzétett `desktop-v*` kiadás számít; a szerver 10 percig gyorsítótárazza, GitHub-hiba esetén a korábbi adatot adja.

| Metódus és útvonal                     | Válasz                                                                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/desktop`                     | `200 { release: { version, publishedAt, assets: [{ format, platform, size }] } \| null }`                                            |
| `GET /api/desktop/download/:format`    | `302` a GitHub rövid életű, aláírt címére; `format`: `dmg`, `exe`, `msi`, `appimage`, `deb`, `rpm`; `404`, `503`                     |
| `GET /api/desktop/latest.json`         | `200` Tauri-frissítő manifest, a letöltési címek a `/api/desktop/download/file/<név>`-re mutatnak; kiadás vagy manifest nélkül `204` |
| `GET /api/desktop/download/file/:name` | `200` a kiadás fájlja a szerveren át (a frissítő ezt tölti le, így a kapu fejléce nem jut a GitHubhoz); `404`, `503`                 |

## Fixture-formátumok

A conformance-esetek formátuma: [`conformance/README.md`](../conformance/README.md).
