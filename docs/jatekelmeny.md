# Játékélmény: a Lámpafény-mód

Ez a dokumentum a játékélmény megújításának terve. Az első és legfontosabb eleme a Lámpafény-mód: a nehezebb pályákon a bánya valóban sötét, a térképet a robot lámpája fedezi fel, és ami egyszer kiderült, az a játékos vázlatán megmarad, amíg a robot falnak nem megy.

Az ötlet a felkészítő tanárunktól, Róberttől jött, miután kipróbálta a játékot. Az ő négy javaslata:

1. A lámpafény dolga az, hogy ne lásd a pályát: a térkép a lámpa fényénél fedeződjön fel.
2. Ha falnak mész, a lámpa összetörik, és kezdheted előről teljes sötétben.
3. A könnyű pályák maradjanak úgy, ahogy vannak: ott tanulja a játékos az utasításokat és az irányítást, az igazi izgalom a lámpafénynél kezdődik.
4. Ha a robot aranyat bányászik, messzebbre lát: az arannyal befizeti a villanyszámlát, feltölti a lámpa akkumulátorát.

Ezekből az alábbi, a kiírással összeegyeztetett terv készült.

## A kiinduló állapot

A játékoldalon már a mód előtt is volt „Lámpafény” és „Teljes térkép” nézet (`L` billentyű), de a köd csak lejátszás közben érvényesült: futás előtt mindkét nézet a teljes pályát mutatta, futás után pedig a Lámpafény eltüntette a labirintust, így a tervezéshez mindig vissza kellett váltani a Teljes térképre (QA-jelentés, J5 és J16). A Lámpafény tehát egy megjelenítési kapcsoló volt, nem játékszabály. A Lámpafény-mód ebből játékszabályt csinált; a nyitott pályákon a régi kapcsoló változatlanul megmaradt.

## Mennyire szabad ilyet csinálni: összevetés a kiírással

A kiírás a felület és a játékmenet kialakítását a csapatra bízza („a funkciók tervezése és megvalósítása […] rátok van bízva”, 3. fejezet), és kifejezetten előnynek tekinti a továbbfejlesztési ötleteket (4. fejezet). A Lámpafény-mód egyetlen kötelező szabályt sem ír felül:

| A kiírás mondata                                                                                   | Hogyan teljesül a Lámpafény-módban                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| „a sötétben csak azt érzékeli, ami közvetlenül előtte van, így tapogatózva halad előre” (bevezető) | A mód éppen ezt a történetet teszi láthatóvá. A robot érzékelése nem változik: az `isThere` továbbra is csak a közvetlenül előtte lévő mezőt vizsgálja.                                                               |
| „Mutatja a már felfedezett mezőket […] megkülönböztetve a még feltérképezetlen területektől” (3.4) | A felfedezett mezők halmaza pontosan a D11 szerinti marad (bejárt mezők és `isThere`-célok). A lámpa által csak megvilágított mező külön, harmadik állapot, nem számít felfedezettnek.                                |
| „megjeleníti a térképet, és rajta a robot aktuális helyzetét és irányát” (3.4)                     | A térkép rácsa, mérete, kerete és a robot mindig látszik; csak a felderítetlen mezők tartalma rejtett. A könnyű pályákon és minden saját pályán, ahol a szerző nem kapcsolja be, a teljes térkép látszik, mint eddig. |
| „Indításkor a térkép és a robot alaphelyzetbe kerül” (3.4)                                         | Minden futás az eredeti térképpel és kezdőhelyzettel indul, az arany is visszakerül. A vázlat nem a térkép állapota, hanem a játékos tudása: a felületen él, a motor futását nem befolyásolja.                        |
| Lépésszámlálás, 1000 soros limit, futásidejű hibák (2.2.4, 3.4)                                    | Változatlan. A motorhoz (`crates/`) nem nyúlunk, a conformance-esetek változatlanul érvényesek, a D1–D25 döntések maradnak.                                                                                           |
| Ranglista: több arany, azonos aranynál kevesebb lépés (3.5)                                        | Változatlan rendezés. A Lámpafény a pálya tulajdonsága, mindenki ugyanúgy játssza, így a pálya ranglistája összevethető marad.                                                                                        |
| Térkép importja, exportja, szerkesztése (3.2), a térképfájl formátuma (1. fejezet)                 | A fájlformátum nem változik, a Lámpafény a pálya adatbázisbeli beállítása, nem a térképfájl része. A szerző a saját pályáját mindig teljes egészében látja, szerkeszti és exportálja.                                 |

Az egyetlen értelmezési kockázat a 3.4 „megjeleníti a térképet” mondata: egy szigorú olvasat szerint a teljes térképnek látszania kell. Ezért a mód nem alapértelmezés, hanem a nehezebb pályák beállítása; az alapfeladatot a nyitott pályák betű szerint teljesítik, a Lámpafény a beadandóban plusz szolgáltatásként szerepel. A kiírás bevezetője (sötét bánya, tapogatózó robot) erős érv amellett, hogy a mód a feladat szellemét erősíti.

## A szabályok

### 1. Sötét bánya

Lámpafényes pályán a játék megnyitásakor a térkép rácsa és kerete látszik, a mezők tartalma sötét. Csak a robot kezdőmezője és a lámpa fénykörében lévő mezők láthatók. A játékos így tudja a pálya méretét, de a labirintust a programjával kell kitapogatnia.

### 2. Három mezőállapot

| Állapot       | Mitől lesz ilyen                                               | Megjelenés                                       |
| ------------- | -------------------------------------------------------------- | ------------------------------------------------ |
| Felfedezett   | A robot járt rajta vagy `isThere` vizsgálta (D11, változatlan) | Teljes részletesség, ahogy ma                    |
| Megvilágított | A lámpa fénykörébe esett, de a robot nem vizsgálta             | Halványabb, kékes árnyalat és pontmintás takarás |
| Sötét         | Egyik sem                                                      | Tömör sötétség, dithermintás szegély, ahogy ma   |

A megkülönböztetés nem csak színnel történik (a11y, 1.4.1), és a képernyőolvasó a sötét mezőkre csak annyit mond: „ismeretlen”, így a rejtett tartalom akadálymentes úton sem szivárog ki.

### 3. Az akkumulátor és a látótáv

A lámpa fénykörének sugara az akkumulátor töltöttsége:

- induláskor 1 (a robot körüli szomszédos mezők),
- minden kibányászott aranyrög után eggyel nő, legfeljebb 4-ig,
- a fény nem megy át falon: a fal maga megvilágítható, a mögötte lévő mező nem.

A sugár futáson belül nő, így a bányászás azonnali, látható jutalmat ad: a rög felvételekor a fénykör kitágul, a műszersávban az akkumulátor-jelző egy szegmenssel feljebb ugrik. Az aranymezős pályán (7.) ez külön stratégiát ad: előbb a közeli aranyat érdemes felszedni, hogy messzebbre lásson a robot.

A fénykör csak azt befolyásolja, mit lát a játékos. A robot továbbra is csak az `isThere` válaszából tud a környezetéről, a nyelv viselkedése nem változik.

### 4. A vázlat

Ami egy futás során felfedezett vagy megvilágított lett, az a futás végén a játékos vázlatára kerül, és a következő futás előtt is látszik. A vázlat felhasználónként és pályaverziónként külön van (D14: módosított pálya új vázlatot kap). Így a játék ritmusa: felderítő program, tervezés a vázlaton, jobb program.

Róbert felvetette, hogy ha a vázlat megmarad, ugyanazt a programot újra futtatva „újra meg van minden”. Ez rendben van: a futás determinisztikus, egy ismételt futás nem ad új tudást, csak megerősíti a meglévőt. A feszültséget nem a felejtés adja, hanem a következő szabály.

### 5. Falnak ütközés: összetörik a lámpa

Ha a futás `E_BEDROCK_HIT` hibával ér véget (falra vagy a térképről lelépne a robot), a lámpa összetörik: villódzás, csörömpölés, majd a vázlat törlődik, és a játékos újra teljes sötétben áll. A futás eredménye ettől még a szabályok szerint a ranglistára kerül (D13), az addig kibányászott arannyal.

Ez a szabály a mód didaktikai lényege. A falba ütközés mindig elkerülhető, ha a program lépés előtt `isThere 1`-gyel megnézi, mi van előtte. A játék így azt jutalmazza, amit a kiírás bevezetője is leír: a robot tapogatózva, óvatosan halad. Aki védekezően programoz, az soha nem veszíti el a vázlatát.

A többi futásidejű hiba (`E_NO_GOLD`, típushibák, a sorlimit túllépése) nem töri össze a lámpát, mert nem a bánya falával kapcsolatos.

### 6. A teljes térkép kiérdemelhető

Ha a játékos egy lámpafényes pályán megszerezte a három rögöt, a Teljes térkép nézet feloldódik. Ettől kezdve a lépésszám csiszolása a ranglistáért már nyitott térképen folyik. Így a felfedezés izgalma és a ranglista versenye nem üti egymást: előbb felfedezni kell, utána optimalizálni.

### 7. Fokozatok és a kampány

A pálya szerzője a térképszerkesztőben választ fokozatot:

| Fokozat   | Köd  | Vázlat           | Falnak ütközés                                                                            | Kampánypályák                   |
| --------- | ---- | ---------------- | ----------------------------------------------------------------------------------------- | ------------------------------- |
| Nyitott   | nem  | nincs szükség rá | csak hibaüzenet, ahogy ma                                                                 | 1–4.                            |
| Lámpafény | igen | megmarad         | a vázlat törlődik                                                                         | 5. Kígyó, 6. Elérhetetlen kincs |
| Vaksötét  | igen | megmarad         | a vázlat törlődik, és az akkumulátor induló töltése 0: csak a felfedezett mezők látszanak | 7. Aranymező, 8. A nagy bánya   |

Az egyes pályák fokozata a nehézségükhöz igazodik: a könnyű pályákon a játékos az utasításokat és az irányítást tanulja, a nehezebbeken jön a felfedezés.

## Amit elvetettünk

- **Falnak ütközéskor új, ismeretlen térkép.** Róbert maga is jelezte a gondot: így a pálya soha nem lenne megoldható, hiszen felfedezés közben egyszer szinte biztosan falnak megy a robot. Az ötlet egy része megmarad a napi kihívásban (lásd lent), ahol a pálya naponta amúgy is új.
- **A vázlat törlése minden futás elején.** Ez a mai működés (J5), és éppen ez teszi fárasztóvá a tervezést. A vázlat megtartása és a falnál való elvesztése együtt adja a tétet.
- **A robot érzékelésének bővítése a lámpával.** Csábító, hogy a lámpa az `isThere`-nek is többet mutasson, de ez a nyelv szemantikáját (2.2.3) változtatná meg. A lámpa csak a játékosnak világít.

## Ráadás ötletek a módra építve

- **Vaksötét napi kihívás:** a napi pálya Vaksötét fokozatú, egyetlen próbálkozás számít a ranglistán („első futás”), így mindenki ugyanabból a sötétségből indul.
- **„Sötétből” jelvény:** a ranglistán ikon jelöli azt a futást, amelyik üres vázlattal indult, és mégis három rögöt ért. A rendezés változatlan, a jelvény csak dicsőség.
- **Lemerülő akku:** üres mezőn ütött csákány (`E_NO_GOLD`) egy szegmenst lemerít. Nyitott kérdés, lásd lent.
- **Hangok:** a meglévő 8-bites szintetizátorral lámpa-zümmögés, töltés-csilingelés a rögnél, üvegcsörömpölés a falnál.

## Kockázatok és válaszok

| Kockázat                                                                            | Válasz                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A zsűri a 3.4-et úgy olvassa, hogy a teljes térképnek látszania kell                | A mód csak a nehezebb pályákon kötelező, a nyitott pályák betű szerint teljesítik a kiírást; a beadandó és a megfelelőségi táblázat plusz szolgáltatásként írja le.                                                                |
| Frusztráló a vázlat elvesztése                                                      | A falnak ütközés mindig elkerülhető `isThere`-rel; a Kézikönyvbe egy „Biztonságos lépés” próbapad és egy recept kerül; a fokozatot a szerző választja.                                                                             |
| Spoiler a ranglista visszajátszásaiból                                              | Más játékos futása lámpafényes pályán zárolt Lámpafény nézetben megy, csak az látszik, amit az a futás felfedezett; a saját futás visszajátszásában a Teljes térkép is választható.                                                |
| Spoiler a térképszerkesztőből és az exportból                                       | A szerkesztőt eddig is csak a szerző és az adminisztrátor nyithatta meg; lámpafényes pályát a szerver is csak nekik exportálja (`403 FORBIDDEN`).                                                                                  |
| A térkép a böngészőben van (a WASM-motor ott fut), fejlesztői eszközzel kiolvasható | Elfogadott kockázat: ez játék, nem vizsga. Eredményt hamisítani így sem lehet, mert a szerver minden futást újraszámol (D13); csak a felfedezés öröme vész el annak, aki csal.                                                     |
| Akadálymentesség                                                                    | A három állapot mintával is különbözik; a sötét mező akadálymentes neve „felderítetlen”, a tartalma a DOM-ba sem kerül; a lámpa-animációk `prefers-reduced-motion` alatt egyszerű áttűnések; az akku-jelző szöveges értéket is ad. |

## Megvalósítás

A motor nem változott: a futás eseménysora (D20) már tartalmazza minden lépés felfedezett mezőit, a robot helyzetét és a bányászásokat, ebből a fénykör és a vázlat a felületen kiszámolható. A munka így teljesen az `apps/web` és az `apps/server` területén maradt.

| Rész                       | Állapot   | Hol van                                                                                                                                                                           |
| -------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fénykör és vázlat logikája | elkészült | `apps/web/src/play/lamp-mode.ts`: `lampLight` (falon meg nem álló elárasztás), `lampTrack` (képkockánkénti fény), `sketchAfterRun`, `lampView`; tesztek: `test/lamp-mode.test.ts` |
| Pályabeállítás             | elkészült | `maps.lamp_mode` (`open`, `lamp`, `dark`), migráció: `apps/server/drizzle/0002_lamp_mode.sql`; a kampány 5–6. pályája Lámpafény, 7–8. Vaksötét (seed és migráció)                 |
| Választó a szerkesztőben   | elkészült | a térképszerkesztő jobb oldali paneljén, a láthatóság alatt, magyarázó szöveggel                                                                                                  |
| Sötét bánya a játékoldalon | elkészült | `PlayScreen.tsx`: a sötét mező tartalma nem is kerül a rajzba; a megvilágított mező rácsmintás; „Lámpafény”/„Vaksötét” címke a fejlécben                                          |
| Akku-jelző                 | elkészült | a műszersáv állapotjelzője mellett 4 cella, szöveges értékkel a képernyőolvasónak; összetört lámpánál veszélyjelző minta                                                          |
| Vázlat                     | elkészült | `useLampSketch.ts`: böngészőben, felhasználónként és pályaverziónként; csak a természetes véggel lezárt futás frissíti, falnak ütközés törli                                      |
| Összetört lámpa            | elkészült | a futás végén csak a robot mezője látszik, és figyelmeztetés magyarázza, mi történt és hogyan kerülhető el                                                                        |
| Teljes térkép feloldása    | elkészült | a Nézet kapcsoló három rög után (és a szerzőnek, adminisztrátornak) választható, addig zárolt                                                                                     |
| Spoilervédelem             | elkészült | export csak a szerzőnek és az adminisztrátornak; mások visszajátszása zárolt Lámpafény nézetben                                                                                   |
| Tesztek                    | elkészült | web: 448 teszt (köztük a sötét indulás, a vázlat, a falnál törlés, a feloldás és a szerkesztő); szerver: beállítás, export-tiltás, seed                                           |
| Szerveroldali vázlat       | még nincs | a vázlat most böngészőhöz kötött; több eszközhöz `map_sketches` tábla kellene                                                                                                     |
| Hangok, lámpa-animáció     | még nincs | a falnál a meglévő hiba-hang és ütközés-animáció szól; külön lámpa-csörömpölés nincs                                                                                              |
| E2E és axe                 | még nincs | az `e2e/` a testing gazda területe, vele egyeztetendő                                                                                                                             |
| Dokumentáció               | részben   | ez a dokumentum és a README kész; a D26 döntés, a beadandó, a megfelelőségi táblázat és a Kézikönyv-fejezet a csapattal egyeztetendő                                              |

## Nyitott kérdések a csapatnak

- Falnál a teljes vázlat törlődjön (Róbert eredeti javaslata), vagy enyhébb fokozaton csak az adott futás felfedezései?
- Merítse-e le az üres csákányütés az akkut?
- A vázlat már az első változatban a szerveren legyen (több eszköz), vagy elég a böngésző?
- Saját pályán alapértelmezés legyen-e a Lámpafény, vagy maradjon a Nyitott?
