# Értelmezési döntések

A specifikáció (`docs/feladat.md`) néhány ponton nyitva hagyja a pontos viselkedést. Az alábbi döntések kötelezőek: ezek szerint működik a motor, ezek alapján írjuk a conformance-eseteket, és ezekre hivatkozik a beadandó. Új döntés csak a csapat egyetértésével kerülhet be, következő sorszámmal.

| Azonosító                                          | Téma                   | Spec         |
| -------------------------------------------------- | ---------------------- | ------------ |
| [D1](#d1--az-üres-blokk-szabályos)                 | Üres blokk             | 2 (EBNF)     |
| [D2](#d2--fájl-normalizálás)                       | Fájl-normalizálás      | 1, 2.1       |
| [D3](#d3--szóközök)                                | Szóközök               | 2.1/2        |
| [D4](#d4--behúzás)                                 | Behúzás                | 2.1/1        |
| [D5](#d5--számliterálok)                           | Számliterálok          | 2            |
| [D6](#d6--futásidejű-egész)                        | Futásidejű egész       | 2.2.1, 2.2.2 |
| [D7](#d7--lépésszámlálás)                          | Lépésszámlálás         | 3.4          |
| [D8](#d8--step-forward-n)                          | step forward n         | 2.2.3, 2.2.4 |
| [D9](#d9--turn-by-n)                               | turn by n              | 2.2.3        |
| [D10](#d10--hibaelsőbbség)                         | Hibaelsőbbség          | 2.2.1, 2.2.4 |
| [D11](#d11--felfedezés)                            | Felfedezés             | 2.2.3, 3.4   |
| [D12](#d12--print)                                 | print                  | 2.2.3        |
| [D13](#d13--ranglista)                             | Ranglista              | 3.4, 3.5     |
| [D14](#d14--térképverziók)                         | Térképverziók          | 3.2, 3.5     |
| [D15](#d15--térképformátum)                        | Térképformátum         | 1, 3.2       |
| [D16](#d16--szintaktikailag-hibás-program-nem-fut) | Hibás program          | 2.1/5, 3.4   |
| [D17](#d17--minden-sor-ellenőrzése)                | Minden sor ellenőrzése | 2.1/5        |
| [D18](#d18--koordináták)                           | Koordináták            | –            |

## D1 – Az üres blokk szabályos

Spec: 2 (EBNF `block = { command }`).

Az `if`, `else` és `while` törzse lehet üres. A linter `LINT_EMPTY_BLOCK` figyelmeztetést ad.

Indoklás: az EBNF a `{ }` ismétléssel nulla parancsot is megenged, a szintaktikai hiba túl szigorú lenne. A figyelmeztetés jelzi, hogy valószínűleg elírásról van szó (például végtelen, üres `while`).

## D2 – Fájl-normalizálás

Spec: 1, 2.1.

- Az UTF-8 BOM-ot eldobjuk, a `\r\n`-t `\n`-re cseréljük (programnál és térképnél is).
- Egyetlen záró `\n` megengedett, és nem számít üres sornak. Egy csak `\n`-ből álló fájl üres.
- A magányos `\r` hiba: programban `SYN_LONE_CR`, térképen ismeretlen jel (`MAP_BAD_SYMBOL`) vagy hibás fejléc (`MAP_HEADER`).
- Az üres programfájl érvényes üres program (0 lépés); az üres térképfájl hiba (`MAP_EMPTY`).

Indoklás: a fájlokat Windowson és Linuxon is szerkesztik; a sorvég és a BOM nem lehet szintaktikai kérdés. A spec szerint a program lehet üres, a térkép viszont nem.

## D3 – Szóközök

Spec: 2.1/2.

- A tokenek között pontosan egy szóköz áll; kettő vagy több: `SYN_DOUBLE_SPACE`.
- Sorvégi szóköz: `SYN_TRAILING_SPACE`; tab bárhol a sorban: `SYN_TAB`.
- A csak szóközből álló vagy üres sor: `SYN_EMPTY_LINE`.

Indoklás: a spec kifejezetten „pontosan egy szóközt” ír elő, és kizárja az üres sort és a tabot.

## D4 – Behúzás

Spec: 2.1/1.

- A legfelső szint behúzása 0; ettől eltérő: `SYN_TOPLEVEL_INDENT`.
- Az `if`/`while`/`else` törzse szigorúan mélyebben van, mint a fejléc, és egy blokkon belül egységes (`SYN_INCONSISTENT_INDENT`).
- Blokkfejléc nélküli mélyebb sor: `SYN_UNEXPECTED_INDENT`.
- Visszahúzni csak egy nyitott szintre lehet (`SYN_DEDENT_MISMATCH`).
- Az `else` az `if`-fel azonos szinten áll, közvetlenül az `if` blokkja után; különben `SYN_ELSE_WITHOUT_IF`.

Indoklás: ez a Python-szerű behúzás szokásos, egyértelmű olvasata. A blokkonként eltérő mélység megengedett (a spec szerint), de blokkon belül nem.

## D5 – Számliterálok

Spec: 2 (`number = digit { digit }`, 0..100).

- A literál `digit{digit}`, értéke 0..100; a 101 és afölött `SYN_NUMBER_RANGE`.
- A vezető nulla érvényes (`007` = 7), a linter `LINT_LEADING_ZERO` figyelmeztetést ad.
- Negatív literál nincs: a `-5` egyetlen tokenként `SYN_INVALID_TOKEN`, a javaslat `0 - 5`.

Indoklás: az EBNF nem tiltja a vezető nullát; a negatív szám kizárólag kivonással állítható elő.

## D6 – Futásidejű egész

Spec: 2.2.1, 2.2.2.

A futásidejű egész `i64` ellenőrzött aritmetikával, a megengedett tartomány ±9 007 199 254 740 991 (a JavaScript `Number.MAX_SAFE_INTEGER`). Ezen túl `E_INT_OVERFLOW` futásidejű hiba keletkezik (saját, dokumentált kód). A ts-rs minden egész típust `number`-ként exportál.

Indoklás: a spec nem ad felső korlátot, de a böngészőben és a szerveren is pontos számokkal kell dolgozni. Így TypeScriptben is minden érték biztonságos `number`, és a referencia-interpreter is egyezik.

## D7 – Lépésszámlálás

Spec: 3.4.

- Minden sor feldolgozásának elején előbb limitellenőrzés jön: ha `steps == 1000` és újabb sor jönne, a hiba `INSTRUCTION_COUNT_LIMIT_EXCEEDED`, a hibasor ez a sor, és a `steps` 1000 marad. Ezután `steps += 1`.
- A futásidejű hibát okozó sor beleszámít.
- A `while` sora minden feltétel-kiértékeléskor számít, az utolsó, hamis kiértékelésnél is.
- Az `else` sora csak akkor számít, ha az else-ág fut (az `if` sora után).

Indoklás: a spec szerint „ha az 1000. feldolgozott programsor után újabb sor feldolgozására készülne”, a futás megszakad; a hibás sor maga is feldolgozott sor.

## D8 – step forward n

Spec: 2.2.3, 2.2.4.

- A robot mezőnként lép; ha a következő mező fal vagy pályán kívül van, `E_BEDROCK_HIT`.
- A robot az utolsó érvényes mezőn marad, és az addig bejárt mezők felfedezettek.
- `n = 0` érvényes, ilyenkor nem mozdul. Az aranyon áthalad, és ott hagyja.

Indoklás: a spec a „köztes mezők érintését” és a „soron következő lépésnél” bekövetkező hibát írja le; ebből a mezőnkénti végrehajtás következik.

## D9 – turn by n

Spec: 2.2.3.

`n` negyedfordulat balra (kelet → észak → nyugat → dél → kelet), `n mod 4` szerint. Negatív (csak számolással előállítható) vagy logikai érték: `E_BAD_ARG`.

## D10 – Hibaelsőbbség

Spec: 2.2.1, 2.2.4.

- API-paraméter: inicializálatlan változó `E_UNINITIALIZED`; rossz típus vagy tartomány `E_BAD_ARG`.
- `set`: balról jobbra halad, és minden operandust a beolvasás után azonnal típusellenőriz. Az `=` és `<>` első operandusa bármilyen típusú lehet, az egyezést a második után ellenőrzi. Nincs rövidzár: `true or c` esetén a `c` is beolvasódik. Az `E_TYPE_MISMATCH` csak sikeres kiértékelés után jöhet.
- `if`/`while`: inicializálatlan változó `E_UNINITIALIZED`; nem logikai érték `E_NON_BOOL_CONDITION`.

Indoklás: a spec 2.2.1 `set` leírása pontosan ezt a sorrendet írja elő; az API-paraméterekre ugyanezt a „beolvasás, majd ellenőrzés” elvet alkalmazzuk.

## D11 – Felfedezés

Spec: 2.2.3, 3.4.

- A kezdőmező felfedezett, és minden mező is, amin a robot áthalad vagy megáll.
- Az `isThere` célmezője felfedezett, ha pályán belül van (fal is).
- A pályán kívüli és az `E_BAD_ARG`-ot adó `isThere` semmit nem fed fel.
- Pályán kívül az `isThere` falat lát (`1` → true, `0`/`2` → false).
- A kibányászott mező üres kamrának számít.

## D12 – print

Spec: 2.2.3.

Az egész számot decimálisan írja ki (a negatívat is, például `-5`), a logikait `true`/`false` formában.

## D13 – Ranglista

Spec: 3.4, 3.5.

- Minden befejezett futás rögzítésre kerül (hiba nélkül, futásidejű hibával vagy a limit túllépésével végződő). A felhasználó által leállított futás nem, és a szintaktikailag hibás program sem.
- Az eredményt a szerver számolja újra a forrásból; a kliens által küldött számot nem fogadja el.
- Felhasználónként a legjobb futás számít, rendezés: arany csökkenő, lépés növekvő, időpont növekvő.

Indoklás: a „futás leállítható” (3.4) a lejátszás megszakítása, nem befejezett futás. A szerveroldali újraszámolás zárja ki a hamis eredményeket.

## D14 – Térképverziók

Spec: 3.2, 3.5.

Ha egy térképhez már van futás, a tartalom módosítása új `map_version`-t hoz létre, és a ranglista verziónként külön van. Futás nélküli térkép helyben módosul. A cím, a leírás és a láthatóság változása nem hoz létre új verziót.

Indoklás: egy módosított térképen elért eredmény nem összevethető a régivel, de a régi ranglista nem veszhet el.

## D15 – Térképformátum

Spec: 1, 3.2.

- A fejléc pontosan `R C`, egy szóközzel, 1..15 közötti értékekkel (`MAP_HEADER`, `MAP_DIM_RANGE`).
- Pontosan R sor következik (`MAP_ROW_COUNT`), mindegyik pontosan C karakter (`MAP_ROW_LENGTH`) a `.@#<>^v` halmazból (`MAP_BAD_SYMBOL`), és pontosan egy robot van (`MAP_NO_ROBOT`, `MAP_MULTIPLE_ROBOTS`).
- Arany nélküli térkép menthető (`MAP_NO_GOLD` figyelmeztetés). Az elérhetetlen arany is menthető (`MAP_UNREACHABLE_GOLD` figyelmeztetés; BFS a kezdőmezőből a nem-fal mezőkön, 4-szomszédsággal).
- Mentéskor a szerver a kanonikus alakot tárolja (LF sorvég, záró újsor).

## D16 – Szintaktikailag hibás program nem fut

Spec: 2.1/5, 3.4.

A `run()` szintaktikai hiba esetén `syntaxError` kimenetet ad a diagnosztikákkal, és egyetlen sort sem hajt végre.

## D17 – Minden sor ellenőrzése

Spec: 2.1/5.

A szintaktikai ellenőrzés minden sort megnéz, és minden hibát visszaad, nem áll meg az elsőnél. Hogy egy hibából ne legyen hibalavina:

- a hibás fejlécű `if`/`while`/`else` sor is blokkfejlécnek számít a behúzás szempontjából;
- a szkenner-szintű hibás sor (tab, üres sor, magányos `\r`) kimarad a behúzás-elemzésből;
- soronként csak az első tokenszintű hiba jelenik meg.

## D18 – Koordináták

- Belül és JSON-ban minden 0-alapú (`row`, `col`); a felület 1-alapúan mutatja.
- Az irány szerializálva `"north" | "east" | "south" | "west"`.
- A diagnosztikák `line`/`colStart`/`colEnd` értéke 1-alapú a megjelenítéshez, mellette a `from`/`to` abszolút UTF-16 offset a CodeMirrornak.
