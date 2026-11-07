import type { Dir, MineMap, Pos, RobotState } from "@minescript/engine";
import type { CSSProperties, ReactNode } from "react";
import { hu } from "../../i18n/hu.ts";
import type { RobotBeam, RobotLook } from "../../mine/MineBoard.tsx";
import type { RobotMood } from "../../mine/RobotLayer.tsx";
import { Chips, placement, SpriteUse } from "../../mine/RobotLayer.tsx";
import { type FogMode, posKey } from "../../mine/tiles-model.ts";
import { SPRITE_ID } from "../../pixel/tiles.ts";
import type { Frame } from "../derive.ts";
import { aheadOf, type Fault } from "../fault.ts";
import type { StagePhase } from "../phase.ts";

const MAX_GLINTS = 20;
const GLINT_STAGGER_MS = 40;

const AHEAD_STYLE: Record<Dir, CSSProperties> = {
  north: { "--ahead-x": 0, "--ahead-y": -1 } as CSSProperties,
  east: { "--ahead-x": 1, "--ahead-y": 0 } as CSSProperties,
  south: { "--ahead-x": 0, "--ahead-y": 1 } as CSSProperties,
  west: { "--ahead-x": -1, "--ahead-y": 0 } as CSSProperties,
};

export type DressingInput = {
  map: MineMap;
  robot: RobotState;
  frame: Frame | null;
  fault: Fault | null;
  phase: StagePhase;
  fogMode: FogMode;
  runId: number;
  isAdvancing: boolean;
  isTurbo: boolean;
  segmentMs: number;
};

export type Dressing = {
  overlay: ReactNode;
  cellMarks: ReadonlyMap<string, string>;
  cellNotes: ReadonlyMap<string, string>;
  look: RobotLook;
};

function isInside(map: MineMap, pos: Pos): boolean {
  return pos.row >= 0 && pos.row < map.rows && pos.col >= 0 && pos.col < map.cols;
}

function Fx({
  kind,
  pos,
  style,
  children,
  isScan,
}: {
  kind: string;
  pos: Pos;
  style?: CSSProperties;
  children: ReactNode;
  isScan?: boolean;
}) {
  return (
    <div
      className="board-fx"
      data-fx={kind}
      data-scan={isScan ?? false}
      style={{ ...placement(pos), ...style }}
    >
      {children}
    </div>
  );
}

function headlamp(input: DressingInput): RobotBeam | null {
  const { map, robot, frame, fogMode, isAdvancing, isTurbo } = input;
  const front = aheadOf(robot.pos, robot.dir);
  if (fogMode !== "lamp" || !isInside(map, front)) {
    return null;
  }
  const isScan =
    isAdvancing && !isTurbo && frame?.scan !== null && frame?.scan !== undefined
      ? posKey(frame.scan) === posKey(front)
      : false;
  return { isScan, key: isScan ? `cone-${frame?.index ?? 0}` : "cone" };
}

function reveals(input: DressingInput): ReactNode[] {
  const { frame, isAdvancing, isTurbo, segmentMs } = input;
  if (!frame?.event || !isAdvancing || isTurbo) {
    return [];
  }
  const path = frame.event.path.map(posKey);
  const nodes = [...frame.fresh].map((key) => {
    const [row = 0, col = 0] = key.split(":").map(Number);
    const order = path.indexOf(key);
    const delay = { "--reveal-delay": `${Math.max(order, 0) * segmentMs}ms` } as CSSProperties;
    return (
      <Fx key={`reveal-${frame.index}-${key}`} kind="reveal" pos={{ row, col }} style={delay}>
        <span className="board-fx-art" />
      </Fx>
    );
  });
  if (frame.scan) {
    nodes.push(
      <Fx key={`frame-${frame.index}`} kind="scan-frame" pos={frame.scan}>
        <SpriteUse id={SPRITE_ID.scan} className="board-fx-art" />
      </Fx>,
    );
  }
  return nodes;
}

function faultNodes(input: DressingInput): ReactNode[] {
  const { fault, robot, runId } = input;
  if (!fault || fault.kind === "logic") {
    return fault ? [alertBadge(robot.pos, runId)] : [];
  }
  const badge = alertBadge(robot.pos, runId);
  if (fault.kind === "wall") {
    return [
      <Fx key="crack" kind="crack" pos={fault.pos}>
        <SpriteUse id={SPRITE_ID.crack} className="board-fx-art" />
      </Fx>,
      <Fx key={`impact-${runId}`} kind="impact" pos={robot.pos} style={AHEAD_STYLE[robot.dir]}>
        <SpriteUse id={SPRITE_ID.impact} className="board-fx-art" />
      </Fx>,
      <Fx key={`sparks-${runId}`} kind="sparks" pos={robot.pos} style={AHEAD_STYLE[robot.dir]}>
        <Chips tone="spark" />
      </Fx>,
      badge,
    ];
  }
  if (fault.kind === "edge") {
    return [
      <span
        key="edge"
        aria-hidden="true"
        className="board-edge"
        data-side={fault.side}
        style={placement(fault.pos)}
      />,
      badge,
    ];
  }
  return [
    <Fx key={`dust-${runId}`} kind="dust" pos={fault.pos}>
      <SpriteUse id={SPRITE_ID.dust} className="board-fx-art" />
    </Fx>,
    badge,
  ];
}

function alertBadge(pos: Pos, runId: number): ReactNode {
  return (
    <Fx key={`alert-${runId}`} kind="alert" pos={pos}>
      <SpriteUse id={SPRITE_ID.alert} className="board-fx-art" />
    </Fx>
  );
}

function glints(input: DressingInput): ReactNode[] {
  const { frame, phase, runId } = input;
  if (phase !== "finished" || !frame?.atEnd) {
    return [];
  }
  return [...frame.mined].slice(0, MAX_GLINTS).map((key, order) => {
    const [row = 0, col = 0] = key.split(":").map(Number);
    const delay = { "--glint-delay": `${order * GLINT_STAGGER_MS}ms` } as CSSProperties;
    return (
      <Fx key={`glint-${runId}-${key}`} kind="glint" pos={{ row, col }} style={delay}>
        <SpriteUse id={SPRITE_ID.burst(1)} className="board-fx-art" />
      </Fx>
    );
  });
}

function faultMarks(fault: Fault | null): {
  marks: ReadonlyMap<string, string>;
  notes: ReadonlyMap<string, string>;
} {
  if (!fault || fault.kind === "logic" || fault.kind === "edge") {
    const notes =
      fault?.kind === "edge" ? new Map([[posKey(fault.pos), hu.mine.faultNote]]) : new Map();
    return { marks: new Map(), notes };
  }
  const key = posKey(fault.pos);
  return { marks: new Map([[key, "fault"]]), notes: new Map([[key, hu.mine.faultNote]]) };
}

function robotLook(input: DressingInput, mood: RobotMood): RobotLook {
  const { frame, phase, runId, isAdvancing, isTurbo } = input;
  const event = frame?.event ?? null;
  const index = frame?.index ?? 0;
  const walkTiles = Math.max(event?.path.length ?? 1, 1);
  const isIdle =
    phase === "idle" || phase === "paused" || phase === "review" || phase === "finished";
  const base = { mood, walkTiles, isIdle };
  if (frame?.atEnd && phase === "finished") {
    return { ...base, motion: { kind: "settle", key: runId * 10_000 + index } };
  }
  if (frame?.atEnd && (phase === "error" || phase === "limit")) {
    const kind = input.fault?.kind === "wall" || input.fault?.kind === "edge" ? "bump" : "shake";
    return { ...base, motion: { kind, key: runId * 10_000 + index } };
  }
  if (!isAdvancing || isTurbo || !event) {
    return base;
  }
  if (event.mined) {
    return { ...base, motion: { kind: "mine", key: index } };
  }
  return event.path.length > 0 ? { ...base, motion: { kind: "walk", key: index } } : base;
}

function withBeam(look: RobotLook, beam: RobotBeam | null): RobotLook {
  return beam ? { ...look, beam } : look;
}

export function boardDressing(input: DressingInput, mood: RobotMood): Dressing {
  const showFault = input.frame?.atEnd ?? false;
  const fault = showFault ? input.fault : null;
  const dressed = { ...input, fault };
  const { marks, notes } = faultMarks(fault);
  const flash =
    showFault && (input.phase === "error" || input.phase === "limit") ? (
      <span key={`flash-${input.runId}`} aria-hidden="true" className="board-flash" />
    ) : null;
  return {
    overlay: (
      <>
        {reveals(dressed)}
        {glints(dressed)}
        {faultNodes(dressed)}
        {flash}
      </>
    ),
    cellMarks: marks,
    cellNotes: notes,
    look: withBeam(robotLook(dressed, mood), headlamp(dressed)),
  };
}
