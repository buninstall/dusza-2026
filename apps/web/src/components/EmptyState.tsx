import type { ReactNode } from "react";
import { PixelSprite } from "../pixel/SpriteLayers.tsx";
import { TILE_SPRITES } from "../pixel/tiles.ts";
import "./EmptyState.css";

type EmptyStateProps = { art?: "robot" | "gold"; text: ReactNode; action?: ReactNode };

const ROBOT_IDLE = { lamp: "px-lamp-idle", visor: "px-lamp-idle" } as const;

export function EmptyState({ art = "robot", text, action }: EmptyStateProps) {
  return (
    <div className="empty">
      <PixelSprite
        sprite={art === "robot" ? TILE_SPRITES.robot : TILE_SPRITES.gold}
        className="empty-art"
        {...(art === "robot" ? { animated: ROBOT_IDLE } : {})}
      />
      <p className="empty-text">{text}</p>
      {action}
    </div>
  );
}
