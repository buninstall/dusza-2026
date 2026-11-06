# apps/web

## Felépítés

| Mappa            | Tartalom                                                                                |
| ---------------- | --------------------------------------------------------------------------------------- |
| `src/styles`     | `tokens.css` (paletta mindkét témára, méretek, mozgás), `base.css`, `codemirror.css`    |
| `src/pixel`      | ASCII pixel art: csempék, robot, ikonok, logó; SVG-útvonallá fordítás, közös sprite-lap |
| `src/components` | `ui/` React Aria wrapperek, továbbá `Panel`, `Notice`, `Led`, `PageHeader`              |
| `src/mine`       | a térképrács (`MineBoard`), a csempemodell, a rácsnavigáció és a mini előnézet          |
| `src/play`       | játék oldal, `playback-store.ts`, `derive.ts`, futás és beküldés (`useRunSession.ts`)   |
| `src/map-editor` | térképszerkesztő és állapota                                                            |
| `src/editor`     | CodeMirror-bővítmények                                                                  |
| `src/routes`     | vékony TanStack fájl-route-ok, a lapok a feature-mappákban vannak                       |
| `src/i18n`       | `hu.ts` a felület szövegei, `hu-manual.ts` a kézikönyv                                  |

## Komponens-konvenciók

- Interaktív elem csak React Aria Components alapú wrapper (`src/components/ui/`) vagy natív `button`/`a` lehet. Nincs `div onClick`.
- Navigáció: `src/components/ui/Link.tsx` (TanStack `createLink` + React Aria `Link`); gomb kinézetű linkhez `variant="primary" | "secondary" | "ghost" | "danger"`.
- Stílus: komponensenként egy sima CSS-fájl (`Panel.tsx` mellett `Panel.css`), előtagos kebab-case osztálynevekkel (`panel-head`, `play-gauge`). Szín, méret és időzítés csak `tokens.css`-változóból jöhet; nyers színkód komponensben nincs. Állapotot `data-*` attribútum jelöl.
- Gradient, blur, lekerekített kártyarács és emoji nincs. Ikon csak `PixelIcon` lehet, játékelem csak a `src/pixel` sprite-jaiból.
- Minden felhasználói szöveg a `src/i18n`-ben van; komponensben nincs beégetett magyar mondat.
- Szerver-állapot: TanStack Query (`src/maps/queries.ts`, `src/auth/session.ts`, `src/play/programs.ts`), API-hívás csak a típusos `api` + `call` párossal (`src/lib/api.ts`).

## A11y-szabályok

- Látható fókusz (`[data-focus-visible]` / `:focus-visible`), semmi nem jelölhető csak színnel.
- Ikon mellé szöveg vagy `aria-label`; a díszítő ikon és sprite `aria-hidden`.
- Az akadálymentes név tartalmazza a látható szöveget (2.5.3).
- Mozgás csak `transform`/`opacity`, `prefers-reduced-motion` mellett kikapcsolva.
- Új oldalnál bővítsd az `e2e/a11y.spec.ts`-t (a testing gazdával egyeztetve).

## Az engine használata

```tsx
const engine = useEngine();
const { diagnostics } = engine.analyze(source);
```

A `useEngine` csak az `EngineProvider` alatt működik (a gyökér route-ban van). A WASM-ot a `@minescript/engine/wasm?url` importból tölti, egyszer.

## Lejátszás

- A futás eredménye (`RunResult`) a `src/play/playback-store.ts` Zustand store-ba kerül, a lefuttatott forrással együtt.
- A képernyő állapotát kizárólag a `src/play/derive.ts` `deriveFrame` tiszta függvénye számolja a trace-ből. A VM-et a felület soha nem lépteti.
- A beküldés (`POST /api/runs`) csak a lejátszás természetes végén történik, futásonként egyszer; a leállított lejátszás nem kerül beküldésre (D13). A sávban a szerver által számolt eredmény látszik.
- Lejátszás közben a szerkesztő csak olvasható.

## Tesztek

- `bun run test`, lefedettség: `bun run test:coverage` (v8).
- A lapokat a valódi route-fán át rendereljük memóriás historyval (`test/support/app.tsx`), a hálózatot a `test/support/api.ts` fetch-hamisítója, a motort a lefordított WASM adja (`test/support/engine.ts`; előtte `just wasm`).

## Fejlesztés

- `just dev`; ha a 8080-as port foglalt, a Vite proxy célja a `MINESCRIPT_API_URL` változóval állítható.

## Generált fájlok

A `src/routeTree.gen.ts`-t a TanStack generálja (Vite-plugin, illetve `tsr generate` a typecheck és a teszt előtt), nincs commitolva.
