# Tesztakna – MineScript tesztkonzol

Jelszóval védett helyi webes konzol. Innen a projekt összes tesztje és vizsgálata egyenként vagy együtt futtatható, élő haladásjelzéssel. A talált hibákat tartósan menti, súlyosság és felelős szerint kezeli, és a csapat hibajelentés-formátumában exportálja.

Stack: Bun-szerver (SSE, argon2id), React 19 + TypeScript, React Aria Components (akadálymentes vezérlők), TanStack Query, Zustand; a felületet a Bun beépített bundlere fordítja indításkor. Nincs új függőség: a csomagokat a `apps/web` már telepített moduljaiból használja.

## Indítás

Első alkalommal állíts be jelszót. A jelszó a szabványos bemenetről jön, és csak az argon2id hashe kerül a repón kívüli adatmappába:

```sh
bun e2e/console/server.ts --set-password < jelszo.txt
bun e2e/console/server.ts
```

Utána nyisd meg: <http://127.0.0.1:8787>. A szerver csak loopback címen indul el, mert parancsokat futtat a gépen.

| Környezeti változó           | Alapérték                                | Jelentés                                        |
| ---------------------------- | ---------------------------------------- | ----------------------------------------------- |
| `TEST_CONSOLE_PORT`          | `8787`                                   | port                                            |
| `TEST_CONSOLE_HOST`          | `127.0.0.1`                              | csak loopback cím fogadható el                  |
| `TEST_CONSOLE_DATA`          | `~/.minescript-test-console`             | jelszóhash, futások, naplók, találatok          |
| `TEST_CONSOLE_TARGET`        | `http://127.0.0.1:8080`                  | az élő biztonsági vizsgálatok célpéldánya       |
| `TEST_CONSOLE_PASSWORD_HASH` | –                                        | argon2id hash a fájl helyett (például CI-ben)   |
| `TEST_DATABASE_URL`          | `mysql://root:minescript@127.0.0.1:3306` | a szerver- és e2e-tesztek ideiglenes adatbázisa |

## Nézetek

- **Áttekintés:** aknajelentés, mutatók (nyitott találatok súlyosság szerint, zöld csomagok, sikeres esetek aránya, instabil tesztek), élő „Most fut” kártya a várható hátralévő idővel, egészségmátrix (csomagonként az utolsó 24 futás), friss regressziók, legsúlyosabb találatok.
- **Csomagok:** csoportonként; futtatás, kijelöltek vagy csoport futtatása, mély seedek, instabilitás-próba (N ismétlés, véletlen sorrend), „Egyenként” tesztfelderítő kereséssel: fájl vagy teszt futtatása.
- **Futások:** szűrhető lista; részletek élő haladással, esetek fülenként (sikertelen, sikeres, kihagyott, mind) kereséssel, fájl és sor, pontos üzenet, teljes kimenet; „Csak ezt újra”, „Sikertelenek újra”, „Összevetés az előzővel”; élő napló hibasor-kiemeléssel, kereséssel, „Következő hiba” ugrással és letöltéssel.
- **Találatok:** rendezhető, többes kijelölésű táblázat szűrőkkel (állapot, súlyosság, felelős, csomag, instabil); tömeges műveletek; részletek szerkesztése; BUG-sablon másolása; export Markdown, CSV (képletinjekció ellen védve) és JSON formában.
- **Összevetés:** két futás különbsége: újonnan elromlott, megjavult, továbbra is hibás, új és eltűnt eset.
- **Beállítások:** a célpéldány címe, az időkorlát, asztali értesítés a futás végén, világos téma.
- **Parancspaletta:** `Ctrl+K` bármely csomag futtatásához vagy találat megnyitásához; `g o`, `g s`, `g r`, `g f`, `g c` navigáció; `?` súgó.

## Csomagok

| Csoport                | Csomag                                                                                                                                                                                              |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Előkészítés            | WASM-fordítás, teljes build                                                                                                                                                                         |
| Rust-motor             | `cargo test --workspace`, Rust-conformance, `@minescript/engine` (WASM), mély proptest (20 000 eset, release)                                                                                       |
| Referencia és orákulum | referencia-interpreter (37 mutáns, differenciális, invariáns, robusztussági, szintaxis-, térkép- és robot-API-fuzz), mély fuzz (20 000 seed)                                                        |
| Szerver és web         | Hono API tesztek MySQL-lel, Vitest                                                                                                                                                                  |
| Végponttól végpontig   | Playwright: folyamatok, biztonság, a11y, reszponzivitás; e2e instabilitás-próba (`--repeat-each=3`)                                                                                                 |
| Lefedettség            | referencia, engine, szerver: fájlonként 95% alatt hiányosság a lefedetlen sorokkal                                                                                                                  |
| Statikus elemzés       | Clippy, rustfmt, Biome, TypeScript                                                                                                                                                                  |
| Biztonság              | `bun audit`; titokkeresés (repó és kliens build); élő olvasási vizsgálat (fejlécek, hitelesítés, CORS, CSRF, szivárgás, útvonal-bejárás, source map, brute force, túl nagy törzs); élő írási próbák |
| Csapatszabályok        | nulla komment a teljes repóban, repó-higiénia                                                                                                                                                       |
| Versenykiírás (PDF)    | a kiírás minden szabálya fejezetszámmal: motor (1., 2., 2.1, 2.2.1–2.2.4, 3.4), élő szerver (3.1–3.5, bemutató környezet), felület Playwrighttal (3. fejezet), beadandó leírás teljessége (4.)      |
| Tesztkonzol            | a konzol önellenőrzése, a biztonsági próbák mutációs tesztjével                                                                                                                                     |

Az élő írási próbák eldobható fiókokat és privát térképeket hoznak létre a célpéldányon. Ezek a próbák a munkamenet-süti jelzőit, a jelszó válaszba szivárgását, a kijelentkezés utáni sütit, a munkamenet-rögzítést, a regisztrációban küldött admin szerepet, a betűméret-ütközést, az IDOR-t, a ranglista-hamisítást, 12 párhuzamos beküldést, az óriási programot és a tárolt XSS-t vizsgálják. Csak tesztpéldányon futtasd őket. A próbák helyességét a konzol önellenőrzése egy szándékosan sérülékeny kamuszerveren bizonyítja: minden beültetett hibát pontosan a megfelelő próba jelez.

## Elvek

- Ami nem futott le, az nem sikeres. Sikertelennek számít a hibakóddal kilépő, de elemezhető esetet nem adó parancs, az üres csomag és a hiányzó előfeltétel (MySQL, WASM, build, futó példány), mindig pontos okkal.
- Minden találat fájlt, sort, üzenetet és teljes részletet (stack, pánik, elvárt és kapott érték) tartalmaz.
- Ha egy korábban hibás eset később sikeresen lefut, a találat „megszűnt” állapotba kerül; ha újra előfordul, újra megnyílik. Ha egy eset hol sikeres, hol sikertelen, „instabil” jelölést kap.

## Védelem

- Argon2id jelszó-ellenőrzés; 5 hibás próbálkozás után kliensenként exponenciálisan növő zárolás, mellette globális korlát (percenként 30 hibás próbálkozás).
- Véletlen munkamenet-token (`HttpOnly`, `SameSite=Strict`); a szerver csak a token hashét tárolja; 30 perc tétlenség vagy 8 óra után lejár.
- Minden állapotváltoztató kérés megköveteli a saját Origint és a munkamenethez kötött CSRF-tokent. Ismeretlen `Host` fejlécre 421 a válasz (DNS-rebinding ellen).
- Szigorú CSP (`script-src 'self'`, inline kód nincs), `frame-ancestors 'none'`, `nosniff`, `no-referrer`, `no-store`. A bejelentkezés előtt csak a belépőoldal kódja érhető el.
- Csak előre definiált parancsok futnak. A célpont (fájl, tesztnév) ellenőrzött, útvonal-bejárás nem lehetséges, és az élő vizsgálatok csak loopback címre irányíthatók.
