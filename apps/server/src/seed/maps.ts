export type TutorialMap = {
  title: string;
  description: string;
  content: string;
};

export const TUTORIAL_MAPS: readonly TutorialMap[] = [
  {
    title: "1. Egyenes folyosó",
    description: "Egyetlen sor, két aranyrög. Elég a step forward és a mine here.",
    content: "1 8\n>..@..@.\n",
  },
  {
    title: "2. Az első kanyar",
    description: "A folyosó a végén délnek fordul: itt kell először a turn by.",
    content: "4 6\n>...@#\n####.#\n####.#\n####@#\n",
  },
  {
    title: "3. Kis labirintus",
    description: "Három arany kanyargós járatokban. Érdemes az isThere-rel tapogatózni.",
    content: "7 7\nv#...@#\n.#.#.##\n.#.#...\n...#.#@\n##.#.#.\n@..#...\n#######\n",
  },
  {
    title: "4. Zsákutcák",
    description: "Öt arany, több zsákutcával. A rövid út a kevesebb lépés.",
    content: "7 9\n>.......#\n.##.###.#\n.#@.#@..#\n.####.#.#\n...@#.#@#\n##.##...#\n@........\n",
  },
  {
    title: "5. Kígyó",
    description: "Hosszú, oda-vissza kanyargó folyosó: jó terep a while ciklushoz.",
    content: "5 11\n>.........@\n##########.\n@..........\n.##########\n.........@.\n",
  },
  {
    title: "6. Elérhetetlen kincs",
    description: "Az egyik arany falakkal körülzárt kamrában van. A robot észak felé néz.",
    content: "5 7\n^.....@\n.#####.\n.#@.#..\n.#..#..\n.####.@\n",
  },
  {
    title: "7. Aranymező",
    description: "Nyílt terep tizenkét arannyal. Ki gyűjti össze a legkevesebb lépésből?",
    content: "6 10\n..........\n.@.@.@.@..\n..........\n.@.@>@.@..\n..........\n.@.@.@.@..\n",
  },
  {
    title: "8. A nagy bánya",
    description: "A legnagyobb, 15×15-ös bánya, sok elágazással és szétszórt arannyal.",
    content: [
      "15 15",
      ">....#....@...#",
      ".###.#.##.###.#",
      ".#@..#..#...#..",
      ".#.####.###.#.#",
      ".#......#@..#.#",
      ".######.#.###.#",
      "....@.#.#.....#",
      "#####.#.#####.#",
      ".@....#...@...#",
      ".####.#######.#",
      ".#..#.......#.#",
      ".#@.#######.#..",
      ".##.#.....#.###",
      "....#.@.#...@.#",
      "###...###.#####",
      "",
    ].join("\n"),
  },
];
