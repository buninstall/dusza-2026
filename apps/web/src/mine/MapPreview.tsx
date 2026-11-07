import { clsx } from "clsx";
import { type CSSProperties, useMemo } from "react";
import { SpriteLayers } from "../pixel/SpriteLayers.tsx";
import "./MapPreview.css";
import { fittedScale, PREVIEW_BOX, previewScale, previewSprite } from "./map-preview.ts";

export type PreviewBox = 64 | 84 | 120 | 176 | 224 | 288;

type MapPreviewProps = {
  content: string;
  box?: PreviewBox;
  className?: string;
  isFitted?: boolean;
};

export function MapPreview({
  content,
  box = PREVIEW_BOX,
  className,
  isFitted = false,
}: MapPreviewProps) {
  const sprite = useMemo(() => previewSprite(content), [content]);
  const frame = { "--box": `${box}px` } as CSSProperties;
  const size = {
    "--w": sprite.width,
    "--h": sprite.height,
    "--scale": `${isFitted ? fittedScale(sprite, box) : previewScale(sprite, box)}px`,
  } as CSSProperties;
  return (
    <span className={clsx("preview", className)} style={frame} aria-hidden="true">
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox={`0 0 ${sprite.width} ${sprite.height}`}
        shapeRendering="crispEdges"
        className="preview-art"
        style={size}
      >
        <SpriteLayers sprite={sprite} />
      </svg>
    </span>
  );
}
