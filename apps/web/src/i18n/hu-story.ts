export type StratumId = "clay" | "limestone" | "amethyst" | "iron" | "emerald" | "obsidian";

export type ChapterFinding = {
  robot: string;
  fate: string;
  lesson: string;
  code: string;
};

export type Chapter = {
  numeral: string;
  from: string;
  title: string;
  depth: string;
  rock: string;
  stratum: StratumId;
  intro: string;
  diary: string;
  diaryDate: string;
  finding: ChapterFinding;
  levels: readonly string[];
};

export const CHAPTERS: readonly Chapter[] = [
  {
    numeral: "I.",
    from: "az I. fejezetből",
    title: "Az elhagyott tárna",
    depth: "−12 … −60 m",
    rock: "agyag",
    stratum: "clay",
    intro:
      "1926 telén a Dusza-tárna bányászai egyetlen éjszaka alatt felhagytak a munkával. A csillék a síneken maradtak, a lámpák a falakon. Száz év múlva R-07, egy acélból kovácsolt felfedező ereszkedik le a főaknán. Hat robot járt itt előtte. Egyik sem tért vissza.",
    diary: "Gazdag ér, jó kőzet. Ha így megy, karácsonyra kifizetjük a társulat adósságát.",
    diaryDate: "1926. november 3.",
    finding: {
      robot: "R-01",
      fate: "A folyosó végén, a falnak préselődve. Lépett, mielőtt megnézte volna, mi van előtte.",
      lesson: "Lépés előtt: isThere 1.",
      code: "E_BEDROCK_HIT",
    },
    levels: [
      "1. Egyenes folyosó",
      "2. Az első kanyar",
      "3. Kis labirintus",
      "4. Zsákutcák",
      "5. Kígyó",
    ],
  },
  {
    numeral: "II.",
    from: "a II. fejezetből",
    title: "A visszhangok csarnoka",
    depth: "−72 … −120 m",
    rock: "mészkő",
    stratum: "limestone",
    intro:
      "Mészkőcsarnokok, ahol minden hang ezerszer verődik vissza. Itt hallja meg R-07 először: valahol nagyon mélyen valami egyenletesen kopog.",
    diary: "Harmadik napja halljuk a kopogást. Mélyről jön, egyenletesen, mint egy ingaóra.",
    diaryDate: "1926. november 19.",
    finding: {
      robot: "R-02",
      fate: "Egy oszlop tövében, lemerült akkuval. Körbe-körbe járt, mert a ciklusából nem vezetett kiút.",
      lesson: "Minden while-nak kell egy feltétel, amely egyszer hamis lesz.",
      code: "INSTRUCTION_COUNT_LIMIT_EXCEEDED",
    },
    levels: [
      "6. Elérhetetlen kincs",
      "7. Aranymező",
      "8. A nagy bánya",
      "9. Kerülőút",
      "10. Oszlopcsarnok",
    ],
  },
  {
    numeral: "III.",
    from: "a III. fejezetből",
    title: "Az ametisztüregek",
    depth: "−132 … −180 m",
    rock: "ametiszt",
    stratum: "amethyst",
    intro:
      "A kőzet lilán dereng. Üreges geodák, kristályerdők, tükröző falak. A szépség megállásra csábít, de a kopogás tovább hív lefelé.",
    diary: "Ametisztet találtunk. Az emberek meg akartak állni, de a kopogás tovább hívta őket.",
    diaryDate: "1926. december 2.",
    finding: {
      robot: "R-03",
      fate: "Kettétört csákánnyal egy geoda mellett. Üres kőbe vágott, újra és újra.",
      lesson: "Csak aranyon bányássz: előbb isThere 2, utána lépés és mine here.",
      code: "E_NO_GOLD",
    },
    levels: [
      "11. Geoda",
      "12. Kristálytükör",
      "13. Lila erek",
      "14. Kilenc kristály",
      "15. Ametisztkatedrális",
    ],
  },
  {
    numeral: "IV.",
    from: "a IV. fejezetből",
    title: "A vörös ér",
    depth: "−192 … −240 m",
    rock: "vasérc",
    stratum: "iron",
    intro:
      "Rozsdavörös vasérc és egy iránytű, amely megbolondul. A sínek itt régebbiek, mint bármelyik térkép a társulat irodájában.",
    diary:
      "A kőzet meleg, az iránytű körbe forog. Szabó Pista azt mondja, a hegy él. Nem merem megmondani nekik az igazat.",
    diaryDate: "1926. december 11.",
    finding: {
      robot: "R-04",
      fate: "Rozsdás roncs a sínek között. Egy változója egyszer szám volt, aztán igaz-hamis akart lenni.",
      lesson: "A változó típusa az első set-kor végleg rögzül.",
      code: "E_TYPE_MISMATCH",
    },
    levels: [
      "16. Rozsdás sínek",
      "17. Iránytű",
      "18. Vasércfejtés",
      "19. A vörös labirintus",
      "20. Kapuk",
    ],
  },
  {
    numeral: "V.",
    from: "az V. fejezetből",
    title: "A smaragdtó",
    depth: "−252 … −300 m",
    rock: "malachit",
    stratum: "emerald",
    intro:
      "Föld alatti tó, zölden derengő moha, csepegő csend. A víz tükrében a kopogás hangja hullámokat vet.",
    diary:
      "Bevallom: a kopogás az én művem. Megépítettem a Vakondot, hogy oda menjen, ahová ember már nem mehet. Egyetlen paranccsal küldtem le: amíg aranyat talál, bányásszon.",
    diaryDate: "1926. december 18.",
    finding: {
      robot: "R-05",
      fate: "A tó partján, mohával benőve. Olyasmire próbált emlékezni, amit sosem tudott: egy változót olvasott, mielőtt értéket adott volna neki.",
      lesson: "Előbb set, aztán használat.",
      code: "E_UNINITIALIZED",
    },
    levels: ["21. Mohafény", "22. Szigetek", "23. Tükörtó", "24. Smaragdkígyó", "25. A tó szeme"],
  },
  {
    numeral: "VI.",
    from: "a VI. fejezetből",
    title: "A hegy szíve",
    depth: "−312 … −360 m",
    rock: "obszidián",
    stratum: "obsidian",
    intro:
      "Fekete üveg és izzó láva. Itt már nem visszhang a kopogás: a falakból jön, a talpad alól, mindenhonnan. Valahol előtted dolgozik a Vakond.",
    diary:
      "A Vakond elérte a hegy szívét, és a Szív aranya sosem fogy el. A kopogás nem áll meg. Holnap lezárjuk az aknát. Aki ezt olvassa: vigye el az utolsó rögöt is, és a Vakond végre megpihen.",
    diaryDate: "1926. december 21.",
    finding: {
      robot: "R-06",
      fate: "Egy lépésre a Szívtől. Olyat kérdezett a kőtől, amire nincs szó: isThere 3.",
      lesson: "Az isThere csak a 0, az 1 és a 2 értéket ismeri.",
      code: "E_BAD_ARG",
    },
    levels: [
      "26. Hamuréteg",
      "27. Lávafolyó",
      "28. Obszidiánkapu",
      "29. Izzó tárnák",
      "30. A Szív",
    ],
  },
];

export const tourModes = {
  title: "Két játékmód vár",
  sandboxTitle: "Homokozó",
  sandbox:
    "Szabad bánya: a saját és a közösség pályái, a napi kihívás, és bemutató pályák a MineScript minden utasításához. Itt építhetsz is.",
  storyTitle: "Történet",
  story:
    "Harminc pálya hat fejezetben, Kelemen főaknász naplójával. A fejezetek ötösével nyílnak: a következő akkor, ha az előző minden pályáján kibányásztad az aranyat.",
  question: "Melyikkel kezdjük a bemelegítést?",
  pickSandbox: "Homokozó",
  pickStory: "Történet",
  back: "Vissza",
};

export const story = {
  modeLabel: "Játékmód",
  modes: { sandbox: "Homokozó", story: "Történet" },
  chapterHeading: (numeral: string, title: string) => `${numeral} fejezet · ${title}`,
  chapterLevels: (numeral: string) => `${numeral} fejezet pályái`,
  depthRock: (depth: string, rock: string) => `${depth} · ${rock}`,
  progress: (cleared: number, total: number) => `${cleared} / ${total} pálya kész`,
  journal: "Napló",
  diaryBy: (date: string) => `Kelemen Bálint főaknász naplója, ${date}`,
  diaryLocked: "A napló következő lapja a fejezet első aranyánál kerül elő.",
  findingHeading: (robot: string) => `Lelet: ${robot}`,
  findingLesson: "Tanulság",
  findingCode: (code: string) => `Hibakód: ${code}`,
  findingLocked: "A fejezet végén vár egy lelet. Ha minden pálya kész, előkerül.",
  lockedCount: (remaining: number) => `Még ${remaining} pálya`,
  lockedFrom: (from: string) => `${from} a feloldáshoz`,
  lockedRule: "Egy pálya akkor kész, ha minden elérhető aranyát kibányásztad.",
  lockedChained: "Előbb az előző fejezetnek kell kinyílnia.",
  lockedTile: "Zárva",
  lockedTileLabel: (title: string) => `Zárva: ${title}`,
  epilogueHeading: "Epilógus · Csend",
  epilogue:
    "Az utolsó rög a csillédben van. A Szív elcsendesedett: a Vakond ciklusa véget ért, mert nincs több arany, amit kereshetne. Száz év után először csend van a Dusza-tárnában.",
  leaderboard: "Történet ranglistája",
  leaderboardTitle: "Történet · Ranglista",
  leaderboardLead:
    "Az összes kampánypálya legjobb futásai összesítve. Előrébb áll, akinek több rögje van; egyenlőségnél akinek több aranya, majd akinek kevesebb lépés kellett.",
  leaderboardEmpty: "Még senki nem bányászott a Történetben. Légy te az első!",
  leaderboardCaption: "Történet ranglistája",
  columns: {
    rank: "Hely",
    player: "Játékos",
    nuggets: "Rögök",
    chapters: "Fejezet",
    gold: "Arany",
    steps: "Lépés",
  },
  nuggets: (earned: number, max: number) => `${earned} / ${max}`,
  chapterReached: (numeral: string) => `${numeral}`,
  backToStory: "Vissza a Történethez",
  frontStory:
    "Innen szól a kopogás. Ha egy fejezet minden pályája kész, a fúrófront egy réteggel mélyebbre jut.",
  frontSilent: "A kopogás elhallgatott. A Történet véget ért, a Homokozóban új szinteket vájhatsz.",
};
