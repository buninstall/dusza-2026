import { type PixelRows, sprite } from "./pixel-art.ts";

const MARK_ART: PixelRows = [
  "......kLLk......",
  ".......kk.......",
  "...kkkkkkkkkk...",
  "..keeeeeeeeaak..",
  "..keaaaaaaaadk..",
  "..kkkkkkkkkkkk..",
  "..kvvkkkkkkvvk..",
  "..kvvkkkkkkvvk..",
  "..kkkkkkkkkkkk..",
  "..kaaaaaaaaadk..",
  "..kaakkkkkkadk..",
  "..kaaaaaaaaddk..",
  "...kkkkkkkkkk...",
  ".....kttttk.oyo.",
  "...kkkkkkkkoggbo",
  "...........oobo.",
];

export const LOGO_MARK = sprite(MARK_ART, {
  k: "steel-edge",
  e: "steel-hi",
  a: "steel",
  d: "steel-lo",
  t: "tread",
  v: "visor",
  L: "lamp",
  o: "ore-edge",
  g: "ore",
  y: "ore-hi",
  b: "ore-lo",
});
