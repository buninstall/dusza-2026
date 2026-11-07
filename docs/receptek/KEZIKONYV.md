# Recept-kézikönyv

Ez a kézikönyv a [receptekhez](README.md) tartozik. Minden pályánál leírja, mi a csapda, mi a trükk, és mennyivel rövidebb a recept a kézenfekvő megoldásnál. A számokat egy pontos útvonalkereső számolta (minden parancssor egy lépés), a recepteket pedig a valódi MineScript-motor futtatta le; az eredményeket automata teszt őrzi.

## Hogyan számol a játék

- Minden végrehajtott sor egy lépés. A `step forward 9` kilenc mezőt lép, mégis egy sor.
- Egy rög ára legalább két sor: odalépés és `mine here`. Ez az alsó korlát.
- Minden kanyar egy `turn by` sor, bármekkora: a `turn by 2` hátraarc is csak egy.
- 1 rög: van arany. 2 rög: minden elérhető arany. 3 rög: minden arany legfeljebb a célértéknyi lépésből. A kampánypályák célértéke a pontos optimum.
- A ciklus kényelmes, de minden körben a feltétel is sornak számít, ezért a ranglistán az egyenes program nyer. Sötét pályán viszont a ciklus visz el a térképig.

## Nyitott, Lámpafény, Vaksötét

A pályák táblázatában a „Mód” oszlop azt mutatja, mennyire sötét a bánya. A robot érzékelése egyik módban sem változik, a lámpa csak a játékosnak világít.

| Mód | Induló fény | Teljes térkép | Falnak ütközés |
| --- | --- | --- | --- |
| nyitott | minden mező látszik | mindig | csak hibaüzenet |
| Lámpafény | a robot körüli 1 mező | három rög után | összetörik a lámpa, a vázlat törlődik |
| Vaksötét | csak a bejárt és megvizsgált mezők | három rög után | összetörik a lámpa, a vázlat törlődik |

- Minden kibányászott rög eggyel növeli a lámpa fénykörét, legfeljebb 4 mezőig; a fény falon nem megy át.
- Ami egy futásban felfedezett vagy megvilágított lett, a vázlatra kerül, és a következő futás előtt is látszik. A vázlat ebben a böngészőben, felhasználónként és pályaverziónként tárolódik.
- `E_BEDROCK_HIT` hibánál összetörik a lámpa, és a vázlat törlődik; a többi hiba nem töri össze. A biztonságos lépés: előbb `isThere 1`, csak utána `step forward 1`.
- Sötét pálya térképét csak a szerző és az adminisztrátor exportálhatja, más játékos futása Lámpafény nézetben nézhető vissza.

## A bányász szabályai

1. **A távolság ingyen van, a kanyar nem.** A rövidebb, de kanyargós út gyakran több sor, mint a hosszú egyenes (9. Kerülőút).
2. **Fordulj ott, ahol úgyis megállsz.** Egy rögön tett kanyar egy sor; máshol kettő, mert előbb oda kell lépni (14. Kilenc kristály).
3. **A program bárhol véget érhet.** A legmélyebb zsákutcát hagyd a végére, onnan már nem kell visszajönni (15., 21.).
4. **A közeli rög nem mindig az első.** Ami visszafelé egy egyenesbe esik, azt útközben olcsóbb felvenni (11., 16., 26.).
5. **Kevesebb átkelés, kevesebb kanyar.** Kapuknál, hidaknál, átjáróknál az a jó sorrend, amelyik ritkábban megy át (20., 23., 27.).
6. **Nem minden arany érhető el.** Ami körbe van falazva, azért kár sorokat égetni (6., 25.).
7. **A falkövetés sötétben is hazavisz, de a kör csapda.** Egy összefüggő járatban a jobbkéz-szabály mindenhová eljut; ahol kör van, ott a robot a végtelenségig járhat (13., 17., 24. vakon; 19.).

## A történet

A kampány harminc pályája hat fejezetre, hat kőzetrétegre oszlik. A fejezetek ötösével nyílnak: a következő akkor, ha az előző minden pályáján kibányásztad az összes elérhető aranyat. A Pályák oldal hátterében a bánya rétegről rétegre mélyül: agyag, mészkő, ametiszt, vasérc, malachit, obszidián, alatta az izzó mag.

### I. fejezet · Az elhagyott tárna (−12 … −60 m, agyag)

1926 telén a Dusza-tárna bányászai egyetlen éjszaka alatt felhagytak a munkával. A csillék a síneken maradtak, a lámpák a falakon. Száz év múlva R-07, egy acélból kovácsolt felfedező ereszkedik le a főaknán. Hat robot járt itt előtte. Egyik sem tért vissza.

> Gazdag ér, jó kőzet. Ha így megy, karácsonyra kifizetjük a társulat adósságát.
> — Kelemen Bálint főaknász naplója, 1926. november 3.

**Lelet: R-01.** A folyosó végén, a falnak préselődve. Lépett, mielőtt megnézte volna, mi van előtte. *Tanulság:* Lépés előtt: isThere 1. (`E_BEDROCK_HIT`)

### II. fejezet · A visszhangok csarnoka (−72 … −120 m, mészkő)

Mészkőcsarnokok, ahol minden hang ezerszer verődik vissza. Itt hallja meg R-07 először: valahol nagyon mélyen valami egyenletesen kopog.

> Harmadik napja halljuk a kopogást. Mélyről jön, egyenletesen, mint egy ingaóra.
> — Kelemen Bálint főaknász naplója, 1926. november 19.

**Lelet: R-02.** Egy oszlop tövében, lemerült akkuval. Körbe-körbe járt, mert a ciklusából nem vezetett kiút. *Tanulság:* Minden while-nak kell egy feltétel, amely egyszer hamis lesz. (`INSTRUCTION_COUNT_LIMIT_EXCEEDED`)

### III. fejezet · Az ametisztüregek (−132 … −180 m, ametiszt)

A kőzet lilán dereng. Üreges geodák, kristályerdők, tükröző falak. A szépség megállásra csábít, de a kopogás tovább hív lefelé.

> Ametisztet találtunk. Az emberek meg akartak állni, de a kopogás tovább hívta őket.
> — Kelemen Bálint főaknász naplója, 1926. december 2.

**Lelet: R-03.** Kettétört csákánnyal egy geoda mellett. Üres kőbe vágott, újra és újra. *Tanulság:* Csak aranyon bányássz: előbb isThere 2, utána lépés és mine here. (`E_NO_GOLD`)

### IV. fejezet · A vörös ér (−192 … −240 m, vasérc)

Rozsdavörös vasérc és egy iránytű, amely megbolondul. A sínek itt régebbiek, mint bármelyik térkép a társulat irodájában.

> A kőzet meleg, az iránytű körbe forog. Szabó Pista azt mondja, a hegy él. Nem merem megmondani nekik az igazat.
> — Kelemen Bálint főaknász naplója, 1926. december 11.

**Lelet: R-04.** Rozsdás roncs a sínek között. Egy változója egyszer szám volt, aztán igaz-hamis akart lenni. *Tanulság:* A változó típusa az első set-kor végleg rögzül. (`E_TYPE_MISMATCH`)

### V. fejezet · A smaragdtó (−252 … −300 m, malachit)

Föld alatti tó, zölden derengő moha, csepegő csend. A víz tükrében a kopogás hangja hullámokat vet.

> Bevallom: a kopogás az én művem. Megépítettem a Vakondot, hogy oda menjen, ahová ember már nem mehet. Egyetlen paranccsal küldtem le: amíg aranyat talál, bányásszon.
> — Kelemen Bálint főaknász naplója, 1926. december 18.

**Lelet: R-05.** A tó partján, mohával benőve. Olyasmire próbált emlékezni, amit sosem tudott: egy változót olvasott, mielőtt értéket adott volna neki. *Tanulság:* Előbb set, aztán használat. (`E_UNINITIALIZED`)

### VI. fejezet · A hegy szíve (−312 … −360 m, obszidián)

Fekete üveg és izzó láva. Itt már nem visszhang a kopogás: a falakból jön, a talpad alól, mindenhonnan. Valahol előtted dolgozik a Vakond.

> A Vakond elérte a hegy szívét, és a Szív aranya sosem fogy el. A kopogás nem áll meg. Holnap lezárjuk az aknát. Aki ezt olvassa: vigye el az utolsó rögöt is, és a Vakond végre megpihen.
> — Kelemen Bálint főaknász naplója, 1926. december 21.

**Lelet: R-06.** Egy lépésre a Szívtől. Olyat kérdezett a kőtől, amire nincs szó: isThere 3. *Tanulság:* Az isThere csak a 0, az 1 és a 2 értéket ismeri. (`E_BAD_ARG`)

### Epilógus · Csend

Az utolsó rög a csillédben van. A Szív elcsendesedett: a Vakond ciklusa véget ért, mert nincs több arany, amit kereshetne. Száz év után először csend van a Dusza-tárnában.

## Pályák fejezetenként

A „kézenfekvő terv” mindig a legkevesebb sorból elérhető legközelebbi rög felé indul; a „legrövidebb úton” terv a mezőben mért legrövidebb utat járja. Mindkettő tipikus első próbálkozás, és mindkettő rosszabb lehet a receptnél.

### I. fejezet · Az elhagyott tárna

| Pálya | Nehézség | Mód | Arany | Recept | Kézenfekvő terv | Legrövidebb úton |
| --- | --- | --- | --- | --- | --- | --- |
| [1. Egyenes folyosó](#01-egyenes-folyoso) | könnyű | nyitott | 2 / 2 | 4 | 4 | 4 |
| [2. Az első kanyar](#02-az-elso-kanyar) | könnyű | nyitott | 2 / 2 | 5 | 5 | 5 |
| [3. Kis labirintus](#03-kis-labirintus) | közepes | nyitott | 3 / 3 | 24 | 28 | 24 |
| [4. Zsákutcák](#04-zsakutcak) | közepes | nyitott | 5 / 5 | 31 | 33 | 37 |
| [5. Kígyó](#05-kigyo) | könnyű | Lámpafény | 3 / 3 | 12 | 12 | 12 |

#### <a id="01-egyenes-folyoso"></a>1. Egyenes folyosó

*R-07 első métere a Dusza-tárnában. Egyetlen sor, két aranyrög. Elég a step forward és a mine here.*

```text
1 8
>..@..@.
```

**A trükk:** Egy `step forward 3` három mezőt lép, mégis egyetlen sor. Minden rög legalább két sor (odalépés és bányászás), ezért a négy sor itt az elérhető legkevesebb.

Fájlok: [01-egyenes-folyoso.ms](01-egyenes-folyoso.ms) · [palyak/01-egyenes-folyoso.txt](palyak/01-egyenes-folyoso.txt)

#### <a id="02-az-elso-kanyar"></a>2. Az első kanyar

*A régi sín itt délnek fordul. A folyosó a végén kanyarodik: itt kell először a turn by.*

```text
4 6
>...@#
####.#
####.#
####@#
```

**A trükk:** Jobbra fordulni egyetlen `turn by 3`. A recept a kanyart az arany mezőjén teszi meg, ahol a bányászás miatt úgyis megáll: így a kanyar nem kér külön lépést.

Fájlok: [02-az-elso-kanyar.ms](02-az-elso-kanyar.ms) · [palyak/02-az-elso-kanyar.txt](palyak/02-az-elso-kanyar.txt)

#### <a id="03-kis-labirintus"></a>3. Kis labirintus

*A bányászok sietve vájt járatai. Három arany kanyargós járatokban. Érdemes az isThere-rel tapogatózni.*

```text
7 7
v#...@#
.#.#.##
.#.#...
...#.#@
##.#.#.
@..#...
#######
```

**A trükk:** A legközelebbi rög felé induló terv 28 sor. A recept a délnyugati röggel kezd, mert onnan egyetlen hosszú egyenes visz fel északra, és 24 sorból végez.

Fájlok: [03-kis-labirintus.ms](03-kis-labirintus.ms) · [palyak/03-kis-labirintus.txt](palyak/03-kis-labirintus.txt)

#### <a id="04-zsakutcak"></a>4. Zsákutcák

*Felhagyott fejtések, mindegyik végében maradt valami. Öt arany, több zsákutcával. A rövid út a kevesebb lépés.*

```text
7 9
>.......#
.##.###.#
.#@.#@..#
.####.#.#
...@#.#@#
##.##...#
@........
```

**A trükk:** Egy zsákutca ára: be, bányászás, `turn by 2`, ki. A recept úgy rendezi a sorrendet, hogy a kifelé tett lépés már a következő zsákutca felé vigyen.

Fájlok: [04-zsakutcak.ms](04-zsakutcak.ms) · [palyak/04-zsakutcak.txt](palyak/04-zsakutcak.txt)

#### <a id="05-kigyo"></a>5. Kígyó

*Hosszú, oda-vissza kanyargó folyosó, a végén R-01 roncsa. Kialszik a fény: jó terep a while ciklushoz.*

```text
5 11
>.........@
##########.
@..........
.##########
.........@.
```

**A trükk:** Minden szakasz egyetlen `step forward`, így a teljes folyosó 12 sor. Mezőnként lépkedő ciklussal sokkal több lenne, Lámpafényben viszont pont az a biztonságos.

Fájlok: [05-kigyo.ms](05-kigyo.ms) · [palyak/05-kigyo.txt](palyak/05-kigyo.txt)

### II. fejezet · A visszhangok csarnoka

| Pálya | Nehézség | Mód | Arany | Recept | Kézenfekvő terv | Legrövidebb úton |
| --- | --- | --- | --- | --- | --- | --- |
| [6. Elérhetetlen kincs](#06-elerhetetlen-kincs) | könnyű | Lámpafény | 2 / 3 | 6 | 6 | 6 |
| [7. Aranymező](#07-aranymezo) | közepes | Vaksötét | 12 / 12 | 29 | 31 | 31 |
| [8. A nagy bánya](#08-a-nagy-banya) | nehéz | Vaksötét | 9 / 9 | 84 | 84 | 94 |
| [9. Kerülőút](#09-kerulout) | könnyű | nyitott | 3 / 3 | 12 | 12 | 26 |
| [10. Oszlopcsarnok](#10-oszlopcsarnok) | nehéz | Lámpafény | 13 / 13 | 42 | 49 | 61 |

#### <a id="06-elerhetetlen-kincs"></a>6. Elérhetetlen kincs

*Az első mészkőcsarnok. Az egyik arany falakkal körülzárt kamrában van: nem minden kincs vihető el. A robot észak felé néz.*

```text
5 7
^.....@
.#####.
.#@.#..
.#..#..
.####.@
```

**A trükk:** A harmadik arany falakkal körülzárt kamrában van. Aki keresi, csak sorokat éget: a maximum 2 / 3 arany, és ez is teljes eredmény.

Fájlok: [06-elerhetetlen-kincs.ms](06-elerhetetlen-kincs.ms) · [palyak/06-elerhetetlen-kincs.txt](palyak/06-elerhetetlen-kincs.txt)

#### <a id="07-aranymezo"></a>7. Aranymező

*Tágas, visszhangos csarnok. Nyílt terep tizenkét arannyal. Ki gyűjti össze a legkevesebb lépésből?*

```text
6 10
..........
.@.@.@.@..
..........
.@.@>@.@..
..........
.@.@.@.@..
```

**A trükk:** Tizenkét rög három sorban. Soronként haladva minden rög két sor, a sorváltás pedig egy kanyar a sor szélső rögén. Ha a kanyar nem rögre esik, egy lépéssel több kell.

Fájlok: [07-aranymezo.ms](07-aranymezo.ms) · [palyak/07-aranymezo.txt](palyak/07-aranymezo.txt)

#### <a id="08-a-nagy-banya"></a>8. A nagy bánya

*A legnagyobb, 15×15-ös bánya, sok elágazással és szétszórt arannyal. Valahol mélyen egyenletesen kopog valami.*

```text
15 15
>....#....@...#
.###.#.##.###.#
.#@..#..#...#..
.#.####.###.#.#
.#......#@..#.#
.######.#.###.#
....@.#.#.....#
#####.#.#####.#
.@....#...@...#
.####.#######.#
.#..#.......#.#
.#@.#######.#..
.##.#.....#.###
....#.@.#...@.#
###...###.#####
```

**A trükk:** A legrövidebb, mezőben mért úton haladva 94 sor jön ki. A recept néhol hosszabb, de egyenesebb folyosót választ, és 84 sorból végez.

Fájlok: [08-a-nagy-banya.ms](08-a-nagy-banya.ms) · [palyak/08-a-nagy-banya.txt](palyak/08-a-nagy-banya.txt)

#### <a id="09-kerulout"></a>9. Kerülőút

*A rövid út kanyarog, a hosszú egyenes. Egy step forward tíz mezőt is visz egyetlen sorban: itt nem a távolság számít, hanem a kanyar.*

```text
7 9
v...#@...
@##.#.##@
.#..#..#.
.#.###.#.
.#.....#.
.#######.
.........
```

**A trükk:** A belső labirintuson át mezőben rövidebb az út, mégis 26 sor. A recept a pálya szélén halad: három kanyar, hosszú egyenesek, 12 sor. A távolság ingyen van, a kanyar nem.

Fájlok: [09-kerulout.ms](09-kerulout.ms) · [palyak/09-kerulout.txt](palyak/09-kerulout.txt)

#### <a id="10-oszlopcsarnok"></a>10. Oszlopcsarnok

*Oszlopok erdeje, R-02 nyomai körbe-körbe a porban. A rögök az oszlopok közt szóródtak szét: a sorrend dönti el, hány kanyar kell.*

```text
11 13
>.@..........
@#.#.#.#@#.#.
.............
.#.#@#.#.#@#.
.............
.#.#.#.#.#.#.
....@.@.....@
.#@#.#.#.#@#.
.............
@#.#.#.#.#.#.
....@.@......
```

**A trükk:** A robot előtt ott egy rög, a recept mégsem azzal kezd. Az oszlopsorok között minden sor és oszlop egyenes folyosó: az egy vonalba eső rögöket érdemes egymás után venni. A legközelebbi rög felé induló terv 49 sor, a recept 42.

Fájlok: [10-oszlopcsarnok.ms](10-oszlopcsarnok.ms) · [palyak/10-oszlopcsarnok.txt](palyak/10-oszlopcsarnok.txt)

### III. fejezet · Az ametisztüregek

| Pálya | Nehézség | Mód | Arany | Recept | Kézenfekvő terv | Legrövidebb úton |
| --- | --- | --- | --- | --- | --- | --- |
| [11. Geoda](#11-geoda) | könnyű | nyitott | 3 / 3 | 9 | 11 | 17 |
| [12. Kristálytükör](#12-kristalytukor) | könnyű | nyitott | 3 / 3 | 11 | 13 | 12 |
| [13. Lila erek](#13-lila-erek) | közepes | Lámpafény | 5 / 5 | 28 | 38 | 32 |
| [14. Kilenc kristály](#14-kilenc-kristaly) | közepes | nyitott | 9 / 9 | 26 | 34 | 35 |
| [15. Ametisztkatedrális](#15-ametisztkatedralis) | nehéz | Vaksötét | 11 / 11 | 42 | 55 | 67 |

#### <a id="11-geoda"></a>11. Geoda

*Lila kristályokkal bélelt üreg, a kristályok fényt adnak. Három rög, egy kézenfekvő út és egy, amelyik két sorral rövidebb.*

```text
5 7
##@..##
#.....#
..@^..@
#.....#
##...##
```

**A trükk:** A szomszéd rög csalogat. A recept előbb a túloldalra megy, onnan egy egyenesben veszi fel a közelit, majd ugyanabban az oszlopban a harmadikat: 9 sor a kézenfekvő 11 helyett.

Fájlok: [11-geoda.ms](11-geoda.ms) · [palyak/11-geoda.txt](palyak/11-geoda.txt)

#### <a id="12-kristalytukor"></a>12. Kristálytükör

*Tükrös kristályfal: a bánya két fele majdnem egyforma, de csak majdnem. Számít, merre néz induláskor a robot.*

```text
5 9
@...#....
.##.#.##.
....>....
.##.#.##.
@@..#....
```

**A trükk:** A robot kelet felé néz, de minden rög nyugaton van. A recept először a legtávolabbi sarokba megy, és onnan lefelé söpör végig: a fordulók a rögökre esnek.

Fájlok: [12-kristalytukor.ms](12-kristalytukor.ms) · [palyak/12-kristalytukor.txt](palyak/12-kristalytukor.txt)

#### <a id="13-lila-erek"></a>13. Lila erek

*Az ametisztér lépcsőzetesen fut lefelé. A lépcsőn minden fok két sor: néha a kerülő a rövidebb, és a sorrend mindent eldönt.*

```text
9 11
>..........
##.#######.
##..######.
###..#####.
####@.####.
#####.@###.
######.@##.
#######@...
#########@#
```

**A trükk:** A lépcsőn minden fok két sor. A recept a pálya szélén megkerüli a lépcsőt, alulról indul felfelé, és a lépcső közepén fejezi be: 28 sor a kézenfekvő 38 helyett.

Fájlok: [13-lila-erek.ms](13-lila-erek.ms) · [13-lila-erek-vakon.ms](13-lila-erek-vakon.ms) (vakon) · [palyak/13-lila-erek.txt](palyak/13-lila-erek.txt)

**Vakon:** Fordulj jobbra, és amíg fal van előtted, fordulj balra; aztán lépj egyet, és ha arany volt előtted, bányássz. A pálya egyetlen összefüggő járat, ezért a falkövető vakon is mind az öt rögöt megtalálja.

```minescript
set talalt to 0
set kell to 5
set megy to true
while megy
    turn by 3
    set fal to isThere 1
    while fal
        turn by 1
        set fal to isThere 1
    set arany to isThere 2
    step forward 1
    if arany
        mine here
        set talalt to talalt + 1
    set megy to talalt < kell
```

#### <a id="14-kilenc-kristaly"></a>14. Kilenc kristály

*Kilenc kristály szabálytalan rácsban. Ahol úgyis megállsz bányászni, ott fordulj: a kanyar ott csak egy sor.*

```text
7 7
v......
.@....@
.@.#...
..@..@.
.#...@.
.@...@.
......@
```

**A trükk:** Kilenc rög szabálytalan rácsban. Ahol úgyis megállsz bányászni, ott a kanyar egy sor; máshol kettő, mert előbb oda kell lépni. A recept így 26 sor, a kézenfekvő terv 34.

Fájlok: [14-kilenc-kristaly.ms](14-kilenc-kristaly.ms) · [palyak/14-kilenc-kristaly.txt](palyak/14-kilenc-kristaly.txt)

#### <a id="15-ametisztkatedralis"></a>15. Ametisztkatedrális

*Szimmetrikus kristálycsarnok kápolnákkal, tizenegy röggel. Ha egy rög holtágban van, hagyd a végére: a programnak nem kell visszajönnie.*

```text
13 13
######v######
#@..........#
#.##.###.##.#
#.#@.....@#.#
#.#@##.##.#.#
#...#...#...#
##.##...##.##
#.@.#...#...#
#@#.##@##.#.#
#.#@......#.#
#.##.###.##@#
#@.........@#
#############
```

**A trükk:** Tizenegy rög kápolnákkal. A program bárhol véget érhet, ezért a recept a holtágakat úgy rendezi, hogy a legmélyebb végén fejezzen be: 42 sor, a kézenfekvő terv 55.

Fájlok: [15-ametisztkatedralis.ms](15-ametisztkatedralis.ms) · [palyak/15-ametisztkatedralis.txt](palyak/15-ametisztkatedralis.txt)

### IV. fejezet · A vörös ér

| Pálya | Nehézség | Mód | Arany | Recept | Kézenfekvő terv | Legrövidebb úton |
| --- | --- | --- | --- | --- | --- | --- |
| [16. Rozsdás sínek](#16-rozsdas-sinek) | könnyű | nyitott | 3 / 3 | 9 | 9 | 16 |
| [17. Iránytű](#17-iranytu) | közepes | Lámpafény | 5 / 5 | 28 | 34 | 40 |
| [18. Vasércfejtés](#18-vasercfejtes) | közepes | nyitott | 10 / 10 | 29 | 36 | 43 |
| [19. A vörös labirintus](#19-a-voros-labirintus) | nehéz | Vaksötét | 10 / 10 | 74 | 113 | 125 |
| [20. Kapuk](#20-kapuk) | nehéz | Lámpafény | 11 / 11 | 50 | 64 | 73 |

#### <a id="16-rozsdas-sinek"></a>16. Rozsdás sínek

*Két párhuzamos rozsdás sín. Nem az számít, melyik rög van közelebb, hanem hogy utána merre mész tovább.*

```text
3 10
>...@.....
.########.
.@.......@
```

**A trükk:** Az alsó sín bal végén lévő rög van a legközelebb, mégis az az utolsó. A recept a felső sínen végigmegy, a végén lefordul, és az alsó sínen egyetlen egyenesben veszi fel a két rögöt.

Fájlok: [16-rozsdas-sinek.ms](16-rozsdas-sinek.ms) · [palyak/16-rozsdas-sinek.txt](palyak/16-rozsdas-sinek.txt)

#### <a id="17-iranytu"></a>17. Iránytű

*Megbolondult iránytű egy kereszteződésben. Öt rög négy irányban: az első ötlet itt nem a legjobb. Sötétben a jobb kéz szabálya is hazavisz.*

```text
9 9
###.@.###
###.#.###
###...###
.@.#@#..@
....<@...
...#.#...
###...###
###.#.###
###...###
```

**A trükk:** Öt rög négy irányban. A kereszteződésből minden ág külön kirándulás; a recept úgy választja a sorrendet, hogy a visszaút mindig a következő ág felé nézzen. 28 sor a kézenfekvő 34 helyett.

Fájlok: [17-iranytu.ms](17-iranytu.ms) · [17-iranytu-vakon.ms](17-iranytu-vakon.ms) (vakon) · [palyak/17-iranytu.txt](palyak/17-iranytu.txt)

**Vakon:** Ugyanaz a falkövető, mint a Lila ereknél. A kereszteződés ágai zsákutcák, ezért a jobbkéz-szabály mindegyikbe bemegy és kijön: a térkép ismerete nélkül is mind az öt rög meglesz.

```minescript
set talalt to 0
set kell to 5
set megy to true
while megy
    turn by 3
    set fal to isThere 1
    while fal
        turn by 1
        set fal to isThere 1
    set arany to isThere 2
    step forward 1
    if arany
        mine here
        set talalt to talalt + 1
    set megy to talalt < kell
```

#### <a id="18-vasercfejtes"></a>18. Vasércfejtés

*Nyitott vasércfejtés tíz szétszórt röggel. Egy kígyózó út mindet felszedi, ha a rögökön fordulsz, nem mellettük.*

```text
7 9
>........
...@..@..
..@......
.@.@.....
..@.@.@.@
...@.....
.........
```

**A trükk:** Tíz rög nyílt terepen. A kígyózó út akkor rövid, ha a kanyarok rögökre esnek. A legközelebbi rög felé induló terv 36 sor, a recept 29.

Fájlok: [18-vasercfejtes.ms](18-vasercfejtes.ms) · [palyak/18-vasercfejtes.txt](palyak/18-vasercfejtes.txt)

#### <a id="19-a-voros-labirintus"></a>19. A vörös labirintus

*Vörös kőzetbe vájt, körökkel teli útvesztő, teljes sötétben. Vigyázz a falkövetéssel: egy kör körül a robot a végtelenségig járhat, ahogy R-02.*

```text
13 13
>....#......#
####.#.###.#@
#....#...#...
#.##.##.#.###
#@#@..#@#@..#
#.#.#.#.###.#
#...#@#.....#
#####.##.##.#
#..@#.#.@.#.#
#.#.#...#@#.#
#.#.##@##.#.#
#.#.......#.#
#.#########..
```

**A trükk:** Körökkel teli útvesztő. A falkövető itt egy kör körül a végtelenségig járhat, a legközelebbi rög felé induló terv pedig 113 sor. A recept 74: a körök közül mindig az egyenesebbet választja.

Fájlok: [19-a-voros-labirintus.ms](19-a-voros-labirintus.ms) · [palyak/19-a-voros-labirintus.txt](palyak/19-a-voros-labirintus.txt)

#### <a id="20-kapuk"></a>20. Kapuk

*Kilenc kamra, keskeny kapuk, a kapuk mögött R-04 roncsa. Melyik kapun át, milyen sorrendben? Aki mindig a legközelebbi rög felé indul, tizennégy sorral többet ír.*

```text
13 13
>...#...#....
@...#........
....@.@.#...@
.@..#@..#....
##.####.###.#
....#...#..@.
........#@...
..@.#........
#.###.####.##
....#...#...@
....#........
........#..@.
....#...#....
```

**A trükk:** Kilenc kamra, keskeny kapuk. Minden kapuátkelés kanyarokkal jár, ezért az a jó sorrend, amelyik a legritkábban megy át kapun. A legközelebbi rög felé induló terv 64 sor, a recept 50.

Fájlok: [20-kapuk.ms](20-kapuk.ms) · [palyak/20-kapuk.txt](palyak/20-kapuk.txt)

### V. fejezet · A smaragdtó

| Pálya | Nehézség | Mód | Arany | Recept | Kézenfekvő terv | Legrövidebb úton |
| --- | --- | --- | --- | --- | --- | --- |
| [21. Mohafény](#21-mohafeny) | könnyű | nyitott | 3 / 3 | 12 | 13 | 14 |
| [22. Szigetek](#22-szigetek) | közepes | nyitott | 8 / 8 | 29 | 39 | 52 |
| [23. Tükörtó](#23-tukorto) | közepes | Lámpafény | 8 / 8 | 36 | 48 | 49 |
| [24. Smaragdkígyó](#24-smaragdkigyo) | nehéz | Vaksötét | 12 / 12 | 42 | 43 | 51 |
| [25. A tó szeme](#25-a-to-szeme) | nehéz | Lámpafény | 12 / 13 | 59 | 75 | 90 |

#### <a id="21-mohafeny"></a>21. Mohafény

*Zölden derengő moha egy fésűs járatban. A program bárhol véget érhet: a legmélyebb ágat hagyd utoljára.*

```text
5 7
>.@....
.#.#.#.
@#.#.#.
.#.#@#.
.#.#.#.
```

**A trükk:** Fésűs járat, a fogak zsákutcák. Mivel a program bárhol véget érhet, a recept a legmélyebb fogat hagyja utoljára, és onnan már nem jön vissza.

Fájlok: [21-mohafeny.ms](21-mohafeny.ms) · [palyak/21-mohafeny.txt](palyak/21-mohafeny.txt)

#### <a id="22-szigetek"></a>22. Szigetek

*Kőszigetek a smaragdtó partján, nyolc röggel. A sziget megkerülése néha olcsóbb, mint az átkelés.*

```text
9 11
...........
.##.....##.
.##.....##.
@.@..#..@..
>...###...@
...@.#.....
.##....@##.
@##..@..##.
...........
```

**A trükk:** Kőszigetek a nyílt vízen. A sziget mellett gyakran egyetlen egyenes visz a következő rögig, átvágva viszont két kanyar kell. A recept 29 sor, a legrövidebb úton haladó terv 52.

Fájlok: [22-szigetek.ms](22-szigetek.ms) · [palyak/22-szigetek.txt](palyak/22-szigetek.txt)

#### <a id="23-tukorto"></a>23. Tükörtó

*A tó közepén kőfal, két oldalán tükörképek. Melyik partot járod be először, és hol kelsz át?*

```text
7 11
.....#@....
.###@#.###@
.....#.@...
#.#.>..@#.#
....@#.....
@###.#.###.
.....#....@
```

**A trükk:** A tó két partját csak a középső átjáró köti össze. A recept úgy osztja be a sorrendet, hogy minél ritkábban kelljen átjönni: 36 sor a kézenfekvő 48 helyett.

Fájlok: [23-tukorto.ms](23-tukorto.ms) · [palyak/23-tukorto.txt](palyak/23-tukorto.txt)

#### <a id="24-smaragdkigyo"></a>24. Smaragdkígyó

*Hosszú, kígyózó járat a víz szintje alatt, tizenkét röggel, sötétben. A falak mentén tapogatózva is célba érsz.*

```text
11 11
>.....@@...
##########.
@..........
@##########
......@...@
##########.
....@......
.##########
......@....
##.#######.
@.@@.....@.
```

**A trükk:** Hosszú kígyójárat, a kanyarok a fordulókban vannak. Az alsó szakaszra két átjáró vezet; a recept azt választja, amelyikről a megmaradt rögök egy vonalban vannak.

Fájlok: [24-smaragdkigyo.ms](24-smaragdkigyo.ms) · [24-smaragdkigyo-vakon.ms](24-smaragdkigyo-vakon.ms) (vakon) · [palyak/24-smaragdkigyo.txt](palyak/24-smaragdkigyo.txt)

**Vakon:** A jobbkéz-szabály a hosszú kígyón is végigér teljes sötétben. 804 sor: belefér az 1000 soros keretbe, de csak éppen, ezért itt nincs hely felesleges ellenőrzésre.

```minescript
set talalt to 0
set kell to 12
set megy to true
while megy
    turn by 3
    set fal to isThere 1
    while fal
        turn by 1
        set fal to isThere 1
    set arany to isThere 2
    step forward 1
    if arany
        mine here
        set talalt to talalt + 1
    set megy to talalt < kell
```

#### <a id="25-a-to-szeme"></a>25. A tó szeme

*A tó közepén zárt kamra, benne egy rög: a tó szeme, amit senki nem érhet el. Körülötte tizenkét rög a moha alatt.*

```text
15 15
v......#....@@.
.#####.#.#####.
.#.@...@.....#.
.#.##.....##.#.
.#.#@......#@#.
...#..###..#...
##....#.#....##
#..@.##@##....#
##....#.#....##
...#..###..#...
.#.#..@...@#.#.
.#.##...@.##.#@
.#...........#.
.#####.#.#####.
.@.....#.......
```

**A trükk:** A tó közepén lévő kamrába nem vezet út, így a maximum 12 / 13 arany. A többi rög a tó körüli gyűrűkön van; a recept 59 sor, a legközelebbi rög felé induló terv 75.

Fájlok: [25-a-to-szeme.ms](25-a-to-szeme.ms) · [palyak/25-a-to-szeme.txt](palyak/25-a-to-szeme.txt)

### VI. fejezet · A hegy szíve

| Pálya | Nehézség | Mód | Arany | Recept | Kézenfekvő terv | Legrövidebb úton |
| --- | --- | --- | --- | --- | --- | --- |
| [26. Hamuréteg](#26-hamureteg) | könnyű | nyitott | 3 / 3 | 12 | 14 | 16 |
| [27. Lávafolyó](#27-lavafolyo) | közepes | nyitott | 8 / 8 | 33 | 39 | 55 |
| [28. Obszidiánkapu](#28-obszidiankapu) | nehéz | Lámpafény | 12 / 12 | 50 | 73 | 74 |
| [29. Izzó tárnák](#29-izzo-tarnak) | nehéz | Vaksötét | 13 / 13 | 65 | 91 | 96 |
| [30. A Szív](#30-a-sziv) | nehéz | Vaksötét | 13 / 13 | 55 | 63 | 94 |

#### <a id="26-hamureteg"></a>26. Hamuréteg

*Hamu és izzó parázs, az első lávaerek. Kevés rög, de csak egyetlen útvonal fér bele a célértékbe.*

```text
5 9
>........
.#.#.#.#@
...@.....
.#.#.#.#.
..@......
```

**A trükk:** A közeli rög felé indulni csábító. A recept előbb a pálya szélén megy végig, és a közelit visszafelé, útba ejtve veszi fel: 12 sor, épp a célértéken belül.

Fájlok: [26-hamureteg.ms](26-hamureteg.ms) · [palyak/26-hamureteg.txt](palyak/26-hamureteg.txt)

#### <a id="27-lavafolyo"></a>27. Lávafolyó

*Láva szeli ketté a csarnokot, két kőhíddal. Minden átkelés drága: tervezd meg, hányszor mész át.*

```text
11 13
>....@#......
.@....#......
.............
......#......
..@..##......
.....#@......
.....##......
......#.....@
......@......
......#@.....
....@.#......
```

**A trükk:** Két híd vezet át a lávafolyón. A recept úgy osztja be a sorrendet, hogy minél ritkábban kelljen átkelni: 33 sor, a legrövidebb úton haladó terv 55.

Fájlok: [27-lavafolyo.ms](27-lavafolyo.ms) · [palyak/27-lavafolyo.txt](palyak/27-lavafolyo.txt)

#### <a id="28-obszidiankapu"></a>28. Obszidiánkapu

*Fekete üveg kapui, zsákutcák és körök. Itt állt meg R-06. Aki mindig a legközelebbi rög felé indul, huszonhárom sorral hosszabb programot ír, mint kellene.*

```text
11 13
>...@#...@@..
.###.#@#####.
.#..@@.#...#.
.#.###.#@#.#.
@#...#@@.#@..
.###.#####.##
.....#.....#.
####.#.###.#.
.....#.#.....
.#####.#.###.
.......#...@.
```

**A trükk:** Zsákutcák és körök. A legközelebbi rög felé induló terv itt a legdrágább: 73 sor. A recept 50: a körök közül azt járja be, amelyik útközben a legtöbb rögön visz át.

Fájlok: [28-obszidiankapu.ms](28-obszidiankapu.ms) · [palyak/28-obszidiankapu.txt](palyak/28-obszidiankapu.txt)

#### <a id="29-izzo-tarnak"></a>29. Izzó tárnák

*Egymás alatt futó izzó tárnák, egyetlen közös aknával. Sötét van és fullasztó meleg. A kopogás már a talpad alól jön.*

```text
15 15
>@.........@...
#.###########.#
#.#@....@...#.#
#.#.#######.#.#
#...#.....#...#
###@#.#@#@#.###
#.@.#@#.#.#...#
#@###@#.#.###.#
#.....#.#.....#
#######.#######
#.............#
#.###.###@###.#
#.#@#.#.#.#.#.#
#.#...#...#...#
#.#############
```

**A trükk:** Egymás alatti tárnák, egyetlen közös aknával. Minden tárnaváltás az aknán át vezet, ezért a recept egy tárnában mindent összeszed, mielőtt továbbmegy: 65 sor a kézenfekvő 91 helyett.

Fájlok: [29-izzo-tarnak.ms](29-izzo-tarnak.ms) · [palyak/29-izzo-tarnak.txt](palyak/29-izzo-tarnak.txt)

#### <a id="30-a-sziv"></a>30. A Szív

*A hegy szíve. Gyűrűk gyűrűkben, a közepén dolgozik a Vakond. Gyűjtsd össze az utolsó rögöt is, és a kopogás végre elhallgat.*

```text
15 15
>.....@.....@@.
@##########.##.
.#..@........#.
.#.####.####@#.
.#.#.......#.#.
.#.#.##.##.#.#.
.#.#.#...#@#.#@
.#.#.#.....#.#.
.#.#@#..@#.#.#.
@#.#.#####.#.#.
.#.#.......#.#.
.#.######.##.#.
.#..........@#.
.##@##########.
...............
```

**A trükk:** Gyűrűk gyűrűkben, a közepén a Vakond. A gyűrűk közti rések rövidítések: a recept 55 sorból ér a Szívig úgy, hogy közben mind a 13 rögöt felveszi.

Fájlok: [30-a-sziv.ms](30-a-sziv.ms) · [palyak/30-a-sziv.txt](palyak/30-a-sziv.txt)

## Homokozó bemutatók

A Homokozó hét bemutató pályája együtt a MineScript minden elemét lefedi. Ezek a receptek a nyelvet tanítják, nem a legrövidebb utat: mindegyik pálya célértéke rövidebb a receptnél, az egyenes program kiszámolása a játékos feladata.

### Lépés és csákány

Készítette: demo2 · Elemek: step forward, mine here · Recept: 4 lépés, 2 arany

```text
1 8
>..@..@.
```

```minescript
step forward 3
mine here
step forward 3
mine here
```

A legegyszerűbb program: két lépés, két bányászás. A step forward paramétere azt mondja meg, hány mezőt lépjen a robot egyetlen sorban.

### Négy irány

Készítette: demo3 · Elemek: turn by 1, 2 és 3 · Recept: 13 lépés, 4 arany

```text
3 5
@.>.@
.###.
@...@
```

```minescript
step forward 2
mine here
turn by 3
step forward 2
mine here
turn by 2
step forward 2
turn by 1
step forward 4
mine here
turn by 1
step forward 2
mine here
```

A turn by n n negyedfordulat balra: 1 balra, 2 hátraarc, 3 jobbra, és mindegyik egyetlen sor. A recept mindhármat bemutatja; a célérték ennél rövidebb, keresd meg!

### Tapogatózás

Készítette: demo2 · Elemek: isThere 0/1/2, if/else, print · Recept: 11 lépés, 1 arany · Konzol: true, true, true

```text
1 5
>.@.#
```

```minescript
set ures to isThere 0
print ures
step forward 1
set arany to isThere 2
print arany
if arany
    step forward 1
    mine here
else
    step forward 1
step forward 1
set fal to isThere 1
print fal
```

Az isThere csak a robot előtti mezőt vizsgálja: 0 üres, 1 fal, 2 arany. Az eredmény logikai érték, amit set ment el, if dönt róla, print pedig kiír a konzolra.

### Menj a falig

Készítette: demo3 · Elemek: while, not, számláló · Recept: 71 lépés, 3 arany · Konzol: 3

```text
1 11
>..@..@..@#
```

```minescript
set count to 0
set fal to isThere 1
set megy to not fal
while megy
    set arany to isThere 2
    if arany
        step forward 1
        mine here
        set count to count + 1
    else
        step forward 1
    set fal to isThere 1
    set megy to not fal
print count
```

A feladatkiírás példaprogramja. A while addig ismétel, amíg a feltétele igaz; a not megfordítja a logikai értéket. A végén a print kiírja, hány rögöt talált: 3.

### Számlálás

Készítette: demo2 · Elemek: + - *, < <= > >= · Recept: 34 lépés, 4 arany · Konzol: 100, 0, true, false, true

```text
1 10
>.@.@.@.@.
```

```minescript
set kor to 0
set hossz to 2
set megy to kor < 4
while megy
    step forward hossz
    mine here
    set kor to kor + 1
    set megy to kor < 4
set pont to kor * 25
print pont
set maradt to 4 - kor
print maradt
set tele to kor >= 4
print tele
set ures to kor <= 0
print ures
set tobb to pont > 99
print tobb
```

Egész számok és összehasonlítások. A step forward paramétere változó is lehet (hossz). A konzolon sorban: 100, 0, true, false, true.

### Logikai kapuk

Készítette: demo3 · Elemek: and, or, not, = és <>, true/false · Recept: 93 lépés, 3 arany · Konzol: true, true, true

```text
1 9
>.@..@.@#
```

```minescript
set talalt to 0
set kesz to false
set fut to not kesz
while fut
    set arany to isThere 2
    set ures to isThere 0
    set mehet to arany or ures
    if mehet
        step forward 1
        if arany
            mine here
            set talalt to talalt + 1
    set eleg to talalt = 3
    set fal to isThere 1
    set kesz to eleg or fal
    set fut to not kesz
set mind to eleg and fal
print mind
set mas to talalt <> 2
print mas
set igaz to true
print igaz
```

Összetett feltétel két lépésben: a MineScriptben nincs zárójel, ezért minden részeredményt külön set ment el. A ciklus akkor áll meg, ha elég aranyat talált, vagy fal jön.

### Jobb kéz a falon

Készítette: demo2 · Elemek: egymásba ágyazott while, jobbkéz-szabály · Recept: 444 lépés, 3 arany

```text
7 9
>..#.....
##.#.###.
...#.#@#.
.###.#.#.
.....#@..
#######.#
@........
```

```minescript
set talalt to 0
set kell to 3
set megy to true
while megy
    turn by 3
    set fal to isThere 1
    while fal
        turn by 1
        set fal to isThere 1
    set arany to isThere 2
    step forward 1
    if arany
        mine here
        set talalt to talalt + 1
    set megy to talalt < kell
```

A külső ciklus lépésenként halad, a belső addig fordul balra, amíg fal van előtte. A robot a térkép ismerete nélkül is mind a három rögöt megtalálja: 444 sor, belefér az 1000-be.
