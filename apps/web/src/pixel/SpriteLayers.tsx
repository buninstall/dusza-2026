import { type Sprite, toneFill } from "./pixel-art.ts";

export type ToneClasses = Readonly<Partial<Record<string, string>>>;

type SpriteLayersProps = { sprite: Sprite; animated?: ToneClasses };

export function SpriteLayers({ sprite, animated }: SpriteLayersProps) {
  return sprite.layers.map((layer) => {
    const className = animated?.[layer.tone];
    return (
      <path
        key={layer.tone}
        d={layer.path}
        style={{ fill: toneFill(layer.tone) }}
        {...(className ? { className } : {})}
      />
    );
  });
}

type PixelSpriteProps = { sprite: Sprite; className?: string; animated?: ToneClasses };

export function PixelSprite({ sprite, className, animated }: PixelSpriteProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${sprite.width} ${sprite.height}`}
      shapeRendering="crispEdges"
      className={className}
    >
      <SpriteLayers sprite={sprite} {...(animated ? { animated } : {})} />
    </svg>
  );
}
