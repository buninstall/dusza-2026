export type ManualBlock =
  | { readonly kind: "paragraph"; readonly text: string }
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
        kind: "steps",
        items: [
          "Nyisd meg a `Pályák` oldalt, válassz egy térképet, és kattints a `Játék` gombra.",
          "Írd meg a programot a jobb oldali szerkesztőben. A `Robot`, `Érzékelés`, `Változók`, `Döntés` és `Ciklus` fiókokból kész parancsmintákat szúrhatsz be, és `.ms` vagy `.txt` fájlból is importálhatsz.",
          "Kattints a `Futtatás` gombra. A szerkesztő előbb ellenőrzi a programot: ha hibás, nem indul el, hanem megjelöli a hibás sorokat.",
          "Helyes program esetén a térkép és a robot alaphelyzetbe kerül, és a futás lassítva lejátszódik. Közben látod az éppen végrehajtott sort, a konzolt és a változók értékét.",
          "A lejátszás végén a szerver a programodból újra kiszámolja az eredményt, és rögzíti a ranglistán.",
        ],
      },
      {
        kind: "tip",
        title: "Kezdd a próbapaddal",
        text: "A kézikönyv példái mellett kis bánya áll. A `Lejátszás` gombbal ott helyben megnézheted, mit csinál a program, mielőtt a saját pályádon kipróbálnád.",
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
          "A térképen pontosan egy robot van, és olyan kamrában áll, amelyben nincs arany.",
          "A térkép széle falnak számít: a robot nem léphet le róla, és az `isThere` is falat lát a szélen túl.",
          "A térképszerkesztő csak szabályos térképet ment el. Arany nélküli vagy elérhetetlen aranyat tartalmazó térkép is menthető, de figyelmeztetést kap.",
          "Hibás térképfájl importálásakor a szerkesztő megmondja, melyik sorban mi a gond, és nem tölti be a hibás tartalmat.",
          "A `Generálás` gomb mindig megoldható pályát rajzol a megadott méretben és nehézséggel, a `Falkeret` és a `Mind üres` egy kattintással átrendezi a rácsot. A `Próbajáték` mentés nélkül, ranglista nélkül játszatja a készülő pályát.",
          "A `Célérték (lépés)` mezőben adhatod meg, hány lépésből jár a harmadik csillag. A `Gépi megoldás` gomb kiszámolja, hány lépésből oldja meg a pályát a beépített útvonaltervező.",
        ],
      },
      {
        kind: "paragraph",
        text: "Futás közben a térkép mutatja, mit fedezett fel a robot. Felfedezett a kezdőmező, minden mező, amelyen a robot áthaladt vagy megállt, és minden mező, amelyet `isThere` hívással megvizsgált. `Lámpafény` nézetben csak ezek látszanak, a `Teljes térkép` nézet a felderítetlen részt is mutatja, rácsmintával jelölve.",
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
          "Minden sor pontosan egy utasítás. Üres sor nem lehet a programban, a program viszont lehet teljesen üres is.",
          "A szavak között pontosan egy szóköz áll. Dupla szóköz, sor végi szóköz és tabulátor nem lehet.",
          "A behúzás (csak szóközzel) jelöli, mi tartozik egy `if`, `else` vagy `while` törzséhez. A törzs mélyebben van, mint a fejléce, és egy blokkon belül minden sor ugyanannyira van behúzva. Különböző blokkokban a behúzás mértéke eltérhet.",
          "Az `else` az `if` sorával azonos behúzáson áll, közvetlenül az `if` törzse után.",
          "A kis- és nagybetű számít: `isThere` helyes, `isthere` hibás; `arany` és `Arany` két külön változó.",
          "A számok 0 és 100 közötti egészek. Negatív szám nincs a kódban, kivonással állítható elő: `set x to 0 - 5`.",
          "A változónév betűvel kezdődik, utána betűk és számjegyek jöhetnek, ékezet és aláhúzás nélkül. Kulcsszó nem lehet változónév.",
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
    title: "Ranglista és verziók",
    blocks: [
      {
        kind: "list",
        items: [
          "Minden végigjátszott futás rögzítésre kerül: a hiba nélküli, a futásidejű hibával és a limit túllépésével végződő is.",
          "A leállított futás és a szintaktikailag hibás program nem kerül a ranglistára.",
          "Az eredményt a szerver a forráskódból maga számolja újra, így a ranglista nem hamisítható.",
          "Játékosonként a legjobb futás számít: több arany előrébb, egyenlőségnél a kevesebb lépés, ha az is egyezik, a korábbi.",
          "Ha egy térképen már van futás, a tartalma csak új verzióként módosítható. A ranglista verziónként külön van, így a régi eredmények megmaradnak.",
          "A `Futásaim` oldalon minden korábbi futásodat visszajátszhatod, és a programját újra betöltheted.",
        ],
      },
    ],
  },
  {
    id: "csillagok",
    title: "Csillagok és kihívások",
    blocks: [
      {
        kind: "paragraph",
        text: "Minden pályán legfeljebb három csillag szerezhető. A csillagok a legjobb futásodból számolódnak, és a `Pályák` oldalon összesítve is látod őket.",
      },
      {
        kind: "table",
        caption: "A csillagok feltételei",
        head: ["Csillag", "Feltétel"],
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
          "A célérték a pálya adatai között látszik. Ha egy pályának nincs célértéke, ott legfeljebb 2 csillag jár.",
          "A futás végén megjelenő eredménysáv megmutatja a megszerzett csillagokat, azt, hogy mi kell a következőhöz, és innen a következő pályára is továbbléphetsz.",
          "A `Napi kihívás` minden nap új, géppel generált pálya: mindenki ugyanazt kapja, és saját ranglistája van.",
          "A ranglistán bármelyik futást megnézheted a `Megnézem` gombbal, a programjával együtt. A visszajátszás linkje megosztható.",
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

export const manual = {
  title: "Kézikönyv",
  tocLabel: "Tartalom",
  benchPlay: "Lejátszás",
  benchPause: "Szünet",
  benchRestart: "Elölről",
  benchBoard: (caption: string) => `Próbapad: ${caption}`,
  benchStats: (gold: number, steps: number) => `${gold} arany · ${steps} lépés`,
  sections,
} as const;
