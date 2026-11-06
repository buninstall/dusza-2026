import { clsx } from "clsx";
import { GLYPH_HEIGHT, signArt } from "./aknajel.ts";
import "./pixel.css";

export type SignScale = 2 | 3 | 4 | 6 | 10;

type PixelTextProps = { text: string; scale: SignScale; className?: string };

export function PixelText({ text, scale, className }: PixelTextProps) {
  const art = signArt(text);
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${art.width} ${GLYPH_HEIGHT}`}
      width={art.width * scale}
      height={GLYPH_HEIGHT * scale}
      shapeRendering="crispEdges"
      className={clsx("px-text", className)}
    >
      <path d={art.path} fill="currentColor" />
    </svg>
  );
}

type SignProps = { text: string; scale: SignScale; className?: string };

export function Sign({ text, scale, className }: SignProps) {
  return (
    <span className={clsx("px-sign", className)}>
      <PixelText text={text} scale={scale} />
      <span className="visually-hidden">{text}</span>
    </span>
  );
}
