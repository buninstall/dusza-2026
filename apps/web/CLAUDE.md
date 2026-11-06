# apps/web

## Komponens-konvenciók

- Interaktív elem csak React Aria Components alapú wrapper (`src/components/ui/`) vagy natív `button`/`a` lehet. Nincs `div onClick`.
- Navigáció: `src/components/ui/Link.tsx` (TanStack `createLink` + React Aria `Link`); gomb kinézetű linkhez `variant="primary" | "secondary" | "ghost"`.
- Stílus: Tailwind v4 a `src/styles/app.css` tokenjeivel (`bg-paper`, `text-ink`, `text-ore-deep` …). Nyers színkódot komponensben nem használunk.
- Minden felhasználói szöveg a `src/i18n/hu.ts`-ben van; komponensben nincs beégetett magyar mondat.
- Szerver-állapot: TanStack Query (`src/map/queries.ts`, `src/auth/session.ts`), API-hívás csak a típusos `api` + `call` párossal (`src/lib/api.ts`).

## A11y-szabályok

- Látható fókusz (`data-[focus-visible]` / `:focus-visible`), semmi nem jelölhető csak színnel.
- Ikon mellé szöveg vagy `aria-label`; a díszítő ikon `aria-hidden`.
- Az akadálymentes név tartalmazza a látható szöveget (2.5.3).
- Új oldalnál bővítsd az `e2e/a11y.spec.ts`-t (a testing gazdával egyeztetve).

## Az engine használata

```tsx
const engine = useEngine();
const { diagnostics } = engine.analyze(source);
```

A `useEngine` csak az `EngineProvider` alatt működik (a gyökér route-ban van). A WASM-ot a `@minescript/engine/wasm?url` importból tölti, egyszer.

## Lejátszás

- A futás eredménye (`RunResult`) a `src/runner/playback-store.ts` Zustand store-ba kerül.
- A képernyő állapotát kizárólag a `src/runner/derive.ts` `deriveFrame` tiszta függvénye számolja a trace-ből. A VM-et a felület soha nem lépteti.
- A beküldés (`POST /api/runs`) csak a lejátszás végén történik; a leállított lejátszás nem kerül beküldésre (D13).

## Generált fájlok

A `src/routeTree.gen.ts`-t a TanStack generálja (Vite-plugin, illetve `tsr generate` a typecheck előtt), nincs commitolva.
