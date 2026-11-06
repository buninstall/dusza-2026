import { clsx } from "clsx";
import { type CSSProperties, useMemo } from "react";
import { SpriteLayers } from "../pixel/SpriteLayers.tsx";
import "./MapPreview.css";
import { previewScale, previewSprite } from "./map-preview.ts";

type MapPreviewProps = { content: string; className?: string };

export function MapPreview({ content, className }: MapPreviewProps) {
  const sprite = useMemo(() => previewSprite(content), [content]);
  const size = {
    "--w": sprite.width,
    "--h": sprite.height,
    "--scale": `${previewScale(sprite)}px`,
  } as CSSProperties;
  return (
    <span className={clsx("preview", className)} aria-hidden="true">
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
