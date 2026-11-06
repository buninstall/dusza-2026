import { type Sprite, toneFill } from "./pixel-art.ts";

type SpriteLayersProps = { sprite: Sprite; animatedTone?: string; animatedClassName?: string };

export function SpriteLayers({ sprite, animatedTone, animatedClassName }: SpriteLayersProps) {
  return sprite.layers.map((layer) => (
    <path
      key={layer.tone}
      d={layer.path}
      style={{ fill: toneFill(layer.tone) }}
      {...(layer.tone === animatedTone && animatedClassName
        ? { className: animatedClassName }
        : {})}
    />
  ));
}

type PixelSpriteProps = { sprite: Sprite; className?: string };

export function PixelSprite({ sprite, className }: PixelSpriteProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${sprite.width} ${sprite.height}`}
      shapeRendering="crispEdges"
      className={className}
    >
      <SpriteLayers sprite={sprite} />
    </svg>
  );
}
