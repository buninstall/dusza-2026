export type ManualBlock =
  | { readonly kind: "paragraph"; readonly text: string }
  | { readonly kind: "code"; readonly code: string; readonly caption: string }
  | { readonly kind: "list"; readonly items: readonly string[] }
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
        text: "Egy elhagyott bánya sötét kamráiban aranyrögök várnak. A kincskereső robot sorról sorra hajtja végre a MineScriptben írt programodat: csak azt érzékeli, ami közvetlenül előtte van, és ahol aranyra bukkan, ott kibányászhatja.",
      },
      {
        kind: "paragraph",
        text: "A cél: minél több aranyat összegyűjteni minél kevesebb lépésből. A ranglistán előrébb áll, aki több aranyat bányászott, egyenlőségnél az, akinek ehhez kevesebb feldolgozott programsor kellett.",
      },
      {
        kind: "list",
        items: [
          "Válassz egy térképet a `Térképek` oldalon, és nyomd meg a `Játék` gombot.",
          "Írd meg a programot a szerkesztőben, vagy importáld egy `.ms` / `.txt` fájlból.",
          "A `Futtatás` gomb ellenőrzi a programot. Hibás programot nem indít el, hanem megjelöli a hibás sorokat.",
          "Helyes program esetén a térkép és a robot alaphelyzetbe kerül, és a futás lassítva lejátszódik.",
          "A lejátszás végén az eredményt a szerver is kiszámolja, és felkerül a ranglistára.",
        ],
      },
    ],
  },
  {
    id: "terkep",
    title: "A térkép",
    blocks: [
      {
        kind: "paragraph",
        text: "A térképfájl első sora a méret: a sorok és az oszlopok száma egy szóközzel elválasztva, mindkettő 1 és 15 között. Utána pontosan ennyi sor következik, mindegyikben pontosan ennyi jellel.",
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
          ["`#`", "fal, áthatolhatatlan kőzet"],
          ["`>` `<` `^` `v`", "a robot kelet, nyugat, észak vagy dél felé nézve"],
        ],
      },
      {
        kind: "paragraph",
        text: "A térképen pontosan egy robot van, és aranyrögöt nem tartalmazó kamrában áll. A térképszerkesztő csak ilyen térképet enged menteni; arany nélküli vagy elérhetetlen aranyat tartalmazó térkép menthető, de figyelmeztetést kap.",
      },
      {
        kind: "paragraph",
        text: "Felfedezett mező a kezdőmező, minden mező, amelyen a robot áthalad vagy megáll, és minden mező, amelyre `isThere` hívás irányult. Lámpafény nézetben csak ezek látszanak.",
      },
    ],
  },
  {
    id: "felepites",
    title: "A program felépítése",
    blocks: [
      {
        kind: "list",
        items: [
          "Minden sor egy utasítás. Üres sor nem lehet a programban.",
          "A tokenek között pontosan egy szóköz áll; sorvégi szóköz és tabulátor nem lehet.",
          "A behúzás (csak szóköz) jelöli, mi tartozik egy `if`, `else` vagy `while` törzséhez. Egy blokkon belül a behúzás egységes, különböző blokkokban eltérhet.",
          "Az `else` az `if` sorával azonos behúzáson áll, közvetlenül az `if` törzse után.",
          "A kulcsszavak és a változónevek kis- és nagybetűérzékenyek: `arany` és `Arany` két külön változó.",
          "A számok 0 és 100 közötti egészek. Negatív számot kivonással kapsz: `set x to 0 - 5`.",
          "A változónév betűvel kezdődik, utána betűk és számjegyek jöhetnek (ékezet és aláhúzás nélkül), és nem lehet kulcsszó.",
        ],
      },
      {
        kind: "paragraph",
        text: "Kulcsszavak: `and` `by` `else` `false` `forward` `here` `if` `isThere` `mine` `not` `or` `print` `set` `step` `to` `true` `turn` `while`.",
      },
      {
        kind: "code",
        caption: "Menj előre, amíg falba nem ütköznél, és bányássz ki minden aranyat",
        code: "set count to 0\nset fal to isThere 1\nset megy to not fal\nwhile megy\n    set arany to isThere 2\n    if arany\n        step forward 1\n        mine here\n        set count to count + 1\n    else\n        step forward 1\n    set fal to isThere 1\n    set megy to not fal\nprint count",
      },
    ],
  },
  {
    id: "utasitasok",
    title: "Utasítások",
    blocks: [
      {
        kind: "table",
        caption: "A MineScript utasításai",
        head: ["Utasítás", "Mit csinál"],
        rows: [
          [
            "`step forward n`",
            "n mezőt lép előre (n nemnegatív egész). Közben minden érintett mezőt felfedez; az aranyon áthalad, és ott hagyja.",
          ],
          [
            "`turn by n`",
            "n negyedfordulatot fordul balra: kelet → észak → nyugat → dél. A `turn by 3` tehát egy jobbra fordulás.",
          ],
          ["`mine here`", "kibányássza az aranyat abból a mezőből, amelyen a robot áll."],
          ["`print x`", "kiírja az egész vagy logikai értéket a konzolra."],
          [
            "`set x to …`",
            "kiértékeli a `to` utáni kifejezést, és az eredményt az x változóba írja. Az első értékadás hozza létre a változót.",
          ],
          [
            "`if v` … `else` …",
            "ha v igaz, a then-ág fut, különben (ha van) az else-ág. A feltétel csak logikai lehet.",
          ],
          ["`while v` …", "a törzs addig ismétlődik, amíg v igaz."],
        ],
      },
    ],
  },
  {
    id: "kifejezesek",
    title: "Kifejezések és műveletek",
    blocks: [
      {
        kind: "paragraph",
        text: "A `set` jobb oldala négyféle lehet: egyetlen érték (`5`, `true`, `x`), egy `isThere w` hívás, egy `not v`, vagy egy kétoperandusú művelet (`a + b`). Beágyazott kifejezés nincs: összetett számításhoz használj segédváltozókat.",
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
        text: "A kiértékelés balról jobbra halad, és minden operandust azonnal ellenőriz. Rövidzár nincs: a `true or c` a c változót is beolvassa, ezért ha c-nek még nincs értéke, `E_UNINITIALIZED` hiba keletkezik.",
      },
      {
        kind: "code",
        caption: "Összetett feltétel segédváltozókkal",
        code: "set elol to isThere 2\nset fal to isThere 1\nset szabad to not fal\nset jo to elol or szabad\nprint jo",
      },
    ],
  },
  {
    id: "tipusok",
    title: "Típusok és változók",
    blocks: [
      {
        kind: "list",
        items: [
          "Két típus van: egész és logikai. Közöttük nincs automatikus átalakítás.",
          "Nincs külön deklaráció: a változó az első `set` utasításkor jön létre, és a futás végéig él.",
          "A változó típusa az első értékadáskor véglegesen rögzül. Más típusú érték `E_TYPE_MISMATCH` hibát ad.",
          "Minden típusellenőrzés futás közben történik; a szerkesztő figyelmeztetései csak segítenek előre.",
        ],
      },
    ],
  },
  {
    id: "isthere",
    title: "Az isThere függvény",
    blocks: [
      {
        kind: "paragraph",
        text: "Az `isThere w` a robot előtti mezőt vizsgálja, és logikai értéket ad: `0` esetén üres kamra, `1` esetén fal, `2` esetén aranyrög van-e ott. A térkép szélén túl mindig falat lát. A vizsgált mező felfedezetté válik.",
      },
      {
        kind: "code",
        caption: "Csak akkor lép, ha nincs előtte fal",
        code: "set fal to isThere 1\nset szabad to not fal\nif szabad\n    step forward 1",
      },
    ],
  },
  {
    id: "lepesek",
    title: "Lépésszámlálás",
    blocks: [
      {
        kind: "list",
        items: [
          "Minden végrehajtott programsor egy lépés.",
          "Ciklusban a törzs sorai minden lefutáskor újra számítanak.",
          "A `while` sora minden feltétel-kiértékelésnél számít, az utolsó, hamis kiértékelésnél is.",
          "Az `else` sora csak akkor számít, ha az else-ág lefut.",
          "Egy futás legfeljebb 1000 sort dolgozhat fel. Ha a program az 1000. sor után újabb sort hajtana végre, a futás `INSTRUCTION_COUNT_LIMIT_EXCEEDED` hibával megáll.",
        ],
      },
      {
        kind: "code",
        caption:
          "Ez a program 13 lépés: 2 értékadás, 4 while-kiértékelés (az utolsó hamis), 3 × 2 törzssor és 1 print",
        code: "set i to 0\nset tovabb to true\nwhile tovabb\n    set i to i + 1\n    set tovabb to i < 3\nprint i",
      },
    ],
  },
  {
    id: "hibak",
    title: "Hibák",
    blocks: [
      {
        kind: "paragraph",
        text: "Szintaktikailag hibás program nem futtatható: a szerkesztő aláhúzza és a margón jelöli a hibás sorokat, a Hibalista pedig a sorszámmal együtt felsorolja őket. Futás közben az alábbi hibák állíthatják meg a robotot; ilyenkor a felület a hibakódot és a hibás sort mutatja.",
      },
      {
        kind: "table",
        caption: "Futásidejű hibakódok",
        head: ["Kód", "Mikor keletkezik"],
        rows: [
          ["`E_TYPE_MISMATCH`", "egy már rögzített típusú változó más típusú értéket kapna"],
          ["`E_UNINITIALIZED`", "értékadás előtt olvasott változó"],
          ["`E_NON_BOOL_CONDITION`", "az if vagy a while feltétele nem logikai"],
          ["`E_BAD_OPERAND`", "a művelet rossz típusú operandust kap"],
          ["`E_BEDROCK_HIT`", "a step forward falra vagy a térképen kívülre vezetne"],
          ["`E_NO_GOLD`", "mine here olyan mezőn, ahol nincs (már) arany"],
          [
            "`E_BAD_ARG`",
            "érvénytelen paraméter, például `isThere 3`, `turn by true` vagy negatív lépésszám",
          ],
          ["`E_INT_OVERFLOW`", "túl nagy egész érték (±9 007 199 254 740 991 felett)"],
          ["`INSTRUCTION_COUNT_LIMIT_EXCEEDED`", "a futás elérte az 1000 feldolgozott sort"],
        ],
      },
    ],
  },
  {
    id: "ranglista",
    title: "Ranglista és térképverziók",
    blocks: [
      {
        kind: "list",
        items: [
          "Minden végigjátszott futás rögzítésre kerül: a hiba nélküli, a futásidejű hibával és a limit túllépésével végződő is.",
          "A leállított futás és a szintaktikailag hibás program nem kerül a ranglistára.",
          "Az eredményt a szerver a forráskódból maga számolja újra, így a ranglista nem hamisítható.",
          "Felhasználónként a legjobb futás számít.",
          "Ha egy térképhez már van futás, a tartalma csak új verzióként módosítható; a ranglista verziónként külön van, a régi eredmények megmaradnak.",
        ],
      },
    ],
  },
  {
    id: "billentyuk",
    title: "Billentyűparancsok",
    blocks: [
      {
        kind: "table",
        caption: "Billentyűparancsok",
        head: ["Hol", "Billentyű", "Hatás"],
        rows: [
          ["Szerkesztő", "`Tab`", "4 szóköz beszúrása"],
          ["Szerkesztő", "`Esc`, majd `Tab`", "kilépés a szerkesztőből"],
          ["Szerkesztő", "`Shift+Alt+F`", "formázás"],
          ["Szerkesztő", "`Ctrl+Szóköz`", "kódkiegészítés"],
          ["Térkép", "nyilak, `Home`, `End`", "mozgás a cellák között"],
          ["Térkép", "`Ctrl+Home`, `Ctrl+End`", "ugrás az első vagy az utolsó cellára"],
          ["Térképszerkesztő", "`Enter`, `Szóköz`", "festés a kiválasztott eszközzel"],
          ["Térképszerkesztő", "`1`–`4`", "eszközváltás: üres kamra, arany, fal, robot"],
        ],
      },
    ],
  },
];

export const manual = {
  eyebrow: "Kézikönyv",
  title: "A MineScript kézikönyve",
  lead: "Minden, amit a robot programozásához tudnod kell: a térkép, az utasítások, a típusok, a lépésszámlálás és a hibák.",
  tocLabel: "Tartalom",
  sections,
} as const;
