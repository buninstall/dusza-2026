import lepes from "../../../../docs/receptek/homokozo/01-lepes-es-csakany.txt" with {
  type: "text",
};
import negyIrany from "../../../../docs/receptek/homokozo/02-negy-irany.txt" with { type: "text" };
import tapogatozas from "../../../../docs/receptek/homokozo/03-tapogatozas.txt" with {
  type: "text",
};
import falig from "../../../../docs/receptek/homokozo/04-menj-a-falig.txt" with { type: "text" };
import szamlalas from "../../../../docs/receptek/homokozo/05-szamlalas.txt" with { type: "text" };
import logika from "../../../../docs/receptek/homokozo/06-logikai-kapuk.txt" with { type: "text" };
import jobbKez from "../../../../docs/receptek/homokozo/07-jobb-kez-a-falon.txt" with {
  type: "text",
};

export type SandboxMap = {
  owner: string;
  title: string;
  description: string;
  parSteps: number;
  content: string;
};

export const SANDBOX_MAPS: readonly SandboxMap[] = [
  {
    owner: "demo2",
    title: "Lépés és csákány",
    description:
      "Bemutató: step forward és mine here. Egy step forward több mezőt is lép, a mine here a robot alatti rögöt bányássza ki.",
    parSteps: 4,
    content: lepes,
  },
  {
    owner: "demo3",
    title: "Négy irány",
    description:
      "Bemutató: turn by. A turn by 1 balra, a turn by 2 hátra, a turn by 3 jobbra fordít; mindegyik egyetlen sor.",
    parSteps: 11,
    content: negyIrany,
  },
  {
    owner: "demo2",
    title: "Tapogatózás",
    description:
      "Bemutató: isThere 0, 1 és 2, if és else, print. A robot csak a közvetlenül előtte lévő mezőt érzékeli.",
    parSteps: 2,
    content: tapogatozas,
  },
  {
    owner: "demo3",
    title: "Menj a falig",
    description:
      "Bemutató: while, not és számláló. A feladatkiírás példaprogramja: addig lép, amíg falba nem ütközne, és kiírja, hány rögöt talált.",
    parSteps: 6,
    content: falig,
  },
  {
    owner: "demo2",
    title: "Számlálás",
    description:
      "Bemutató: egész számok, + - *, < <= > >=. Ciklusváltozóval lép kettesével, a végén kiírja az eredményeket.",
    parSteps: 8,
    content: szamlalas,
  },
  {
    owner: "demo3",
    title: "Logikai kapuk",
    description:
      "Bemutató: and, or, not, = és <>, true és false. A robot megáll, ha elég aranyat talált, vagy fal jön.",
    parSteps: 6,
    content: logika,
  },
  {
    owner: "demo2",
    title: "Jobb kéz a falon",
    description:
      "Bemutató: egymásba ágyazott while. A jobbkéz-szabállyal a robot a térkép ismerete nélkül is végigjárja a kanyargó járatot.",
    parSteps: 30,
    content: jobbKez,
  },
];
