export type ManualBlock =
  | { readonly kind: "paragraph"; readonly text: string }
  | { readonly kind: "heading"; readonly text: string }
  | {
      readonly kind: "code";
      readonly code: string;
      readonly caption: string;
      readonly map?: string;
    }
  | { readonly kind: "list"; readonly items: readonly string[] }
  | { readonly kind: "steps"; readonly items: readonly string[] }
  | { readonly kind: "tip"; readonly title: string; readonly text: string }
  | {
      readonly kind: "table";
      readonly caption: string;
      readonly head: readonly string[];
      readonly rows: readonly (readonly string[])[];
    };

export type ManualSection = {
  readonly id: string;
  readonly title: string;
  readonly blocks: readonly ManualBlock[];
};

const sections: readonly ManualSection[] = [
  {
    id: "alapok",
    title: "A játék röviden",
    blocks: [
      {
        kind: "paragraph",
        text: "Egy elhagyott bánya mélyén aranyrögök várnak, és csak a kincskereső robot juthat el hozzájuk. A robot magától semmit sem tud: pontosan azt teszi, amit a MineScript-programod sorról sorra előír. A sötétben csak a közvetlenül előtte lévő mezőt látja, és csak azon a mezőn bányászhat, amelyen éppen áll.",
      },
      {
        kind: "paragraph",
        text: "A cél: minél több aranyat kibányászni, minél kevesebb programsor végrehajtásával. A ranglistán az áll előrébb, aki több aranyat gyűjtött; azonos aranynál az, akinek ehhez kevesebb lépés kellett.",
      },
      {
        kind: "paragraph",
        text: "Két játékmód van. A Homokozó a szabad bánya: a játékosok pályái, a napi kihívás és a MineScriptet bemutató pályák. A Történet harminc pályán, hat fejezetben vezet le a hegy szívéig. A `Pályák` oldal tetején, a rozsdás táblán váltasz közöttük.",
      },
      { kind: "heading", text: "Egy kör menete" },
      {
        kind: "steps",
        items: [
          "**Válassz pályát.** A `Pályák` oldalon kattints egy pálya `Játék` gombjára. A Történetben a tábla `Folytatás` gombja egyenesen a következő befejezetlen pályára visz.",
          "**Írd meg a programot.** A szerkesztő széles képernyőn bal oldalt, telefonon a térkép alatt van. A `Robot`, `Érzékelés`, `Változók`, `Döntés` és `Ciklus` fiókokból kész mintákat szúrhatsz be, vagy `.ms` és `.txt` fájlt importálhatsz.",
          "**Futtasd.** A `Futtatás` gomb előbb ellenőrzi a programot. Hibás programot nem indít el, hanem megjelöli a hibás sorokat.",
          "**Nézd a lejátszást.** A térkép és a robot alaphelyzetbe kerül, és a futás lassítva lejátszódik. A műszersávon az éppen végrehajtott sor, az arany és a lépések látszanak; a konzolt és a változókat a `Konzol` gomb nyitja meg.",
          "**Eredmény.** A lejátszás végén a szerver a programodból újra kiszámolja az eredményt, rögzíti a ranglistán, és megkapod a rögöket.",
        ],
      },
      {
        kind: "tip",
        title: "Bevezető",
        text: "Első belépéskor a játék felajánl egy bevezetőt: bemutatja a két módot, és te választod ki, melyikben melegítesz be. A bevezető ennek a kézikönyvnek a tetején, a `Bevezető újrakezdése` gombbal bármikor újraindítható.",
      },
      {
        kind: "tip",
        title: "Nagyítás és elrendezés",
        text: "A térképet a fejléc `+` és `−` gombjával, görgővel vagy csippentéssel nagyíthatod a kurzor körül, nagyítva pedig húzással mozgathatod. A szerkesztő és a bánya közti határ húzással vagy a nyílbillentyűkkel állítható, dupla kattintásra visszaáll.",
      },
      {
        kind: "tip",
        title: "Kezdd a próbapaddal",
        text: "A kézikönyv példái mellett kis bánya áll. A `Lejátszás` gombbal ott helyben megnézheted, mit csinál a program, mielőtt a saját pályádon kipróbálnád.",
      },
    ],
  },
  {
    id: "modok",
    title: "Homokozó és Történet",
    blocks: [
      { kind: "heading", text: "Homokozó" },
      {
        kind: "paragraph",
        text: "A Homokozó a `Pályák` oldal alapnézete. Itt vannak a játékosok pályái, a napi kihívás és hét bemutató pálya, amelyek sorra bemutatják a MineScript minden elemét. Itt nincs zárolás: minden pálya azonnal játszható.",
      },
      {
        kind: "list",
        items: [
          "**Összes és Sajátjaim.** Az `Összes` fül minden közzétett pályát mutat, a `Sajátjaim` csak a tieidet, a privátokat is.",
          "**Szűrés és rendezés.** A tábla alsó sorában szűrhetsz nehézségre (`Könnyű`, `Közepes`, `Nehéz`), és rendezhetsz (`Legújabb`, `Sorrend`, `Méret`, `Arany`). A pályák nyolcasával jelennek meg, a lista alján a `Továbbiak` gomb hozza a következőket.",
          "**Nehézség.** A nehézséget a szerver számolja a pálya legrövidebb megoldásából: legfeljebb 12 lépés könnyű, legfeljebb 40 közepes, fölötte nehéz. Így minden új pálya magától besorolódik.",
          "**Új térkép.** A tábla jobb felső gombja és a lista alján a `Fúrófront` a térképszerkesztőbe visz.",
          "**Napi kihívás.** Minden nap új, géppel generált pálya a lista tetején: mindenki ugyanazt kapja, és saját ranglistája van.",
        ],
      },
      { kind: "heading", text: "Történet" },
      {
        kind: "paragraph",
        text: "A Történet harminc pálya hat fejezetben, fejezetenként öt pályával. Minden fejezet egy-egy kőzetréteg: agyag, mészkő, ametiszt, vasérc, malachit és obszidián, alatta az izzó mag. A háttérben a bánya rétegről rétegre mélyül, és a pályák is nehezednek: tíz könnyű, tíz közepes és tíz nehéz.",
      },
      {
        kind: "list",
        items: [
          "**Kész pálya.** Egy pálya akkor kész, ha minden elérhető aranyát kibányásztad, vagyis legalább két rögöd van rajta.",
          "**Fejezetek nyitása.** Az első fejezet mindig nyitva van. A következő akkor nyílik, ha az összes előző fejezet minden pályája kész.",
          "**A számláló.** A fejezetek közé vájt felirat (`MÉG 4 PÁLYA`) összesítve mutatja, hány pálya hiányzik még az előző fejezetekből. Ha a fejezet már nyitva van, `NYITVA` áll ott.",
          "**Zárt pálya.** A zárt fejezet pályái is látszanak, szürke lakattal és `Zárva` jelzéssel. Nem játszhatók, de a ranglistájuk megnézhető.",
          "**A tábla.** A Történet táblája a rögeid összegét, a kész pályák számát, az aktuális fejezetet és a `Folytatás` gombot mutatja; a `Ranglista` a Történet összesített ranglistájára visz.",
        ],
      },
      {
        kind: "tip",
        title: "Tesztelőknek",
        text: "A Receptek oldal `Megnyitás` gombja a zárt Történet-pályát is megnyitja a kész programmal. Ha a receptet lefuttatod, a pálya kész lesz, és ezzel a fejezetek is sorban kinyithatók.",
      },
    ],
  },
  {
    id: "elso-program",
    title: "Az első program",
    blocks: [
      {
        kind: "paragraph",
        text: "A legegyszerűbb program néhány robotparancsból áll. Az alábbi bányában a robot kelet felé néz, az arany három mezővel előtte van. Elég odamenni és kibányászni.",
      },
      {
        kind: "code",
        caption: "Három lépés előre, majd bányászás: 1 arany, 2 lépés",
        map: "1 5\n>..@.",
        code: "step forward 3\nmine here",
      },
      {
        kind: "paragraph",
        text: "A `step forward 3` egyetlen sorral három mezőt halad, ezért egy lépésnek számít. A `mine here` kibányássza az aranyat abból a mezőből, amelyen a robot áll. Ha nincs ott arany, a futás `E_NO_GOLD` hibával megáll.",
      },
      {
        kind: "paragraph",
        text: "Kanyarodni a `turn by n` paranccsal lehet: a robot n negyedfordulatot fordul balra. Jobbra fordulni három balra fordulással lehet, ezért a jobbkanyar `turn by 3`, a hátraarc pedig `turn by 2`.",
      },
      {
        kind: "code",
        caption: "Két lépés, jobbkanyar, két lépés, bányászás",
        map: "3 3\n>..\n##.\n##@",
        code: "step forward 2\nturn by 3\nstep forward 2\nmine here",
      },
    ],
  },
  {
    id: "terkep",
    title: "A térkép",
    blocks: [
      {
        kind: "paragraph",
        text: "A térkép legfeljebb 15 × 15 kamrából álló rács. Fájlban így néz ki: az első sor a méret (sorok és oszlopok száma, egy szóközzel elválasztva, mindkettő 1 és 15 között), utána pontosan ennyi sor jön, mindegyikben pontosan ennyi jellel.",
      },
      {
        kind: "code",
        caption: "Térképfájl: 3 sor, 15 oszlop",
        code: "3 15\n....@..........\n.#############.\n.......@...>...",
      },
      {
        kind: "table",
        caption: "A térkép jelei",
        head: ["Jel", "Jelentés"],
        rows: [
          ["`.`", "üres kamra"],
          ["`@`", "aranyrög"],
          ["`#`", "fal: áthatolhatatlan kőzet"],
          ["`>` `<` `^` `v`", "a robot, kelet, nyugat, észak vagy dél felé nézve"],
        ],
      },
      {
        kind: "list",
        items: [
          "**Egy robot.** A térképen pontosan egy robot van, és olyan kamrában áll, amelyben nincs arany.",
          "**A szél fal.** A robot nem léphet le a térképről, és az `isThere` is falat lát a szélen túl.",
        ],
      },
      { kind: "heading", text: "Felfedezés" },
      {
        kind: "paragraph",
        text: "Futás közben a térkép mutatja, mit fedezett fel a robot: a kezdőmezőt, minden mezőt, amelyen áthaladt vagy megállt, és minden mezőt, amelyet `isThere` hívással megvizsgált.",
      },
      {
        kind: "paragraph",
        text: "A `Nézet` kapcsolóval (vagy az `L` billentyűvel) a `Lámpafény` és a `Teljes térkép` nézet között válthatsz. `Lámpafény` nézetben csak a felfedezett mezők látszanak, a `Teljes térkép` a felderítetlen részt is mutatja, rácsmintával jelölve. Nyitott pályán ez csak megjelenítés; sötét pályán a teljes térkép zárolt, lásd a következő fejezetet.",
      },
      { kind: "heading", text: "Térképszerkesztő" },
      {
        kind: "list",
        items: [
          "**Bánya.** A jobb oldali panelen választod ki, milyen sötét legyen a pálya: `Nyitott`, `Lámpafény` vagy `Vaksötét`.",
          "**Láthatóság.** Nyilvános pályát mindenki látja a Homokozóban, a privátot csak te és az adminisztrátorok.",
          "**Csak szabályos térkép menthető.** Arany nélküli vagy elérhetetlen aranyat tartalmazó térkép is elmenthető, de figyelmeztetést kap.",
          "**Hibás import.** Hibás térképfájlnál a szerkesztő megmondja, melyik sorban mi a gond, és nem tölti be a hibás tartalmat.",
          "**Gyors eszközök.** A `Továbbiak` menüben a `Generálás…` mindig megoldható pályát rajzol a megadott méretben és nehézséggel, a `Falkeret` és a `Mind üres` egy kattintással átrendezi a rácsot.",
          "**Kipróbálás.** A még nem mentett pályát mentés és ranglista nélkül játszatja.",
          "**Célérték.** A `Célérték (lépés)` mezőben adhatod meg, hány lépésből jár a harmadik rög. A `Gépi megoldás` kiszámolja, hány lépésből oldja meg a pályát a beépített útvonaltervező.",
        ],
      },
    ],
  },
  {
    id: "lampafeny",
    title: "Sötét bányák: Lámpafény és Vaksötét",
    blocks: [
      {
        kind: "paragraph",
        text: "A pálya szerzője eldöntheti, mennyire legyen sötét a bánya. Sötét pályán a térkép mérete és rácsa látszik, de a mezők tartalma rejtve marad, amíg a robot lámpája rá nem világít: a labirintust a programoddal kell kitapogatnod.",
      },
      {
        kind: "paragraph",
        text: "A robot érzékelése ettől nem változik: az `isThere` továbbra is csak a közvetlenül előtte lévő mezőt vizsgálja. A lámpa csak neked világít, a program viselkedésén és a lépésszámon semmit sem változtat.",
      },
      {
        kind: "table",
        caption: "A bánya három fokozata",
        head: ["Fokozat", "Induló fény", "Teljes térkép", "Falnak ütközés"],
        rows: [
          ["`Nyitott`", "minden mező látszik", "mindig elérhető", "csak hibaüzenet"],
          [
            "`Lámpafény`",
            "a robot körüli 1 mező",
            "három rög után",
            "összetörik a lámpa, a vázlat törlődik",
          ],
          [
            "`Vaksötét`",
            "semmi: csak a bejárt és megvizsgált mezők",
            "három rög után",
            "összetörik a lámpa, a vázlat törlődik",
          ],
        ],
      },
      { kind: "heading", text: "Mit látsz" },
      {
        kind: "table",
        caption: "A mezők három állapota sötét pályán",
        head: ["Állapot", "Mitől lesz ilyen", "Megjelenés"],
        rows: [
          ["felfedezett", "a robot járt rajta, vagy `isThere` vizsgálta", "teljes részletesség"],
          ["megvilágított", "a lámpa fénykörébe esett", "halványabb, rácsmintás"],
          ["sötét", "egyik sem", "fekete; a képernyőolvasó csak annyit mond: ismeretlen"],
        ],
      },
      { kind: "heading", text: "Az akku" },
      {
        kind: "list",
        items: [
          "**Fénykör.** A lámpa annyi mezőnyire világít, amennyi az akku töltöttsége: Lámpafényben 1-ről, Vaksötétben 0-ról indul.",
          "**Arany tölti.** Minden kibányászott rög után eggyel nő, legfeljebb 4-ig. A rög felvételekor a fénykör azonnal kitágul, ezért sötétben érdemes előbb a közeli aranyat felszedni.",
          "**Fal árnyéka.** A fény nem megy át falon: a fal maga látszik, a mögötte lévő mező nem.",
          "**Jelző.** Az akku állását a műszersáv `Akku` jelzője mutatja négy cellában; a képernyőolvasó számmal is felolvassa.",
        ],
      },
      { kind: "heading", text: "A vázlat" },
      {
        kind: "paragraph",
        text: "Amit egy futás felfedezett vagy megvilágított, az a futás végén a vázlatodra kerül, és a következő futás előtt is látszik. Így a játék ritmusa: felderítő program, tervezés a vázlaton, aztán jobb program. A vázlat felhasználónként és pályaverziónként külön van, ebben a böngészőben tárolódik, és csak a végigjátszott futás frissíti; a leállított nem.",
      },
      { kind: "heading", text: "Falnak ütközés" },
      {
        kind: "paragraph",
        text: "Ha a futás `E_BEDROCK_HIT` hibával ér véget, mert a robot falra vagy a térképről lelépne, összetörik a lámpa: a vázlat törlődik, és a következő futás újra sötétben indul. Az eredmény ettől még felkerül a ranglistára. A többi hiba (`E_NO_GOLD`, a típushibák, a sorlimit) nem töri össze a lámpát.",
      },
      {
        kind: "code",
        caption: "Óvatos lépés: minden lépés előtt isThere 1, így a robot sosem megy falnak",
        map: "1 7\n>.@..@#",
        code: "set fal to isThere 1\nset szabad to not fal\nwhile szabad\n    set arany to isThere 2\n    step forward 1\n    if arany\n        mine here\n    set fal to isThere 1\n    set szabad to not fal",
      },
      { kind: "heading", text: "Teljes térkép és spoilervédelem" },
      {
        kind: "list",
        items: [
          "**Kiérdemelhető.** Ha egy sötét pályán megszerezted a három rögöt, a `Teljes térkép` nézet feloldódik, és onnantól nyitott térképen csiszolhatod a lépésszámot. Addig a `Nézet` kapcsoló zárolva van.",
          "**Szerző és adminisztrátor.** A pálya szerzője és az adminisztrátor mindig látja a teljes térképet.",
          "**Export.** Sötét pálya térképét csak a szerzője és az adminisztrátor exportálhatja.",
          "**Visszajátszás.** Más játékos futását sötét pályán Lámpafény nézetben nézheted vissza, hogy a térkép ne áruljon el semmit.",
        ],
      },
      {
        kind: "code",
        caption:
          "Jobbkéz-szabály: térkép nélkül is bejárja az összefüggő járatot, és felszedi a két aranyat",
        map: "3 5\n>..#.\n#.@..\n#...@",
        code: "set talalt to 0\nset kell to 2\nset megy to true\nwhile megy\n    turn by 3\n    set fal to isThere 1\n    while fal\n        turn by 1\n        set fal to isThere 1\n    set arany to isThere 2\n    step forward 1\n    if arany\n        mine here\n        set talalt to talalt + 1\n    set megy to talalt < kell",
      },
      {
        kind: "tip",
        title: "Vakon is célba érsz",
        text: "Ha nem látod a térképet, írj általános programot. A jobbkéz-szabály (fordulj jobbra, amíg fal van előtted, fordulj balra, aztán lépj) minden összefüggő járatot bejár; nyílt teremben és körök körül viszont a végtelenségig járhat, ezért mindig legyen kilépési feltétel. A Receptek között három ilyen „vakon” program van.",
      },
    ],
  },
  {
    id: "tortenet",
    title: "A Dusza-tárna története",
    blocks: [
      {
        kind: "paragraph",
        text: "1926 telén a Dusza-tárna bányászai egyetlen éjszaka alatt felhagytak a munkával. A csillék a síneken maradtak, a lámpák a falakon. Száz év múlva R-07, egy acélból kovácsolt felfedező ereszkedik le a főaknán. Hat robot járt itt előtte. Egyik sem tért vissza.",
      },
      {
        kind: "paragraph",
        text: "Mélyről egyenletes kopogás hallatszik, és Kelemen Bálint főaknász naplójának lapjai fejezetről fejezetre árulják el, mi elől menekültek a bányászok. A pályaleírások a történet egy-egy mozzanatát mesélik; a végső választ a hegy szívében, az utolsó pályán találod meg. Ha ott az utolsó rög is a csillédbe kerül, a kopogás elhallgat, és a bánya alján dolgozó gép megpihen.",
      },
      {
        kind: "table",
        caption: "A hat fejezet",
        head: ["Fejezet", "Mélység", "Kőzet", "Pályák"],
        rows: [
          ["I. Az elhagyott tárna", "−12 … −60 m", "agyag", "1–5."],
          ["II. A visszhangok csarnoka", "−72 … −120 m", "mészkő", "6–10."],
          ["III. Az ametisztüregek", "−132 … −180 m", "ametiszt", "11–15."],
          ["IV. A vörös ér", "−192 … −240 m", "vasérc", "16–20."],
          ["V. A smaragdtó", "−252 … −300 m", "malachit", "21–25."],
          ["VI. A hegy szíve", "−312 … −360 m", "obszidián, láva", "26–30."],
        ],
      },
      { kind: "heading", text: "Amit a roncsok tanítanak" },
      {
        kind: "paragraph",
        text: "R-07 minden fejezetben egy elődje roncsára bukkan. Mindegyik egy-egy programhiba áldozata lett, ezért mindegyik egy tanulság.",
      },
      {
        kind: "table",
        caption: "Az elődök sorsa",
        head: ["Robot", "Mi történt vele", "Hiba", "Tanulság"],
        rows: [
          [
            "R-01",
            "lépett, mielőtt megnézte, mi van előtte",
            "`E_BEDROCK_HIT`",
            "lépés előtt `isThere 1`",
          ],
          [
            "R-02",
            "körbe-körbe járt, mert a ciklusából nem vezetett kiút",
            "`INSTRUCTION_COUNT_LIMIT_EXCEEDED`",
            "minden `while`-nak kell egy feltétel, amely egyszer hamis lesz",
          ],
          [
            "R-03",
            "üres kőbe vágott, újra és újra",
            "`E_NO_GOLD`",
            "előbb `isThere 2`, aztán lépés és `mine here`",
          ],
          [
            "R-04",
            "egy változója szám volt, aztán igaz-hamis akart lenni",
            "`E_TYPE_MISMATCH`",
            "a változó típusa az első `set`-kor rögzül",
          ],
          [
            "R-05",
            "olyan változót olvasott, amelynek sosem adott értéket",
            "`E_UNINITIALIZED`",
            "előbb `set`, aztán használat",
          ],
          [
            "R-06",
            "olyat kérdezett a kőtől, amire nincs szó: `isThere 3`",
            "`E_BAD_ARG`",
            "az `isThere` csak a 0, 1 és 2 értéket ismeri",
          ],
        ],
      },
    ],
  },
  {
    id: "felepites",
    title: "A program szabályai",
    blocks: [
      {
        kind: "paragraph",
        text: "A MineScript szigorú nyelv: a robot csak akkor indul, ha a program minden sora szabályos. Ezek a szabályok:",
      },
      {
        kind: "list",
        items: [
          "**Egy sor, egy utasítás.** Üres sor nem lehet a programban, a program viszont lehet teljesen üres is.",
          "**Pontosan egy szóköz.** A szavak között egy szóköz áll. Dupla szóköz, sor végi szóköz és tabulátor nem lehet.",
          "**Behúzás.** A szóközös behúzás jelöli, mi tartozik egy `if`, `else` vagy `while` törzséhez. A törzs mélyebben van, mint a fejléce, és egy blokkon belül minden sor ugyanannyira van behúzva. Különböző blokkokban a mérték eltérhet.",
          "**Az else helye.** Az `else` az `if` sorával azonos behúzáson áll, közvetlenül az `if` törzse után.",
          "**Kis- és nagybetű.** `isThere` helyes, `isthere` hibás; `arany` és `Arany` két külön változó.",
          "**Számok.** 0 és 100 közötti egészek. Negatív szám nincs a kódban, kivonással állítható elő: `set x to 0 - 5`.",
          "**Változónevek.** Betűvel kezdődnek, utána betűk és számjegyek jöhetnek, ékezet és aláhúzás nélkül. Kulcsszó nem lehet változónév.",
        ],
      },
      {
        kind: "paragraph",
        text: "A kulcsszavak: `and` `by` `else` `false` `forward` `here` `if` `isThere` `mine` `not` `or` `print` `set` `step` `to` `true` `turn` `while`.",
      },
      {
        kind: "tip",
        title: "A szerkesztő segít",
        text: "A hibás sort a szerkesztő már gépelés közben aláhúzza, és a sor végén megmondja, mi a baj. A `Tab` négy szóközt szúr be, a `Shift+Alt+F` pedig egységes formára hozza a helyes programot.",
      },
    ],
  },
  {
    id: "utasitasok",
    title: "Robotparancsok",
    blocks: [
      {
        kind: "table",
        caption: "A robot parancsai",
        head: ["Parancs", "Mit csinál"],
        rows: [
          [
            "`step forward n`",
            "n mezőt halad előre (n nemnegatív egész, a 0 is szabályos). Útközben minden érintett mezőt felfedez, az aranyon áthalad, és ott hagyja. Ha a következő mező fal vagy a térkép széle, a robot az utolsó szabad mezőn megáll, és `E_BEDROCK_HIT` hibával véget ér a futás.",
          ],
          [
            "`turn by n`",
            "n negyedfordulatot fordul balra: kelet → észak → nyugat → dél → kelet. `turn by 1` balra, `turn by 2` hátra, `turn by 3` jobbra fordít.",
          ],
          [
            "`mine here`",
            "kibányássza az aranyat abból a mezőből, amelyen a robot áll. Egy mezőt csak egyszer lehet kibányászni.",
          ],
          ["`isThere w`", "megnézi a robot előtti mezőt; részletesen a következő fejezetben."],
          ["`print x`", "kiírja az egész vagy logikai értéket a konzolra."],
        ],
      },
      {
        kind: "paragraph",
        text: "A parancsok paramétere egyetlen érték: szám, `true`/`false` vagy egy változó neve. Kifejezést (például `step forward n + 1`) nem lehet közvetlenül átadni, előbb egy változóba kell kiszámolni.",
      },
    ],
  },
  {
    id: "isthere",
    title: "Érzékelés: isThere",
    blocks: [
      {
        kind: "paragraph",
        text: "A robot az `isThere w` függvénnyel tapogatja ki a közvetlenül előtte lévő mezőt. Az eredmény logikai érték, amelyet egy változóba kell menteni: `set fal to isThere 1`.",
      },
      {
        kind: "table",
        caption: "Az isThere paramétere",
        head: ["Hívás", "Igaz, ha a robot előtt…"],
        rows: [
          ["`isThere 0`", "üres kamra van"],
          ["`isThere 1`", "fal van, vagy ott a térkép széle"],
          ["`isThere 2`", "aranyrög van"],
        ],
      },
      {
        kind: "paragraph",
        text: "A megvizsgált mező felfedezetté válik. Más paraméter (például `isThere 3`) `E_BAD_ARG` hibát ad.",
      },
      {
        kind: "code",
        caption: "Csak akkor lép, ha nincs előtte fal",
        map: "1 3\n>..",
        code: "set fal to isThere 1\nset szabad to not fal\nif szabad\n    step forward 1",
      },
    ],
  },
  {
    id: "kifejezesek",
    title: "Változók és kifejezések",
    blocks: [
      {
        kind: "paragraph",
        text: "Változót a `set név to érték` hoz létre. Külön deklaráció nincs: a változó az első értékadáskor születik meg, és a futás végéig él. Két típus létezik, egész és logikai, és köztük nincs automatikus átalakítás.",
      },
      {
        kind: "list",
        items: [
          "A változó típusa az első értékadáskor rögzül. Ha később más típusú értéket kapna, `E_TYPE_MISMATCH` hiba keletkezik.",
          "Értékadás előtt a változó nem olvasható: ilyenkor `E_UNINITIALIZED` hiba jön.",
          "Minden típusellenőrzés futás közben történik. A szerkesztő figyelmeztetései előre jelzik a gyanús sorokat, de nem akadályozzák a futtatást.",
        ],
      },
      {
        kind: "paragraph",
        text: "A `to` utáni rész négyféle lehet: egyetlen érték (`5`, `true`, `x`), egy `isThere w` hívás, egy tagadás (`not v`) vagy egy kétoperandusú művelet (`a + b`). Egymásba ágyazott kifejezés nincs: az összetett számítást lépésenként, segédváltozókkal kell felépíteni.",
      },
      {
        kind: "table",
        caption: "Műveletek",
        head: ["Művelet", "Operandusok", "Eredmény"],
        rows: [
          ["`+` `-` `*`", "két egész", "egész"],
          ["`<` `<=` `>` `>=`", "két egész", "logikai"],
          ["`=` `<>`", "két azonos típusú érték", "logikai"],
          ["`and` `or`", "két logikai", "logikai"],
          ["`not`", "egy logikai", "logikai"],
        ],
      },
      {
        kind: "paragraph",
        text: "A kiértékelés balról jobbra halad, és minden operandust azonnal ellenőriz. Rövidzár nincs: a `true or c` akkor is beolvassa a c változót, ha az eredmény már az első operandusból kiderül, így ha c-nek még nincs értéke, `E_UNINITIALIZED` hiba keletkezik.",
      },
      {
        kind: "code",
        caption: "Összetett feltétel segédváltozókkal",
        map: "1 3\n>@.",
        code: "set elol to isThere 2\nset fal to isThere 1\nset szabad to not fal\nset jo to elol or szabad\nprint jo",
      },
    ],
  },
  {
    id: "vezerles",
    title: "Elágazás és ciklus",
    blocks: [
      {
        kind: "paragraph",
        text: "Az `if v` után behúzott sorok csak akkor futnak le, ha v igaz. Az `else` utáni ág akkor fut, ha v hamis. A feltétel csak logikai érték lehet; egész szám esetén `E_NON_BOOL_CONDITION` hiba keletkezik.",
      },
      {
        kind: "code",
        caption: "Ha arany van előtte, kibányássza, különben megfordul",
        map: "1 4\n>@..",
        code: "set arany to isThere 2\nif arany\n    step forward 1\n    mine here\nelse\n    turn by 2\nprint arany",
      },
      {
        kind: "paragraph",
        text: "A `while v` törzse addig ismétlődik, amíg v igaz. A feltételt a törzs végén frissíteni kell, különben a ciklus sosem áll meg, és a futás 1000 sor után `INSTRUCTION_COUNT_LIMIT_EXCEEDED` hibával szakad meg.",
      },
      {
        kind: "code",
        caption: "Menj előre a falig, és bányássz ki minden aranyat útközben",
        map: "1 8\n>..@..@.",
        code: "set count to 0\nset fal to isThere 1\nset megy to not fal\nwhile megy\n    set arany to isThere 2\n    if arany\n        step forward 1\n        mine here\n        set count to count + 1\n    else\n        step forward 1\n    set fal to isThere 1\n    set megy to not fal\nprint count",
      },
      {
        kind: "tip",
        title: "Töréspont",
        text: "Kattints egy sor számára (vagy nyomd meg az `F9`-et), és a lejátszás minden alkalommal megáll, amikor a robot végrehajtotta azt a sort. Így egy ciklus minden körében megnézheted a változók értékét. A `Szóköz` folytatja a futást.",
      },
    ],
  },
  {
    id: "lepesek",
    title: "Lépésszámlálás",
    blocks: [
      {
        kind: "paragraph",
        text: "A ranglista a végrehajtott programsorokat számolja, nem a megtett mezőket. A szabályok:",
      },
      {
        kind: "list",
        items: [
          "Minden végrehajtott sor egy lépés, a hibát okozó sor is.",
          "Ciklusban a törzs sorai minden lefutáskor újra számítanak.",
          "A `while` sora minden feltétel-kiértékelésnél számít, az utolsó, hamis kiértékelésnél is.",
          "Az `else` sora csak akkor számít, ha az else-ág lefut.",
          "Egy futás legfeljebb 1000 sort dolgozhat fel. Ha a program az 1000. sor után újabb sort hajtana végre, a futás `INSTRUCTION_COUNT_LIMIT_EXCEEDED` hibával megáll.",
        ],
      },
      {
        kind: "code",
        caption:
          "13 lépés: 2 értékadás, 4 while-kiértékelés (az utolsó hamis), 3 × 2 törzssor és 1 print",
        map: "1 2\n>.",
        code: "set i to 0\nset tovabb to true\nwhile tovabb\n    set i to i + 1\n    set tovabb to i < 3\nprint i",
      },
      {
        kind: "tip",
        title: "Spórolj a lépésekkel",
        text: "Ha ismered a pályát, a `step forward 4` egyetlen lépés, míg ugyanez egy falig tapogatózó ciklussal több tucat. Ciklus akkor éri meg, ha a pálya ismeretlen vagy nagyon hosszú. Minden `isThere` és minden segédváltozó egy-egy lépés, ezért csak ott vizsgálódj, ahol a döntéshez tényleg szükség van rá.",
      },
    ],
  },
  {
    id: "hibak",
    title: "Hibák",
    blocks: [
      {
        kind: "paragraph",
        text: "Szintaktikailag hibás program nem futtatható. A szerkesztő aláhúzza és a margón megjelöli a hibás sorokat, a `Hibalista` pedig sorszámmal együtt felsorolja őket; egy kattintással a hibás sorra ugorhatsz, és sok hibához kész javítást is ajánl.",
      },
      {
        kind: "paragraph",
        text: "Futás közben az alábbi hibák állíthatják meg a robotot. Ilyenkor a felület kiírja a hibakódot, kiemeli a hibás sort, a térképen pedig megjelöli, hol akadt el a robot.",
      },
      {
        kind: "table",
        caption: "Futásidejű hibakódok",
        head: ["Kód", "Mikor keletkezik"],
        rows: [
          ["`E_TYPE_MISMATCH`", "egy már rögzített típusú változó más típusú értéket kapna"],
          ["`E_UNINITIALIZED`", "olyan változót olvas a program, amely még nem kapott értéket"],
          ["`E_NON_BOOL_CONDITION`", "az `if` vagy a `while` feltétele nem logikai"],
          ["`E_BAD_OPERAND`", "a művelet rossz típusú operandust kap"],
          ["`E_BEDROCK_HIT`", "a `step forward` falra vagy a térképen kívülre vezetne"],
          ["`E_NO_GOLD`", "`mine here` olyan mezőn, ahol nincs (vagy már nincs) arany"],
          [
            "`E_BAD_ARG`",
            "érvénytelen paraméter, például `isThere 3`, `turn by true` vagy negatív lépésszám",
          ],
          ["`E_INT_OVERFLOW`", "túl nagy egész érték (±9 007 199 254 740 991 felett)"],
          ["`INSTRUCTION_COUNT_LIMIT_EXCEEDED`", "a program 1000 sornál többet hajtana végre"],
        ],
      },
      {
        kind: "code",
        caption: "A robot a fal előtt megáll: E_BEDROCK_HIT a 2. sorban",
        map: "1 4\n>..@",
        code: "step forward 3\nstep forward 1",
      },
    ],
  },
  {
    id: "ranglista",
    title: "Ranglisták, futások, programok",
    blocks: [
      {
        kind: "list",
        items: [
          "**Mi kerül fel.** Minden végigjátszott futás: a hiba nélküli, a futásidejű hibával és a limit túllépésével végződő is.",
          "**Mi nem.** A leállított futás és a szintaktikailag hibás program nem kerül a ranglistára.",
          "**Nem hamisítható.** Az eredményt a szerver a forráskódból maga számolja újra.",
          "**Sorrend.** Játékosonként a legjobb futás számít: több arany előrébb, egyenlőségnél a kevesebb lépés, ha az is egyezik, a korábbi.",
          "**Verziók.** Ha egy térképen már van futás, a tartalma csak új verzióként módosítható. A ranglista verziónként külön van, így a régi eredmények megmaradnak.",
        ],
      },
      { kind: "heading", text: "A Történet ranglistája" },
      {
        kind: "paragraph",
        text: "A Történet táblájának `Ranglista` gombja minden játékos legjobb futásait összesíti a harminc kampánypályán. Előrébb áll, akinek több rögje van; egyenlőségnél akinek több aranya, majd akinek kevesebb lépés kellett. A `Fejezet` oszlop mutatja, ki meddig jutott le.",
      },
      { kind: "heading", text: "Futások és visszajátszás" },
      {
        kind: "list",
        items: [
          "**Futásaim.** Ezen az oldalon minden korábbi futásodat visszajátszhatod, és a programját újra betöltheted.",
          "**Megnézem.** A pályák ranglistáján bármelyik futást megnézheted a programjával együtt. A visszajátszás linkje megosztható.",
        ],
      },
      { kind: "heading", text: "Programok" },
      {
        kind: "list",
        items: [
          "**Programtár.** A `Ctrl+S` elmenti a programodat a programtárba, a `Ctrl+O` megnyitja a programtárat; a mentett programok bármelyik pályán betölthetők.",
          "**Fájlok.** A szerkesztő `Fájl` menüjében `.ms` vagy `.txt` fájlt importálhatsz, és a programot fájlba exportálhatod.",
          "**Vázlat.** A szerkesztő tartalma pályánként megmarad a böngészőben, akkor is, ha elnavigálsz.",
        ],
      },
    ],
  },
  {
    id: "rogok",
    title: "Rögök és napi kihívás",
    blocks: [
      {
        kind: "paragraph",
        text: "Minden pályán legfeljebb három rög szerezhető. A rögök a legjobb futásodból számolódnak, és a `Pályák` oldalon összesítve is látod őket.",
      },
      {
        kind: "table",
        caption: "A rögök feltételei",
        head: ["Rög", "Feltétel"],
        rows: [
          ["1", "a futás legalább egy aranyat kibányászott"],
          ["2", "a pálya minden elérhető aranyát kibányászta"],
          [
            "3",
            "minden elérhető aranyat legfeljebb a pálya célértékének megfelelő lépésből bányászott ki",
          ],
        ],
      },
      {
        kind: "list",
        items: [
          "A célérték a pálya adatai között látszik. Ha egy pályának nincs célértéke, ott legfeljebb 2 rög jár.",
          "A Történet pályáin a célérték a pálya legrövidebb lehetséges megoldása: a harmadik röghöz tényleg a legjobb programot kell megtalálnod.",
          "A Történetben a két rög jelenti a kész pályát, ez nyitja a fejezeteket.",
          "A futás végén a vezérlőpult alatt megjelennek a megszerzett rögök és a következő rög feltétele, innen a következő pályára is továbbléphetsz.",
          "A `Napi kihívás` a Homokozó tetején minden nap új, géppel generált pálya: mindenki ugyanazt kapja, és saját ranglistája van.",
          "A ranglistán bármelyik futást megnézheted a `Megnézem` gombbal, a programjával együtt. A visszajátszás linkje megosztható.",
        ],
      },
    ],
  },
  {
    id: "strategia",
    title: "Stratégia: kevesebb lépés",
    blocks: [
      {
        kind: "paragraph",
        text: "A harmadik rög a legrövidebb programé. A Történet pályáit úgy terveztük, hogy a kézenfekvő megoldás, amely mindig a legközelebbi rög felé indul, jóval hosszabb legyen a legjobbnál: az Obszidiánkapun például 73 sor helyett 50 is elég. Ezek a szabályok segítenek megtalálni a rövidebbet.",
      },
      {
        kind: "steps",
        items: [
          "**A távolság ingyen van, a kanyar nem.** A `step forward 9` kilenc mezőt lép, mégis egy sor. A rövidebb, de kanyargós út gyakran több sor, mint a hosszú egyenes.",
          "**Minden rög legalább két sor.** Odalépés és `mine here`: ez az alsó korlát, ennél kevesebből egy rög sem jön ki.",
          "**Fordulj ott, ahol úgyis megállsz.** Egy rögön tett kanyar egy sor; máshol kettő, mert előbb oda kell lépni.",
          "**A hátraarc is egy sor.** A `turn by 2` ugyanannyiba kerül, mint a `turn by 1`.",
          "**A program bárhol véget érhet.** A legmélyebb zsákutcát hagyd a végére, onnan már nem kell visszajönni.",
          "**A közeli rög nem mindig az első.** Ami visszafelé egy egyenesbe esik, azt útközben olcsóbb felvenni.",
          "**Kevesebb átkelés, kevesebb kanyar.** Kapuknál, hidaknál, átjáróknál az a jó sorrend, amelyik ritkábban megy át.",
          "**Nem minden arany érhető el.** Ami körbe van falazva, azért kár sorokat égetni.",
        ],
      },
      {
        kind: "tip",
        title: "Ciklus vagy egyenes program?",
        text: "A ciklus kényelmes, de minden körben a feltétel is sornak számít, ezért a ranglistán az egyenes program nyer. Sötét pályán viszont a ciklus visz el a térképig: előbb felderítesz, aztán a vázlat alapján megírod a rövid programot.",
      },
    ],
  },
  {
    id: "receptek",
    title: "Receptek",
    blocks: [
      {
        kind: "paragraph",
        text: "A kézikönyv tartalomjegyzékének alján a `Receptek` bejárat kész programokhoz vezet. Minden recept mellett `Megnyitás` gomb van: a pályát a programmal együtt nyitja meg. A programok és a térképek le is tölthetők.",
      },
      {
        kind: "list",
        items: [
          "**Történet.** Mind a 30 pályához a legrövidebb program, vagyis a háromrögös megoldás, egy-két mondattal arról, mi a csapda és mi a trükk.",
          "**Vakon.** Három falkövető program (13., 17. és 24. pálya), amely a térkép ismerete nélkül jut célba.",
          "**Homokozó bemutatók.** Hét program, amely a nyelv egy-egy részét mutatja be: lépés, fordulás, `isThere`, `if`/`else`, `while`, számok, összehasonlítás, logika és `print`. Ezek a nyelvet tanítják, nem a legrövidebbek.",
          "**Hibapróbák.** Minden futásidejű hibához és a szintaktikai hibákhoz egy-egy program, amely pontosan azt a hibát váltja ki.",
          "**Hibás térképek.** Importhibás térképfájlok a térképszerkesztő kipróbálásához.",
          "**Programtár.** A demó-fiókok programtárában minden recept megvan `Recept – …` néven.",
        ],
      },
    ],
  },
  {
    id: "billentyuk",
    title: "Billentyűparancsok",
    blocks: [
      {
        kind: "paragraph",
        text: "Minden funkció egér nélkül is elérhető. A leggyakoribb billentyűk:",
      },
      {
        kind: "table",
        caption: "Billentyűparancsok",
        head: ["Hol", "Billentyű", "Hatás"],
        rows: [
          ["Játék", "`Ctrl+Enter`, `F5`", "futtatás"],
          ["Játék", "`Shift+F5`", "leállítás"],
          ["Játék", "`Ctrl+S`", "a program mentése"],
          ["Játék", "`Ctrl+O`", "programtár"],
          ["Bánya", "`Szóköz`", "szünet, folytatás"],
          ["Bánya", "`←`, `→`", "egy sor vissza, előre"],
          ["Bánya", "`Home`, `End`", "ugrás a futás elejére, végére"],
          ["Bánya", "`L`", "váltás a lámpafény és a teljes térkép között"],
          ["Bánya", "`+`, `−`", "gyorsabb, lassabb lejátszás"],
          ["Szerkesztő", "`F8`, `Shift+F8`", "következő, előző hiba"],
          ["Szerkesztő", "`F9`, kattintás a sorszámra", "töréspont ki/be"],
          ["Szerkesztő", "`Ctrl+Shift+M`", "a hibalista nyitása, zárása"],
          ["Szerkesztő", "`Tab`", "4 szóköz beszúrása"],
          ["Szerkesztő", "`Esc`, majd `Tab`", "kilépés a szerkesztőből"],
          ["Szerkesztő", "`Shift+Alt+F`", "formázás"],
          ["Szerkesztő", "`Ctrl+Szóköz`", "kódkiegészítés"],
          ["Térkép", "nyilak, `Home`, `End`", "mozgás a mezők között"],
          ["Térkép", "`Ctrl+Home`, `Ctrl+End`", "ugrás az első vagy az utolsó mezőre"],
          ["Térképszerkesztő", "`Enter`, `Szóköz`", "festés a kijelölt mezőre"],
          ["Térképszerkesztő", "`Delete`, `Backspace`", "a mező kiürítése"],
          ["Térképszerkesztő", "`1`–`4`", "festőeszköz: üres kamra, arany, fal, robot"],
          ["Térképszerkesztő", "`E`, `T`, `K`", "festésmód: ecset, téglalap, kitöltés"],
          ["Térképszerkesztő", "`R`, `Shift+R`", "a robot forgatása balra, jobbra"],
          ["Térképszerkesztő", "`Ctrl+Z`, `Ctrl+Shift+Z`", "visszavonás, újra"],
          ["Térképszerkesztő", "`Ctrl+S`", "a térkép mentése"],
        ],
      },
    ],
  },
];

const parts: readonly { readonly title: string; readonly ids: readonly string[] }[] = [
  { title: "Kezdés", ids: ["alapok", "modok", "elso-program"] },
  { title: "A bánya", ids: ["terkep", "lampafeny", "tortenet"] },
  { title: "A nyelv", ids: ["felepites", "utasitasok", "isthere", "kifejezesek", "vezerles"] },
  { title: "Futás és eredmény", ids: ["lepesek", "hibak", "ranglista", "rogok", "strategia"] },
  { title: "Referencia", ids: ["receptek", "billentyuk"] },
];

export const manual = {
  title: "Kézikönyv",
  tocLabel: "Tartalom",
  tocToggle: "Fejezetek",
  pagerLabel: "Lapozás a fejezetek között",
  previous: "Előző",
  next: "Következő",
  chapterOf: (index: number, total: number) => `${index}. fejezet / ${total}`,
  tipLabel: "Tipp",
  parts,
  benchPlay: "Lejátszás",
  benchPause: "Szünet",
  benchRestart: "Elölről",
  benchBoard: (caption: string) => `Próbapad: ${caption}`,
  benchStats: (gold: number, steps: number) => `${gold} arany · ${steps} lépés`,
  sections,
} as const;
