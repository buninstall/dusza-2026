import type { Sprite } from "./pixel-art.ts";
import "./pixel.css";
import { SpriteLayers } from "./SpriteLayers.tsx";
import { FRINGE_SIDES, SPRITE_ID, TILE_SIZE, TILE_SPRITES } from "./tiles.ts";

const GLINT = { glint: "px-glint" } as const;

function SpriteSymbol({ id, sprite }: { id: string; sprite: Sprite }) {
  return (
    <symbol id={id} viewBox={`0 0 ${TILE_SIZE} ${TILE_SIZE}`}>
      <SpriteLayers sprite={sprite} animated={GLINT} />
    </symbol>
  );
}

const SINGLES: readonly (readonly [string, Sprite])[] = [
  [SPRITE_ID.gold, TILE_SPRITES.gold],
  [SPRITE_ID.dug, TILE_SPRITES.dug],
  [SPRITE_ID.robot, TILE_SPRITES.robot],
  [SPRITE_ID.shroud, TILE_SPRITES.shroud],
  [SPRITE_ID.cone, TILE_SPRITES.cone],
  [SPRITE_ID.scan, TILE_SPRITES.scan],
  [SPRITE_ID.crack, TILE_SPRITES.crack],
  [SPRITE_ID.impact, TILE_SPRITES.impact],
  [SPRITE_ID.dust, TILE_SPRITES.dust],
  [SPRITE_ID.alert, TILE_SPRITES.alert],
];

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
        {SINGLES.map(([id, sprite]) => (
          <SpriteSymbol key={id} id={id} sprite={sprite} />
        ))}
        {TILE_SPRITES.burst.map((frame, index) => (
          <SpriteSymbol key={SPRITE_ID.burst(index)} id={SPRITE_ID.burst(index)} sprite={frame} />
        ))}
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
