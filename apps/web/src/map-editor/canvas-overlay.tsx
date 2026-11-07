import type { Dir, Pos } from "@minescript/engine";
import type { CSSProperties, ReactNode } from "react";
import { quarterIndex } from "../mine/quarter-turns.ts";
import { placement, SpriteUse } from "../mine/RobotLayer.tsx";
import { posKey } from "../mine/tiles-model.ts";
import { SPRITE_ID, TILE_SIZE } from "../pixel/tiles.ts";
import { type DraftMap, rectCells, type Tool } from "./editor-state.ts";
import type { RectDraft } from "./useCanvasTools.ts";

const GHOST_SPRITES: Record<Tool, readonly string[]> = {
  empty: [SPRITE_ID.floor(1)],
  gold: [SPRITE_ID.floor(1), SPRITE_ID.gold],
  wall: [SPRITE_ID.wall(0)],
  robot: [SPRITE_ID.robot],
};

type GhostSource = "cursor" | "hover" | "rect";

function Ghost({
  pos,
  tool,
  dir,
  source,
}: {
  pos: Pos;
  tool: Tool;
  dir: Dir;
  source: GhostSource;
}) {
  const turn = tool === "robot" ? ({ "--turns": quarterIndex(dir) } as CSSProperties) : {};
  return (
    <div
      className="board-fx ed-ghost"
      data-source={source}
      data-tool={tool}
      style={{ ...placement(pos), ...turn }}
    >
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${TILE_SIZE} ${TILE_SIZE}`}
        shapeRendering="crispEdges"
        className="board-fx-art"
      >
        {GHOST_SPRITES[tool].map((id) => (
          <use key={id} href={`#${id}`} />
        ))}
      </svg>
    </div>
  );
}

function RectFrame({ rect, tag }: { rect: RectDraft; tag: string }) {
  const top = Math.min(rect.anchor.row, rect.end.row);
  const left = Math.min(rect.anchor.col, rect.end.col);
  const rows = Math.abs(rect.anchor.row - rect.end.row) + 1;
  const cols = Math.abs(rect.anchor.col - rect.end.col) + 1;
  const style = {
    "--row": top,
    "--col": left,
    "--span-rows": rows,
    "--span-cols": cols,
  } as CSSProperties;
  return (
    <div className="ed-rect" style={style} aria-hidden="true">
      <span className="ed-rect-tag">{tag}</span>
    </div>
  );
}

export type OverlayInput = {
  draft: DraftMap;
  tool: Tool;
  cursor: Pos | null;
  hover: Pos | null;
  rect: RectDraft | null;
  rectTag: string;
  unreachable: readonly Pos[];
  shrouded: readonly Pos[];
  flash: { cells: readonly Pos[]; key: number } | null;
};

function ghostCells(input: OverlayInput): { pos: Pos; source: GhostSource }[] {
  if (input.rect) {
    return rectCells(input.rect.anchor, input.rect.end).map((pos) => ({ pos, source: "rect" }));
  }
  const ghosts: { pos: Pos; source: GhostSource }[] = [];
  if (input.hover) {
    ghosts.push({ pos: input.hover, source: "hover" });
  }
  if (input.cursor && (!input.hover || posKey(input.cursor) !== posKey(input.hover))) {
    ghosts.push({ pos: input.cursor, source: "cursor" });
  }
  return ghosts;
}

export function canvasOverlay(input: OverlayInput): ReactNode {
  const { draft, tool, flash } = input;
  return (
    <>
      {input.shrouded.map((pos) => (
        <div key={`shroud-${posKey(pos)}`} className="board-fx ed-shroud" style={placement(pos)}>
          <SpriteUse id={SPRITE_ID.shroud} className="board-fx-art" />
        </div>
      ))}
      {ghostCells(input).map(({ pos, source }) => (
        <Ghost key={`ghost-${posKey(pos)}`} pos={pos} tool={tool} dir={draft.dir} source={source} />
      ))}
      {input.rect ? <RectFrame rect={input.rect} tag={input.rectTag} /> : null}
      {input.unreachable.map((pos) => (
        <div
          key={`alert-${posKey(pos)}`}
          className="board-fx ed-unreachable"
          style={placement(pos)}
        >
          <SpriteUse id={SPRITE_ID.alert} className="board-fx-art" />
        </div>
      ))}
      {draft.rows > 1 ? <div className="ed-doomed" data-kind="row" aria-hidden="true" /> : null}
      {draft.cols > 1 ? <div className="ed-doomed" data-kind="col" aria-hidden="true" /> : null}
      {flash?.cells.map((pos) => (
        <div
          key={`flash-${flash.key}-${posKey(pos)}`}
          className="board-fx ed-flash"
          style={placement(pos)}
        />
      ))}
    </>
  );
}
