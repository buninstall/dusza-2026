import { ICON_GRID, type IconName, iconPath } from "./icons.ts";
import "./pixel.css";

type PixelIconProps = { name: IconName; size?: "sm" | "md" | "lg" };

export function PixelIcon({ name, size = "md" }: PixelIconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${ICON_GRID} ${ICON_GRID}`}
      shapeRendering="crispEdges"
      className="px-icon"
      data-size={size}
    >
      <path d={iconPath(name)} fill="currentColor" />
    </svg>
  );
}
