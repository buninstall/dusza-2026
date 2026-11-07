import { viewportWidth } from "../../lib/scrollbar-gap.ts";
import { buildMine, type ChapterInput, type Level, type LevelInput } from "./build.ts";
import { readDeepPalette } from "./palette.ts";
import { runScene } from "./scene.ts";
import { createView } from "./view.ts";
import { measureBox, pageHeight } from "./world.ts";

export const MINE_ATTR = "data-mine";
const NARROW_WIDTH = 768;
const MIN_WIDTH = 40;

export type DeepHost = {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  mid: HTMLCanvasElement;
  front: HTMLCanvasElement | null;
  paletteSource: Element;
  isStatic: boolean;
  isFresh: boolean;
  digId: number | null;
  target: () => number | null;
  onDigStart: (element: HTMLElement) => void;
  onDigDone: (element: HTMLElement) => void;
};

function readLevels(
  root: HTMLElement,
  scale: number,
): { inputs: LevelInput[]; elements: Map<number, HTMLElement> } {
  const inputs: LevelInput[] = [];
  const elements = new Map<number, HTMLElement>();
  const daily = root.querySelector<HTMLElement>(`[${MINE_ATTR}="daily"]`);
  const pitOf = (element: Element) => {
    const pit = element.querySelector(`[${MINE_ATTR}-pit]`);
    return pit ? measureBox(pit, scale) : null;
  };
  if (daily) {
    inputs.push({
      box: measureBox(daily, scale),
      pit: pitOf(daily),
      stars: 3,
      isDaily: true,
      index: -1,
      id: -1,
    });
  }
  root.querySelectorAll<HTMLElement>(`[${MINE_ATTR}="level"]`).forEach((element, index) => {
    const id = Number(element.dataset.mapId);
    elements.set(id, element);
    inputs.push({
      box: measureBox(element, scale),
      pit: pitOf(element),
      stars: Number(element.dataset.stars ?? -1),
      isDaily: false,
      index,
      id,
    });
  });
  return { inputs, elements };
}

function readChapters(root: HTMLElement, scale: number): ChapterInput[] {
  return [...root.querySelectorAll<HTMLElement>(`[${MINE_ATTR}="chapter"]`)].map((element) => ({
    box: measureBox(element, scale),
    stratum: Number(element.dataset.stratum ?? 1),
  }));
}

export function startDeepScene(host: DeepHost): (() => void) | null {
  const plate = host.root.querySelector(`[${MINE_ATTR}="plate"]`);
  const front = host.root.querySelector(`[${MINE_ATTR}="front"]`);
  const viewWidth = viewportWidth();
  if (!plate || !front || viewWidth < MIN_WIDTH) return null;
  const isNarrow = viewWidth < NARROW_WIDTH;
  const scale = isNarrow ? 2 : 3;
  const { inputs, elements } = readLevels(host.root, scale);
  const frames = [host.canvas.parentElement, host.front?.parentElement ?? null];
  const docHeight = pageHeight();
  for (const frame of frames) if (frame) frame.style.height = `${docHeight}px`;
  const W = Math.ceil(viewWidth / scale);
  const H = Math.ceil(docHeight / scale) + 2;
  const mine = buildMine({
    W,
    H,
    isNarrow,
    plate: measureBox(plate, scale),
    front: measureBox(front, scale),
    levels: inputs,
    chapters: readChapters(host.root, scale),
    palette: readDeepPalette(host.paletteSource),
    digId: host.digId,
  });
  const view = createView(host.canvas, host.mid, host.front, mine.world, scale, window.innerHeight);
  const header = document.querySelector("header");
  const roofY = header
    ? Math.ceil((header.getBoundingClientRect().bottom + window.scrollY) / scale)
    : 0;
  if (!view) return null;
  const elementOf = (level: Level) => elements.get(level.id);
  const digging = mine.dig ? elementOf(mine.dig.level) : undefined;
  if (digging) host.onDigStart(digging);
  return runScene({
    mine,
    view,
    isNarrow,
    isStatic: host.isStatic,
    isFresh: host.isFresh,
    roofY,
    target: host.target,
    onDigDone: (level) => {
      const element = elementOf(level);
      if (element) host.onDigDone(element);
    },
  });
}
