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

## D19 – Szintaktikai hibák pontos leképezése

Spec: 2, 2.1. Ez a D3, D4, D5 és D17 pontosítása; a parser és a referencia-interpreter is ezt követi.

**Sorszintű (szkenner) hibák.** Ha egy sorban ilyen hiba van, csak ez az egy diagnosztika jelenik meg a sorra, és a sor kimarad a behúzás- és a tokenelemzésből:

1. `SYN_LONE_CR`: a sorban (normalizálás után) `\r` maradt.
2. `SYN_TAB`: a sorban bárhol tab van (a behúzásban is).
3. `SYN_EMPTY_LINE`: a sor üres vagy csak szóközből áll.

A sorrend: ha több is igaz, az elsőként felsorolt nyer.

**Tokenek.** A behúzás (vezető szóközök) után a sort szóközök mentén daraboljuk. Egy token osztálya:

| Minta                                                           | Osztály / hiba                                                                             |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| a 18 kulcsszó egyike pontosan (`true`, `false` logikai literál) | kulcsszó / logikai                                                                         |
| `+ - * = <> < <= > >=`                                          | operátor                                                                                   |
| `[0-9]+`                                                        | szám; ha az értéke > 100: `SYN_NUMBER_RANGE` (D5)                                          |
| `[A-Za-z][A-Za-z0-9]*`                                          | azonosító; ha kis-/nagybetűtől függetlenül kulcsszó: azonosító helyén `SYN_RESERVED_IDENT` |
| egyéb, és az első karakter Unicode-betű vagy `_`                | `SYN_INVALID_IDENT` (például `a_b`, `árany`)                                               |
| minden más                                                      | `SYN_INVALID_TOKEN` (például `1+2`, `-5`, `1a`, `(`)                                       |

**Tokenszintű hibák egy soron belül.** Balról jobbra haladunk; a sor _első_ tokenszintű hibája jelenik meg (D17), oszlop szerint. Ide tartozik: `SYN_DOUBLE_SPACE` (két vagy több szóköz két token között; a pozíció a második szóköz), `SYN_TRAILING_SPACE` (szóköz a sor végén), a fenti token-osztályhibák, és a nyelvtani hibák:

- `SYN_UNKNOWN_COMMAND`: az első token nem a 8 utasítás egyike (`step`, `turn`, `mine`, `print`, `set`, `if`, `else`, `while`). A súgó a kis-/nagybetűtől független egyezést javasolja (`Step` → `step`).
- `SYN_MISSING_TOKEN`: a sor véget ér, mielőtt az utasítás teljes lenne (`step forward`, `set x to`, `set x to 1 +`, `if`, `mine`).
- `SYN_EXTRA_TOKEN`: az utasítás teljes, de még van token (`print 1 2`, `mine here now`, `else x`, `set x to 1 + 2 + 3`).
- `SYN_UNEXPECTED_TOKEN`: egy pozíción nem a várt token áll: rögzített kulcsszó helyén más (`step back 1`, `turn 1`, `mine there`, `set x 1`), `simpleval` helyén kulcsszó vagy operátor (`if isThere 2`, `print while`), `set` után nem azonosító (`set 5 to 1`), a `calculatedval` első simpleval-ja után nem operátor (`set x to 1 2`).

A `calculatedval` alakjai: `simpleval`, `isThere simpleval`, `not simpleval`, `simpleval binoperator simpleval`. Az `and` és az `or` binoperátor, a `not` unoperátor.

**Behúzás.** Behúzásverem, kezdetben `[0]`. Minden nem kihagyott sorra (a szkennerhibás sorok kimaradnak):

1. Ha az előző feldolgozott sor blokkfejléc (`if`, `while`, `else`, hibás tokenekkel is, D17) és a sor behúzása nagyobb a verem tetejénél, új blokk nyílik ezzel a mélységgel. Ha nem nagyobb, a fejléc blokkja üres (D1, szabályos).
2. Egyébként, ha a behúzás nagyobb a verem tetejénél:
   - a program első feldolgozott sorában: `SYN_TOPLEVEL_INDENT`;
   - ha a verem `[0]` (legfelső szint): `SYN_UNEXPECTED_INDENT`;
   - ha a verem mélyebb (blokkon belül): `SYN_INCONSISTENT_INDENT`.

   A sor ilyenkor a verem tetején lévő blokkhoz tartozik.
3. Ha a behúzás kisebb: amíg a verem teteje nagyobb, kiveszünk; ha így nem pontosan egy veremszintre érünk, `SYN_DEDENT_MISMATCH`, és a sor a legközelebbi kisebb szinthez tartozik.
4. `else`: közvetlenül egy azonos mélységű `if` blokkja után (vagy üres blokkú `if` után) állhat; egyébként `SYN_ELSE_WITHOUT_IF`. Egy `if`-hez legfeljebb egy `else` tartozik. A hibás `else` is blokkfejléc.

Soronként legfeljebb egy behúzáshiba és egy tokenszintű hiba jelenik meg; a diagnosztikák sor, azon belül oszlop szerint rendezettek. Ha bármilyen hiba van, a `parse` nem ad programot (`program: null`).

## D20 – A futás eseménysora (trace)

Spec: 3.4. A Rust-motor és a referencia-interpreter eseménysorának mezőről mezőre egyeznie kell.

- Minden _feldolgozott_ sorhoz pontosan egy `Event` tartozik, a feldolgozás sorrendjében: a `while` sorához feltétel-kiértékelésenként egy, az `else` sorához csak akkor, ha az else-ág fut (közvetlenül az `if` eseménye után).
- A futásidejű hibát okozó sornak is van eseménye (a hibáig bekövetkezett hatásokkal, például a részleges `path`-szal), és utána a futás véget ér. A limit miatt fel nem dolgozott sornak nincs eseménye (D7).
- `index`: 0-tól számozott; `steps`: `index + 1`; `line`: a sor 1-alapú száma.
- `robot`: a robot állapota a sor _után_.
- `path`: a sor alatt sorban belépett mezők (csak `step forward`; a kezdőmező nem).
- `discovered`: a sor által _újonnan_ felfedezett mezők a felfedezés sorrendjében (a `path` mezői, illetve az `isThere` célmezője, D11); a már felfedezett mező nem kerül bele újra.
- `mined`: a kibányászott mező, ha a `mine here` sikeres; különben `null`.
- `gold`: a sor utáni összes kibányászott arany.
- `print`: a kiírt szöveg (D12), ha a `print` sikeres; különben `null`.
- `assigned`: `{ name, value }`, ha a `set` sikeres; különben `null`.
- A `RunResult`: `gold`, `steps` a végső értékek; `console` a kiírások sorrendben; `finalRobot`; `discovered` az összes felfedezett mező a felfedezés sorrendjében, az első a kezdőmező.
- `outcome.runtimeError.message`: a `RuntimeErrorCode` magyar szövege változatlanul (lásd `docs/contracts.md`). Az összevetés a `message` mezőt nem vizsgálja.
- Szintaktikai hibánál `events` üres, `steps` 0, `discovered` csak a kezdőmező.

## D21 – Kiértékelés lépésről lépésre

Spec: 2.2.1–2.2.4. A D10 pontosítása; minden lépés az első hibánál megáll.

- **simpleval olvasása**: szám → egész; `true`/`false` → logikai; azonosító → a változó értéke, ha nincs: `E_UNINITIALIZED`.
- **`set x to v`**: `v` olvasása; siker esetén típusegyezés a meglévő `x`-szel, eltérésnél `E_TYPE_MISMATCH`.
- **`set x to isThere w`**: `w` olvasása; ha nem egész, vagy nem 0, 1, 2: `E_BAD_ARG`; a célmező felfedezése (pályán belül); az eredmény logikai; utána a típusegyezés.
- **`set x to not v`**: `v` olvasása; ha nem logikai: `E_BAD_OPERAND`.
- **`set x to a op b`**: `a` olvasása; `a` típusának ellenőrzése (`+ - * < <= > >=` egészet, `and or` logikait vár, `= <>` bármit): hibánál `E_BAD_OPERAND`; `b` olvasása; `b` típusának ellenőrzése (`= <>` esetén egyeznie kell `a` típusával): hibánál `E_BAD_OPERAND`; a művelet; egész eredménynél ha az abszolút érték > 9 007 199 254 740 991: `E_INT_OVERFLOW`; végül a típusegyezés.
- **`if v` / `while v`**: `v` olvasása; ha nem logikai: `E_NON_BOOL_CONDITION`.
- **`step forward n`**: `n` olvasása; ha nem egész vagy negatív: `E_BAD_ARG`; mezőnkénti lépés (D8).
- **`turn by n`**: `n` olvasása; ha nem egész vagy negatív: `E_BAD_ARG`; `n mod 4` negyedfordulat balra.
- **`mine here`**: ha a mező nem arany (vagy már kibányászott): `E_NO_GOLD`; különben a mező üres lesz, `gold + 1`.
- **`print x`**: `x` olvasása, kiírás (D12).
- A sorok feldolgozása előtt a limitellenőrzés (D7) minden sorra, az `else` és az ismételt `while` sorokra is.

## D22 – Formázó

A formázás (`format`, Shift+Alt+F) csak szóközhibákat javít, a program jelentését nem változtatja:

1. a sorvégeket LF-re, a tabokat a behúzásban 4 szóközre cseréli, a sorvégi szóközt és az üres sorokat törli, a tokenek közötti több szóközt egyre csökkenti;
2. ha az eredmény szintaktikailag helyes, a blokkokat mélységenként `indentWidth` (alapból 4) szóközzel húzza be, és a fájl egy záró újsorral végződik;
3. ha a javítás után is van szintaktikai hiba, a forrás változatlan marad, és a `diagnostics` a hibákat adja.

A formázott program futtatásának eredménye megegyezik az eredetiével.

## D23 – Programfájl importja

Spec: 1, 3.3. A program szerkesztés közben lehet hibás, ezért a szintaktikailag hibás programfájl betölthető a szerkesztőbe (a hibák azonnal látszanak). Nem tölthető be és érthető hibaüzenetet kap a fájl, ha nem érvényes UTF-8 szöveg, ha NUL karaktert tartalmaz, vagy ha nagyobb 100 000 karakternél. A térképfájl csak teljesen érvényes formában tölthető be (D15).

## D24 – Pontosítások a referencia-interpreter alapján

A független referencia-interpreter írásakor felmerült, a D15 és a D19 által nyitva hagyott pontok. A Rust-motor és a referencia is ezeket követi.

**Szintaxis**

1. Ha ugyanazon a tokenen token-osztályhiba (`SYN_INVALID_TOKEN`, `SYN_INVALID_IDENT`, `SYN_NUMBER_RANGE`) és nyelvtani hiba is van, az osztályhiba nyer: `# x` → `SYN_INVALID_TOKEN`, `step 101` → `SYN_NUMBER_RANGE`.
2. A `SYN_MISSING_TOKEN` pozíciója a sor vége, ezért egy korábbi sorvégi szóköz megelőzi: `print ` → `SYN_TRAILING_SPACE`. A `SYN_TRAILING_SPACE` az első sorvégi szóközre mutat; több sorvégi szóköz egyetlen `SYN_TRAILING_SPACE`, nem `SYN_DOUBLE_SPACE`.
3. `SYN_RESERVED_IDENT` csak azonosítóhelyen (a `set` neve és a simpleval-helyek) jöhet, olyan tokenre, amely kis-/nagybetűtől függetlenül kulcsszó, de nem pontosan az. Pontos kulcsszó azonosítóhelyen `SYN_UNEXPECTED_TOKEN` (`set and to 1`, `set true to 1`). Rossz írásmódú kulcsszó rögzített kulcsszóhelyen `SYN_UNEXPECTED_TOKEN` (`step Forward 1`), utasításhelyen `SYN_UNKNOWN_COMMAND` (`If x`).
4. Egy sor csak akkor blokkfejléc, ha az első tokenje pontosan `if`, `while` vagy `else`. A `WHILE true` nem fejléc, így a mélyebbre húzott következő sor `SYN_UNEXPECTED_INDENT`.
5. A `SYN_ELSE_WITHOUT_IF` a sor egyetlen behúzás-jellegű hibájának számít: a gazdátlan `else x` `SYN_ELSE_WITHOUT_IF` és `SYN_EXTRA_TOKEN`; a gazdátlan és rosszul behúzott `else` csak a behúzáshibát kapja.
6. Oszlopok (1-alapú, UTF-16 egységben, a normalizált szövegen; a `from`/`to` is a normalizált szövegre vonatkozik): a behúzáshibák az 1. oszlopon, a `SYN_ELSE_WITHOUT_IF` az `else` tokenen, a `SYN_LONE_CR` és a `SYN_TAB` az első hibás karakteren, a `SYN_DOUBLE_SPACE` a második szóközön, a `SYN_EMPTY_LINE` az 1. oszlopon.
7. A D19 táblázatában a „Unicode-betű” a Unicode `Alphabetic` tulajdonság.
8. A `\r\r\n`-ben a CRLF-csere egyszeri, az első `\r` magányos marad. A `\n\n` két üres sor (pontosan egy záró `\n` hagyható el). A csak BOM-ból álló fájl üres program. A NUL karakter `SYN_INVALID_TOKEN`.

**Térkép**

9. Soronként legfeljebb egy hiba: ha a sorban ismeretlen jel van, csak `MAP_BAD_SYMBOL` az első ismeretlen jelnél; különben `MAP_ROW_LENGTH`, ha a hossz hibás.
10. A `MAP_MULTIPLE_ROBOTS` egyszer jelenik meg, a második robotnál; a `MAP_DIM_RANGE` egyszer, akkor is, ha mindkét méret hibás; a `MAP_UNREACHABLE_GOLD` cellánként egy figyelmeztetés.
11. Sorszámok: a `MAP_EMPTY` és a `MAP_NO_ROBOT` az 1. soron; a `MAP_ROW_COUNT` túl sok sornál az első fölösleges soron, hiányzó soroknál az 1. soron. Fejléchiba után nincs további ellenőrzés. A fejléc számjegyei vezető nullát is tartalmazhatnak (`03 15` érvényes); a `+1 1` és a `-1 1` `MAP_HEADER`; a túl nagy szám `MAP_DIM_RANGE`.
