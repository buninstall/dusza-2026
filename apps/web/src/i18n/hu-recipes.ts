export type RecipeNote = { hint: string; insight: string };

export const recipePage = {
  sectionStory: "Történet",
  sectionSandbox: "Homokozó bemutatók",
  storyLead:
    "Minden kampánypályához a lehető legrövidebb program: ezzel jár a harmadik rög. A „vakon” receptek a térkép ismerete nélkül, falkövetéssel jutnak célba.",
  sandboxLead:
    "Minden bemutató a MineScript egy-egy részét mutatja be. Ezek a programok a nyelvet tanítják, nem a legrövidebb utat: a célérték mindegyiknél rövidebb.",
  insight: "A trükk",
};

export const RECIPE_NOTES: Readonly<Record<string, RecipeNote>> = {
  "01-egyenes-folyoso": {
    hint: "többmezős lépés, bányászás",
    insight:
      "Egy `step forward 3` három mezőt lép, mégis egyetlen sor. Minden rög legalább két sor (odalépés és bányászás), ezért a négy sor itt az elérhető legkevesebb.",
  },
  "01-egyenes-folyoso-ciklussal": {
    hint: "a feladatkiírás példaprogramja: `while`, `if`/`else`, `isThere`, `print`",
    insight:
      "Ugyanaz a pálya a kiírás ciklusos programjával. Mezőnként lép és minden lépés előtt ellenőriz: biztonságos, de minden kör feltétele is sornak számít, így 56 sor lesz.",
  },
  "02-az-elso-kanyar": {
    hint: "fordulás jobbra (`turn by 3`)",
    insight:
      "Jobbra fordulni egyetlen `turn by 3`. A recept a kanyart az arany mezőjén teszi meg, ahol a bányászás miatt úgyis megáll: így a kanyar nem kér külön lépést.",
  },
  "03-kis-labirintus": {
    hint: "kanyargós járatok, visszafordulás",
    insight:
      "A legközelebbi rög felé induló terv 28 sor. A recept a délnyugati röggel kezd, mert onnan egyetlen hosszú egyenes visz fel északra, és 24 sorból végez.",
  },
  "04-zsakutcak": {
    hint: "zsákutcák ki-be járása",
    insight:
      "Egy zsákutca ára: be, bányászás, `turn by 2`, ki. A recept úgy rendezi a sorrendet, hogy a kifelé tett lépés már a következő zsákutca felé vigyen.",
  },
  "05-kigyo": {
    hint: "hosszú egyenesek",
    insight:
      "Minden szakasz egyetlen `step forward`, így a teljes folyosó 12 sor. Mezőnként lépkedő ciklussal sokkal több lenne, Lámpafényben viszont pont az a biztonságos.",
  },
  "06-elerhetetlen-kincs": {
    hint: "a harmadik arany falakkal körülzárt, nem érhető el",
    insight:
      "A harmadik arany falakkal körülzárt kamrában van. Aki keresi, csak sorokat éget: a maximum 2 / 3 arany, és ez is teljes eredmény.",
  },
  "07-aranymezo": {
    hint: "sok bányászás nyílt terepen",
    insight:
      "Tizenkét rög három sorban. Soronként haladva minden rög két sor, a sorváltás pedig egy kanyar a sor szélső rögén. Ha a kanyar nem rögre esik, egy lépéssel több kell.",
  },
  "08-a-nagy-banya": {
    hint: "15×15-ös térkép, köd, hosszú futás",
    insight:
      "A legrövidebb, mezőben mért úton haladva 94 sor jön ki. A recept néhol hosszabb, de egyenesebb folyosót választ, és 84 sorból végez.",
  },
  "09-kerulout": {
    hint: "hosszú egyenesek a pálya szélén",
    insight:
      "A belső labirintuson át mezőben rövidebb az út, mégis 26 sor. A recept a pálya szélén halad: három kanyar, hosszú egyenesek, 12 sor. A távolság ingyen van, a kanyar nem.",
  },
  "10-oszlopcsarnok": {
    hint: "egy vonalba eső rögök egymás után",
    insight:
      "A robot előtt ott egy rög, a recept mégsem azzal kezd. Az oszlopsorok között minden sor és oszlop egyenes folyosó: az egy vonalba eső rögöket érdemes egymás után venni. A legközelebbi rög felé induló terv 49 sor, a recept 42.",
  },
  "11-geoda": {
    hint: "nem a szomszéd rög az első",
    insight:
      "A szomszéd rög csalogat. A recept előbb a túloldalra megy, onnan egy egyenesben veszi fel a közelit, majd ugyanabban az oszlopban a harmadikat: 9 sor a kézenfekvő 11 helyett.",
  },
  "12-kristalytukor": {
    hint: "a kezdőirány félrevezet",
    insight:
      "A robot kelet felé néz, de minden rög nyugaton van. A recept először a legtávolabbi sarokba megy, és onnan lefelé söpör végig: a fordulók a rögökre esnek.",
  },
  "13-lila-erek": {
    hint: "kerülő a lépcső helyett",
    insight:
      "A lépcsőn minden fok két sor. A recept a pálya szélén megkerüli a lépcsőt, alulról indul felfelé, és a lépcső közepén fejezi be: 28 sor a kézenfekvő 38 helyett.",
  },
  "13-lila-erek-vakon": {
    hint: "jobbkéz-szabály, a térkép ismerete nélkül",
    insight:
      "Fordulj jobbra, és amíg fal van előtted, fordulj balra; aztán lépj egyet, és ha arany volt előtted, bányássz. A pálya egyetlen összefüggő járat, ezért a falkövető vakon is mind az öt rögöt megtalálja.",
  },
  "14-kilenc-kristaly": {
    hint: "kanyar a rögön",
    insight:
      "Kilenc rög szabálytalan rácsban. Ahol úgyis megállsz bányászni, ott a kanyar egy sor; máshol kettő, mert előbb oda kell lépni. A recept így 26 sor, a kézenfekvő terv 34.",
  },
  "15-ametisztkatedralis": {
    hint: "holtág a végére",
    insight:
      "Tizenegy rög kápolnákkal. A program bárhol véget érhet, ezért a recept a holtágakat úgy rendezi, hogy a legmélyebb végén fejezzen be: 42 sor, a kézenfekvő terv 55.",
  },
  "16-rozsdas-sinek": {
    hint: "a közeli rög az utolsó",
    insight:
      "Az alsó sín bal végén lévő rög van a legközelebb, mégis az az utolsó. A recept a felső sínen végigmegy, a végén lefordul, és az alsó sínen egyetlen egyenesben veszi fel a két rögöt.",
  },
  "17-iranytu": {
    hint: "az ágak sorrendje",
    insight:
      "Öt rög négy irányban. A kereszteződésből minden ág külön kirándulás; a recept úgy választja a sorrendet, hogy a visszaút mindig a következő ág felé nézzen. 28 sor a kézenfekvő 34 helyett.",
  },
  "17-iranytu-vakon": {
    hint: "jobbkéz-szabály, Lámpafényben",
    insight:
      "Ugyanaz a falkövető, mint a Lila ereknél. A kereszteződés ágai zsákutcák, ezért a jobbkéz-szabály mindegyikbe bemegy és kijön: a térkép ismerete nélkül is mind az öt rög meglesz.",
  },
  "18-vasercfejtes": {
    hint: "kígyózás, kanyar a rögön",
    insight:
      "Tíz rög nyílt terepen. A kígyózó út akkor rövid, ha a kanyarok rögökre esnek. A legközelebbi rög felé induló terv 36 sor, a recept 29.",
  },
  "19-a-voros-labirintus": {
    hint: "körök az útvesztőben",
    insight:
      "Körökkel teli útvesztő. A falkövető itt egy kör körül a végtelenségig járhat, a legközelebbi rög felé induló terv pedig 113 sor. A recept 74: a körök közül mindig az egyenesebbet választja.",
  },
  "20-kapuk": {
    hint: "kevés kapuátkelés",
    insight:
      "Kilenc kamra, keskeny kapuk. Minden kapuátkelés kanyarokkal jár, ezért az a jó sorrend, amelyik a legritkábban megy át kapun. A legközelebbi rög felé induló terv 64 sor, a recept 50.",
  },
  "21-mohafeny": {
    hint: "a legmélyebb ág a végére",
    insight:
      "Fésűs járat, a fogak zsákutcák. Mivel a program bárhol véget érhet, a recept a legmélyebb fogat hagyja utoljára, és onnan már nem jön vissza.",
  },
  "22-szigetek": {
    hint: "megkerülés vagy átkelés",
    insight:
      "Kőszigetek a nyílt vízen. A sziget mellett gyakran egyetlen egyenes visz a következő rögig, átvágva viszont két kanyar kell. A recept 29 sor, a legrövidebb úton haladó terv 52.",
  },
  "23-tukorto": {
    hint: "egy átjáró, két part",
    insight:
      "A tó két partját csak a középső átjáró köti össze. A recept úgy osztja be a sorrendet, hogy minél ritkábban kelljen átjönni: 36 sor a kézenfekvő 48 helyett.",
  },
  "24-smaragdkigyo": {
    hint: "kígyójárat, két átjáró",
    insight:
      "Hosszú kígyójárat, a kanyarok a fordulókban vannak. Az alsó szakaszra két átjáró vezet; a recept azt választja, amelyikről a megmaradt rögök egy vonalban vannak.",
  },
  "24-smaragdkigyo-vakon": {
    hint: "jobbkéz-szabály, sötétben",
    insight:
      "A jobbkéz-szabály a hosszú kígyón is végigér teljes sötétben. 804 sor: belefér az 1000 soros keretbe, de csak éppen, ezért itt nincs hely felesleges ellenőrzésre.",
  },
  "25-a-to-szeme": {
    hint: "elérhetetlen rög a tó közepén",
    insight:
      "A tó közepén lévő kamrába nem vezet út, így a maximum 12 / 13 arany. A többi rög a tó körüli gyűrűkön van; a recept 59 sor, a legközelebbi rög felé induló terv 75.",
  },
  "26-hamureteg": {
    hint: "útba ejtett közeli rög",
    insight:
      "A közeli rög felé indulni csábító. A recept előbb a pálya szélén megy végig, és a közelit visszafelé, útba ejtve veszi fel: 12 sor, épp a célértéken belül.",
  },
  "27-lavafolyo": {
    hint: "kevés hídátkelés",
    insight:
      "Két híd vezet át a lávafolyón. A recept úgy osztja be a sorrendet, hogy minél ritkábban kelljen átkelni: 33 sor, a legrövidebb úton haladó terv 55.",
  },
  "28-obszidiankapu": {
    hint: "körök fekete üvegben",
    insight:
      "Zsákutcák és körök. A legközelebbi rög felé induló terv itt a legdrágább: 73 sor. A recept 50: a körök közül azt járja be, amelyik útközben a legtöbb rögön visz át.",
  },
  "29-izzo-tarnak": {
    hint: "tárnánként, egy közös aknával",
    insight:
      "Egymás alatti tárnák, egyetlen közös aknával. Minden tárnaváltás az aknán át vezet, ezért a recept egy tárnában mindent összeszed, mielőtt továbbmegy: 65 sor a kézenfekvő 91 helyett.",
  },
  "30-a-sziv": {
    hint: "gyűrűk és rések",
    insight:
      "Gyűrűk gyűrűkben, a közepén a Vakond. A gyűrűk közti rések rövidítések: a recept 55 sorból ér a Szívig úgy, hogy közben mind a 13 rögöt felveszi.",
  },
  "homokozo/01-lepes-es-csakany": {
    hint: "step forward, mine here",
    insight:
      "A legegyszerűbb program: két lépés, két bányászás. A step forward paramétere azt mondja meg, hány mezőt lépjen a robot egyetlen sorban.",
  },
  "homokozo/02-negy-irany": {
    hint: "turn by 1, 2 és 3",
    insight:
      "A turn by n n negyedfordulat balra: 1 balra, 2 hátraarc, 3 jobbra, és mindegyik egyetlen sor. A recept mindhármat bemutatja; a célérték ennél rövidebb, keresd meg!",
  },
  "homokozo/03-tapogatozas": {
    hint: "isThere 0/1/2, if/else, print",
    insight:
      "Az isThere csak a robot előtti mezőt vizsgálja: 0 üres, 1 fal, 2 arany. Az eredmény logikai érték, amit set ment el, if dönt róla, print pedig kiír a konzolra.",
  },
  "homokozo/04-menj-a-falig": {
    hint: "while, not, számláló",
    insight:
      "A feladatkiírás példaprogramja. A while addig ismétel, amíg a feltétele igaz; a not megfordítja a logikai értéket. A végén a print kiírja, hány rögöt talált: 3.",
  },
  "homokozo/05-szamlalas": {
    hint: "+ - *, < <= > >=",
    insight:
      "Egész számok és összehasonlítások. A step forward paramétere változó is lehet (hossz). A konzolon sorban: 100, 0, true, false, true.",
  },
  "homokozo/06-logikai-kapuk": {
    hint: "and, or, not, = és <>, true/false",
    insight:
      "Összetett feltétel két lépésben: a MineScriptben nincs zárójel, ezért minden részeredményt külön set ment el. A ciklus akkor áll meg, ha elég aranyat talált, vagy fal jön.",
  },
  "homokozo/07-jobb-kez-a-falon": {
    hint: "egymásba ágyazott while, jobbkéz-szabály",
    insight:
      "A külső ciklus lépésenként halad, a belső addig fordul balra, amíg fal van előtte. A robot a térkép ismerete nélkül is mind a három rögöt megtalálja: 444 sor, belefér az 1000-be.",
  },
};
