export type StratumId = "clay" | "limestone" | "amethyst" | "iron" | "emerald" | "obsidian";

export type ChapterFinding = {
  robot: string;
  fate: string;
  lesson: string;
  code: string;
};

export type Chapter = {
  numeral: string;
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

export const story = {
  campaignLabel: "A kampány fejezetei",
  chapterHeading: (numeral: string, title: string) => `${numeral} fejezet · ${title}`,
  chapterLevels: (numeral: string) => `${numeral} fejezet pályái`,
  depthRock: (depth: string, rock: string) => `${depth} · ${rock}`,
  diaryBy: (date: string) => `Kelemen Bálint főaknász naplója, ${date}`,
  diaryLocked: "A napló következő lapja a fejezet első aranyánál kerül elő.",
  findingHeading: (robot: string) => `Lelet: ${robot}`,
  findingLesson: "Tanulság",
  findingCode: (code: string) => `Hibakód: ${code}`,
  findingLocked: (cleared: number, total: number) =>
    `${cleared} / ${total} pálya kifosztva. Ami a fejezet végén vár, az még sötétben van.`,
  progressLabel: (cleared: number, total: number) => `${cleared} / ${total} pálya kifosztva`,
  othersHeading: "Felfedezők tárnái",
  othersText: "A játékosok által vájt szintek, a kampány alatt.",
  epilogueHeading: "Epilógus · Csend",
  epilogue:
    "Az utolsó rög a csillédben van. A Szív elcsendesedett: a Vakond ciklusa véget ért, mert nincs több arany, amit kereshetne. Száz év után először csend van a Dusza-tárnában. A bánya mostantól a tiéd: a fúrófronton új szinteket vájhatsz.",
  epilogueLocked: "A mélyből még szól a kopogás.",
};
