import type { Sprite } from "./pixel-art.ts";
import "./pixel.css";
import { SpriteLayers } from "./SpriteLayers.tsx";
import { FRINGE_SIDES, SPRITE_ID, TILE_SIZE, TILE_SPRITES } from "./tiles.ts";

function SpriteSymbol({ id, sprite }: { id: string; sprite: Sprite }) {
  return (
    <symbol id={id} viewBox={`0 0 ${TILE_SIZE} ${TILE_SIZE}`}>
      <SpriteLayers sprite={sprite} animatedTone="glint" animatedClassName="px-glint" />
    </symbol>
  );
}

export function SpriteSheet() {
  return (
    <svg aria-hidden="true" focusable="false" className="px-sheet" shapeRendering="crispEdges">
      <defs>
        {TILE_SPRITES.floor.map((floor, variant) => (
          <SpriteSymbol
            key={SPRITE_ID.floor(variant)}
            id={SPRITE_ID.floor(variant)}
            sprite={floor}
          />
        ))}
        {TILE_SPRITES.wall.map((wall, variant) => (
          <SpriteSymbol key={SPRITE_ID.wall(variant)} id={SPRITE_ID.wall(variant)} sprite={wall} />
        ))}
        <SpriteSymbol id={SPRITE_ID.gold} sprite={TILE_SPRITES.gold} />
        <SpriteSymbol id={SPRITE_ID.dug} sprite={TILE_SPRITES.dug} />
        <SpriteSymbol id={SPRITE_ID.robot} sprite={TILE_SPRITES.robot} />
        <SpriteSymbol id={SPRITE_ID.shroud} sprite={TILE_SPRITES.shroud} />
        <SpriteSymbol id={SPRITE_ID.sparkle} sprite={TILE_SPRITES.sparkle} />
        {FRINGE_SIDES.map((side) => (
          <SpriteSymbol
            key={SPRITE_ID.fringe(side)}
            id={SPRITE_ID.fringe(side)}
            sprite={TILE_SPRITES.fringe[side]}
          />
        ))}
      </defs>
    </svg>
  );
}
