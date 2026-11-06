import { SPRITE_ID, TILE_SIZE, TILE_SPRITES, tileVariant } from "../pixel/tiles.ts";
import "./MineBoard.css";
import type { TileView } from "./tiles-model.ts";

function spriteHref(id: string): string {
  return `#${id}`;
}

function baseSprite(view: TileView): string {
  const { row, col } = view.pos;
  return view.kind === "wall"
    ? SPRITE_ID.wall(tileVariant(row, col, TILE_SPRITES.wall.length))
    : SPRITE_ID.floor(tileVariant(row, col, TILE_SPRITES.floor.length));
}

function DarkTile({ view }: { view: TileView }) {
  return (
    <>
      <rect width={TILE_SIZE} height={TILE_SIZE} className="board-void" />
      {view.fringe.map((side) => (
        <use key={side} href={spriteHref(SPRITE_ID.fringe(side))} />
      ))}
    </>
  );
}

function LitTile({ view }: { view: TileView }) {
  return (
    <>
      <use href={spriteHref(baseSprite(view))} />
      {view.kind === "gold" ? <use href={spriteHref(SPRITE_ID.gold)} /> : null}
      {view.kind === "mined" ? <use href={spriteHref(SPRITE_ID.dug)} /> : null}
      {view.lighting === "shrouded" ? <use href={spriteHref(SPRITE_ID.shroud)} /> : null}
    </>
  );
}

export function TileArt({ view }: { view: TileView }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${TILE_SIZE} ${TILE_SIZE}`}
      shapeRendering="crispEdges"
      className="board-tile-art"
    >
      {view.lighting === "dark" ? <DarkTile view={view} /> : <LitTile view={view} />}
    </svg>
  );
}
