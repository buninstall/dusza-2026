import map01 from "../../../../docs/receptek/palyak/01-egyenes-folyoso.txt" with { type: "text" };
import map02 from "../../../../docs/receptek/palyak/02-az-elso-kanyar.txt" with { type: "text" };
import map03 from "../../../../docs/receptek/palyak/03-kis-labirintus.txt" with { type: "text" };
import map04 from "../../../../docs/receptek/palyak/04-zsakutcak.txt" with { type: "text" };
import map05 from "../../../../docs/receptek/palyak/05-kigyo.txt" with { type: "text" };
import map06 from "../../../../docs/receptek/palyak/06-elerhetetlen-kincs.txt" with {
  type: "text",
};
import map07 from "../../../../docs/receptek/palyak/07-aranymezo.txt" with { type: "text" };
import map08 from "../../../../docs/receptek/palyak/08-a-nagy-banya.txt" with { type: "text" };
import map09 from "../../../../docs/receptek/palyak/09-kerulout.txt" with { type: "text" };
import map10 from "../../../../docs/receptek/palyak/10-oszlopcsarnok.txt" with { type: "text" };
import map11 from "../../../../docs/receptek/palyak/11-geoda.txt" with { type: "text" };
import map12 from "../../../../docs/receptek/palyak/12-kristalytukor.txt" with { type: "text" };
import map13 from "../../../../docs/receptek/palyak/13-lila-erek.txt" with { type: "text" };
import map14 from "../../../../docs/receptek/palyak/14-kilenc-kristaly.txt" with { type: "text" };
import map15 from "../../../../docs/receptek/palyak/15-ametisztkatedralis.txt" with {
  type: "text",
};
import map16 from "../../../../docs/receptek/palyak/16-rozsdas-sinek.txt" with { type: "text" };
import map17 from "../../../../docs/receptek/palyak/17-iranytu.txt" with { type: "text" };
import map18 from "../../../../docs/receptek/palyak/18-vasercfejtes.txt" with { type: "text" };
import map19 from "../../../../docs/receptek/palyak/19-a-voros-labirintus.txt" with {
  type: "text",
};
import map20 from "../../../../docs/receptek/palyak/20-kapuk.txt" with { type: "text" };
import map21 from "../../../../docs/receptek/palyak/21-mohafeny.txt" with { type: "text" };
import map22 from "../../../../docs/receptek/palyak/22-szigetek.txt" with { type: "text" };
import map23 from "../../../../docs/receptek/palyak/23-tukorto.txt" with { type: "text" };
import map24 from "../../../../docs/receptek/palyak/24-smaragdkigyo.txt" with { type: "text" };
import map25 from "../../../../docs/receptek/palyak/25-a-to-szeme.txt" with { type: "text" };
import map26 from "../../../../docs/receptek/palyak/26-hamureteg.txt" with { type: "text" };
import map27 from "../../../../docs/receptek/palyak/27-lavafolyo.txt" with { type: "text" };
import map28 from "../../../../docs/receptek/palyak/28-obszidiankapu.txt" with { type: "text" };
import map29 from "../../../../docs/receptek/palyak/29-izzo-tarnak.txt" with { type: "text" };
import map30 from "../../../../docs/receptek/palyak/30-a-sziv.txt" with { type: "text" };
import type { LampMode } from "../db/schema.ts";

export type TutorialMap = {
  title: string;
  description: string;
  content: string;
  lampMode: LampMode;
};

export const TUTORIAL_MAPS: readonly TutorialMap[] = [
  {
    title: "1. Egyenes folyosó",
    lampMode: "open",
    description:
      "R-07 első métere a Dusza-tárnában. Egyetlen sor, két aranyrög. Elég a step forward és a mine here.",
    content: map01,
  },
  {
    title: "2. Az első kanyar",
    lampMode: "open",
    description:
      "A régi sín itt délnek fordul. A folyosó a végén kanyarodik: itt kell először a turn by.",
    content: map02,
  },
  {
    title: "3. Kis labirintus",
    lampMode: "open",
    description:
      "A bányászok sietve vájt járatai. Három arany kanyargós járatokban. Érdemes az isThere-rel tapogatózni.",
    content: map03,
  },
  {
    title: "4. Zsákutcák",
    lampMode: "open",
    description:
      "Felhagyott fejtések, mindegyik végében maradt valami. Öt arany, több zsákutcával. A rövid út a kevesebb lépés.",
    content: map04,
  },
  {
    title: "5. Kígyó",
    lampMode: "lamp",
    description:
      "Hosszú, oda-vissza kanyargó folyosó, a végén R-01 roncsa. Kialszik a fény: jó terep a while ciklushoz.",
    content: map05,
  },
  {
    title: "6. Elérhetetlen kincs",
    lampMode: "lamp",
    description:
      "Az első mészkőcsarnok. Az egyik arany falakkal körülzárt kamrában van: nem minden kincs vihető el. A robot észak felé néz.",
    content: map06,
  },
  {
    title: "7. Aranymező",
    lampMode: "dark",
    description:
      "Tágas, visszhangos csarnok. Nyílt terep tizenkét arannyal. Ki gyűjti össze a legkevesebb lépésből?",
    content: map07,
  },
  {
    title: "8. A nagy bánya",
    lampMode: "dark",
    description:
      "A legnagyobb, 15×15-ös bánya, sok elágazással és szétszórt arannyal. Valahol mélyen egyenletesen kopog valami.",
    content: map08,
  },
  {
    title: "9. Kerülőút",
    lampMode: "open",
    description:
      "A rövid út kanyarog, a hosszú egyenes. Egy step forward tíz mezőt is visz egyetlen sorban: itt nem a távolság számít, hanem a kanyar.",
    content: map09,
  },
  {
    title: "10. Oszlopcsarnok",
    lampMode: "lamp",
    description:
      "Oszlopok erdeje, R-02 nyomai körbe-körbe a porban. A rögök az oszlopok közt szóródtak szét: a sorrend dönti el, hány kanyar kell.",
    content: map10,
  },
  {
    title: "11. Geoda",
    lampMode: "open",
    description:
      "Lila kristályokkal bélelt üreg, a kristályok fényt adnak. Három rög, egy kézenfekvő út és egy, amelyik két sorral rövidebb.",
    content: map11,
  },
  {
    title: "12. Kristálytükör",
    lampMode: "open",
    description:
      "Tükrös kristályfal: a bánya két fele majdnem egyforma, de csak majdnem. Számít, merre néz induláskor a robot.",
    content: map12,
  },
  {
    title: "13. Lila erek",
    lampMode: "lamp",
    description:
      "Az ametisztér lépcsőzetesen fut lefelé. A lépcsőn minden fok két sor: néha a kerülő a rövidebb, és a sorrend mindent eldönt.",
    content: map13,
  },
  {
    title: "14. Kilenc kristály",
    lampMode: "open",
    description:
      "Kilenc kristály szabálytalan rácsban. Ahol úgyis megállsz bányászni, ott fordulj: a kanyar ott csak egy sor.",
    content: map14,
  },
  {
    title: "15. Ametisztkatedrális",
    lampMode: "dark",
    description:
      "Szimmetrikus kristálycsarnok kápolnákkal, tizenegy röggel. Ha egy rög holtágban van, hagyd a végére: a programnak nem kell visszajönnie.",
    content: map15,
  },
  {
    title: "16. Rozsdás sínek",
    lampMode: "open",
    description:
      "Két párhuzamos rozsdás sín. Nem az számít, melyik rög van közelebb, hanem hogy utána merre mész tovább.",
    content: map16,
  },
  {
    title: "17. Iránytű",
    lampMode: "lamp",
    description:
      "Megbolondult iránytű egy kereszteződésben. Öt rög négy irányban: az első ötlet itt nem a legjobb. Sötétben a jobb kéz szabálya is hazavisz.",
    content: map17,
  },
  {
    title: "18. Vasércfejtés",
    lampMode: "open",
    description:
      "Nyitott vasércfejtés tíz szétszórt röggel. Egy kígyózó út mindet felszedi, ha a rögökön fordulsz, nem mellettük.",
    content: map18,
  },
  {
    title: "19. A vörös labirintus",
    lampMode: "dark",
    description:
      "Vörös kőzetbe vájt, körökkel teli útvesztő, teljes sötétben. Vigyázz a falkövetéssel: egy kör körül a robot a végtelenségig járhat, ahogy R-02.",
    content: map19,
  },
  {
    title: "20. Kapuk",
    lampMode: "lamp",
    description:
      "Kilenc kamra, keskeny kapuk, a kapuk mögött R-04 roncsa. Melyik kapun át, milyen sorrendben? Aki mindig a legközelebbi rög felé indul, tizennégy sorral többet ír.",
    content: map20,
  },
  {
    title: "21. Mohafény",
    lampMode: "open",
    description:
      "Zölden derengő moha egy fésűs járatban. A program bárhol véget érhet: a legmélyebb ágat hagyd utoljára.",
    content: map21,
  },
  {
    title: "22. Szigetek",
    lampMode: "open",
    description:
      "Kőszigetek a smaragdtó partján, nyolc röggel. A sziget megkerülése néha olcsóbb, mint az átkelés.",
    content: map22,
  },
  {
    title: "23. Tükörtó",
    lampMode: "lamp",
    description:
      "A tó közepén kőfal, két oldalán tükörképek. Melyik partot járod be először, és hol kelsz át?",
    content: map23,
  },
  {
    title: "24. Smaragdkígyó",
    lampMode: "dark",
    description:
      "Hosszú, kígyózó járat a víz szintje alatt, tizenkét röggel, sötétben. A falak mentén tapogatózva is célba érsz.",
    content: map24,
  },
  {
    title: "25. A tó szeme",
    lampMode: "lamp",
    description:
      "A tó közepén zárt kamra, benne egy rög: a tó szeme, amit senki nem érhet el. Körülötte tizenkét rög a moha alatt.",
    content: map25,
  },
  {
    title: "26. Hamuréteg",
    lampMode: "open",
    description:
      "Hamu és izzó parázs, az első lávaerek. Kevés rög, de csak egyetlen útvonal fér bele a célértékbe.",
    content: map26,
  },
  {
    title: "27. Lávafolyó",
    lampMode: "open",
    description:
      "Láva szeli ketté a csarnokot, két kőhíddal. Minden átkelés drága: tervezd meg, hányszor mész át.",
    content: map27,
  },
  {
    title: "28. Obszidiánkapu",
    lampMode: "lamp",
    description:
      "Fekete üveg kapui, zsákutcák és körök. Itt állt meg R-06. Aki mindig a legközelebbi rög felé indul, huszonhárom sorral hosszabb programot ír, mint kellene.",
    content: map28,
  },
  {
    title: "29. Izzó tárnák",
    lampMode: "dark",
    description:
      "Egymás alatt futó izzó tárnák, egyetlen közös aknával. Sötét van és fullasztó meleg. A kopogás már a talpad alól jön.",
    content: map29,
  },
  {
    title: "30. A Szív",
    lampMode: "dark",
    description:
      "A hegy szíve. Gyűrűk gyűrűkben, a közepén dolgozik a Vakond. Gyűjtsd össze az utolsó rögöt is, és a kopogás végre elhallgat.",
    content: map30,
  },
];
