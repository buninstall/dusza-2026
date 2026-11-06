import type { Dir, RobotState } from "@minescript/engine";
import { dirNames, hu } from "../../i18n/hu.ts";
import { pixelPath } from "../../pixel/pixel-art.ts";

const ROSE = ["..n..", "..n..", "wwcee", "..s..", "..s.."];

const ARMS: readonly { dir: Dir; symbol: string }[] = [
  { dir: "north", symbol: "n" },
  { dir: "east", symbol: "e" },
  { dir: "south", symbol: "s" },
  { dir: "west", symbol: "w" },
];

const CENTER = pixelPath(ROSE, "c");
const ARM_PATHS = ARMS.map((arm) => ({ ...arm, path: pixelPath(ROSE, arm.symbol) }));

export function Compass({ robot }: { robot: RobotState }) {
  return (
    <div className="hud-gauge hud-compass">
      <svg aria-hidden="true" viewBox="0 0 5 5" shapeRendering="crispEdges" className="hud-rose">
        <path d={CENTER} className="hud-rose-center" />
        {ARM_PATHS.map((arm) => (
          <path key={arm.dir} d={arm.path} data-lit={arm.dir === robot.dir} />
        ))}
      </svg>
      <span className="hud-compass-text">
        <span className="label">{hu.play.position}</span>{" "}
        <span className="hud-place">
          {hu.play.positionValue(robot.pos.row + 1, robot.pos.col + 1)}
        </span>{" "}
        <span className="hud-dir">{dirNames[robot.dir]}</span>
      </span>
    </div>
  );
}
