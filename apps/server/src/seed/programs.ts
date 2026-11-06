export type SampleProgram = {
  owner: string;
  title: string;
  mapIndex: number;
  source: string;
};

const walkAndMine = [
  "set count to 0",
  "set fal to isThere 1",
  "set megy to not fal",
  "while megy",
  "    set arany to isThere 2",
  "    if arany",
  "        step forward 1",
  "        mine here",
  "        set count to count + 1",
  "    else",
  "        step forward 1",
  "    set fal to isThere 1",
  "    set megy to not fal",
  "print count",
  "",
].join("\n");

export const SAMPLE_PROGRAMS: readonly SampleProgram[] = [
  {
    owner: "demo1",
    title: "Folyosó: célzott lépések",
    mapIndex: 0,
    source: "step forward 3\nmine here\nstep forward 3\nmine here\n",
  },
  {
    owner: "demo2",
    title: "Folyosó: menj, amíg falba nem érsz",
    mapIndex: 0,
    source: walkAndMine,
  },
  {
    owner: "demo3",
    title: "Folyosó: arany nélkül",
    mapIndex: 0,
    source: "step forward 7\n",
  },
  {
    owner: "demo1",
    title: "Kanyar: fordulás jobbra",
    mapIndex: 1,
    source: "step forward 4\nmine here\nturn by 3\nstep forward 3\nmine here\n",
  },
  {
    owner: "demo2",
    title: "Kanyar: túl messzire",
    mapIndex: 1,
    source: "step forward 5\n",
  },
  {
    owner: "demo3",
    title: "Kígyó: első aranyrög",
    mapIndex: 4,
    source: "step forward 10\nmine here\nprint true\n",
  },
];
