import { MINE_META } from "../../pixel/mine-art.ts";
import type { BoardShade } from "../MineBoard.tsx";
import type { View } from "./camera.ts";
import type { Burst } from "./emissive.ts";
import { type SceneLayout, T } from "./layout.ts";
import type { Baked, BlockRect, LightField, Solid } from "./light.ts";
import {
  BULB_COLOR,
  BURST_COLOR,
  FLOOD_COLOR,
  flicker,
  HALO_COLOR,
  isBulbOut,
  LAMP_COLOR,
  LANTERN_COLOR,
  PILOT_COLOR,
  type Preset,
  type SceneLighting,
} from "./presets.ts";

export type RobotLight = { x: number; y: number; angle: number };

export type BakedFixture = {
  kind: "lantern" | "floor" | "bulb" | "pilot" | "flood";
  data: Baked;
  seed: number;
  isFaulty: boolean;
};

export type RobotScene = {
  time: number;
  isStill: boolean;
  robot: RobotLight | null;
  shade: BoardShade | null;
  lighting: SceneLighting;
  bursts: readonly Burst[];
  contained: Solid;
  lamp: RobotLamp | null;
};

const HALF = T / 2;
const OPEN_REACH = 80;
const REACH_PAD = 0.9;
const REACH_GAIN = 1.25;

function degrees(value: string): number {
  const match = value.match(/(-?[\d.]+)deg/);
  return match ? Number(match[1]) : 0;
}

export function readRobot(
  host: HTMLElement,
  canvas: HTMLCanvasElement,
  view: View,
): RobotLight | null {
  const robot = host.querySelector<HTMLElement>(".board-robot");
  const heading = robot?.querySelector<HTMLElement>(".board-robot-heading");
  if (!robot || !heading) {
    return null;
  }
  const box = robot.getBoundingClientRect();
  const area = canvas.getBoundingClientRect();
  if (area.width === 0) {
    return null;
  }
  const px = area.width / view.width;
  const rotate = degrees(getComputedStyle(heading).rotate);
  return {
    x: Math.round(view.x + (box.left - area.left) / px + HALF),
    y: Math.round(view.y + (box.top - area.top) / px + HALF),
    angle: ((rotate - 90) * Math.PI) / 180,
  };
}

export function bakeFixtures(
  field: LightField,
  layout: SceneLayout,
  preset: Preset,
): BakedFixture[] {
  const out: BakedFixture[] = [];
  const glow = MINE_META.lantern.glow;
  layout.lanterns.forEach((lantern, index) => {
    out.push({
      kind: "lantern",
      seed: index * 3 + 1,
      isFaulty: false,
      data: field.bake({ x: lantern.x + glow.x, y: lantern.y + glow.y, r: 96, falloff: 1.45 }),
    });
  });
  out.push({
    kind: "floor",
    seed: 9,
    isFaulty: false,
    data: field.bake({
      x: layout.floorLamp.x + glow.x,
      y: layout.floorLamp.y + glow.y,
      r: 70,
      falloff: 1.3,
      shadow: false,
    }),
  });
  const bulb = MINE_META.bulb.glow;
  for (const spot of layout.bulbs) {
    out.push({
      kind: "bulb",
      seed: spot.x,
      isFaulty: spot.isFaulty,
      data: field.bake({
        x: spot.x - 3 + bulb.x,
        y: spot.y + bulb.y,
        r: 62,
        falloff: 1.5,
        shadow: false,
      }),
    });
  }
  out.push({
    kind: "pilot",
    seed: 4,
    isFaulty: false,
    data: field.bake({
      x: layout.pilot.x,
      y: layout.pilot.y + bulb.y,
      r: 44,
      falloff: 1.15,
      shadow: false,
    }),
  });
  if (preset.floods > 0) {
    const lens = MINE_META.flood.glow;
    const tx = layout.bx + layout.bw / 2;
    const ty = layout.by + layout.bh * 0.6;
    for (const flood of layout.floods) {
      const gx = flood.isFlipped ? flood.x + 18 - lens.x : flood.x + lens.x;
      const gy = flood.y + lens.y;
      const d = Math.hypot(tx - gx, ty - gy) || 1;
      out.push({
        kind: "flood",
        seed: 0,
        isFaulty: false,
        data: field.bake({
          x: gx,
          y: gy,
          r: Math.max(260, layout.bw + layout.bh),
          falloff: 1.05,
          shadow: false,
          cone: { dx: (tx - gx) / d, dy: (ty - gy) / d, half: 0.62, soft: 0.4 },
        }),
      });
    }
  }
  return out;
}

function fixtureIntensity(fixture: BakedFixture, preset: Preset, scene: RobotScene): number {
  const { time, isStill } = scene;
  switch (fixture.kind) {
    case "lantern":
      return flicker(time, fixture.seed, isStill) * preset.lanterns;
    case "floor":
      return flicker(time, fixture.seed, isStill) * preset.lanterns * 0.8;
    case "bulb":
      return isBulbOut(time, fixture.isFaulty, isStill) ? 0 : preset.bulbs;
    case "pilot":
      return preset.pilot * (isStill ? 1 : 0.92 + 0.08 * Math.sin(time * 3.1));
    case "flood":
      return preset.floods;
  }
}

const FIXTURE_COLOR = {
  lantern: LANTERN_COLOR,
  floor: LANTERN_COLOR,
  bulb: BULB_COLOR,
  pilot: PILOT_COLOR,
  flood: FLOOD_COLOR,
} as const;

function robotReach(scene: Pick<RobotScene, "lighting" | "shade">): number {
  if (scene.lighting === "open") {
    return OPEN_REACH;
  }
  const radius = scene.shade?.radius ?? 1;
  return radius > 0 ? (radius + REACH_PAD) * T * REACH_GAIN : 0;
}

export type WorldRect = { x0: number; y0: number; x1: number; y1: number };

const BURST_REACH = 42;
const HALO_REACH = 26;
const BOX_PAD = 9;

export function robotBox(
  robot: RobotLight | null,
  scene: Pick<RobotScene, "lighting" | "shade">,
): WorldRect | null {
  if (!robot || scene.lighting === "work") {
    return null;
  }
  const reach = Math.max(robotReach(scene), HALO_REACH) + BOX_PAD;
  return { x0: robot.x - reach, y0: robot.y - reach, x1: robot.x + reach, y1: robot.y + reach };
}

export function burstBox(layout: SceneLayout, burst: Burst): WorldRect {
  const x = layout.bx + burst.c * T + HALF;
  const y = layout.by + burst.r * T + HALF;
  const reach = BURST_REACH + BOX_PAD;
  return { x0: x - reach, y0: y - reach, x1: x + reach, y1: y + reach };
}

const FLICKER_SHARE = 0.72;

export function fixtureBox(fixture: BakedFixture): WorldRect {
  const { data } = fixture;
  const cx = (data.x0 + data.x1 + 1) * 1;
  const cy = (data.y0 + data.y1 + 1) * 1;
  const rx = (data.x1 - data.x0 + 1) * FLICKER_SHARE;
  const ry = (data.y1 - data.y0 + 1) * FLICKER_SHARE;
  return { x0: cx - rx, y0: cy - ry, x1: cx + rx, y1: cy + ry };
}

export function isFlickering(fixture: BakedFixture, preset: Preset): boolean {
  if (fixture.kind === "lantern" || fixture.kind === "floor") {
    return preset.lanterns > 0;
  }
  if (fixture.kind === "bulb") {
    return preset.bulbs > 0 && fixture.isFaulty;
  }
  return fixture.kind === "pilot" && preset.pilot > 0;
}

export function addRobotLights(
  field: LightField,
  layout: SceneLayout,
  baked: readonly BakedFixture[],
  preset: Preset,
  scene: RobotScene,
  clip?: BlockRect,
): void {
  for (const fixture of baked) {
    field.addBaked(
      fixture.data,
      FIXTURE_COLOR[fixture.kind],
      fixtureIntensity(fixture, preset, scene),
      clip,
    );
  }
  const contained = scene.contained;
  for (const burst of scene.bursts) {
    field.addDynamic(
      {
        x: layout.bx + burst.c * T + HALF,
        y: layout.by + burst.r * T + HALF,
        r: 42,
        i: 1.1 * Math.max(0, 1 - burst.t / 0.55),
        falloff: 1.4,
        color: BURST_COLOR,
        solid: contained,
      },
      0,
      clip,
    );
  }
  const lamp = scene.lamp;
  if (!lamp) {
    return;
  }
  if (lamp.cone) {
    field.addBaked(lamp.cone, LAMP_COLOR, lamp.coneI, clip);
    field.addHaze(lamp.cone, lamp.coneI * lamp.haze, clip);
  }
  field.addBaked(lamp.halo, HALO_COLOR, lamp.haloI, clip);
}

export type RobotLamp = {
  cone: Baked | null;
  halo: Baked;
  coneI: number;
  haloI: number;
  haze: number;
};

export function bakeRobotLamp(
  field: LightField,
  scene: Pick<RobotScene, "robot" | "lighting" | "shade" | "contained">,
): RobotLamp | null {
  const robot = scene.robot;
  if (!robot || scene.lighting === "work" || scene.shade?.isBroken) {
    return null;
  }
  const isDark = scene.lighting === "lamp" || scene.lighting === "dark";
  const dx = Math.cos(robot.angle);
  const dy = Math.sin(robot.angle);
  const reach = robotReach(scene);
  const cone =
    reach > 0
      ? field.bake({
          x: robot.x + dx * 5,
          y: robot.y + dy * 5,
          r: reach,
          falloff: 1.2,
          cone: { dx, dy, half: 0.5, soft: 0.42 },
          near: 9,
          solid: scene.contained,
        })
      : null;
  const halo = field.bake({
    x: robot.x,
    y: robot.y,
    r: reach > 0 ? 26 : 15,
    falloff: 1.7,
    solid: scene.contained,
  });
  return {
    cone,
    halo,
    coneI: isDark ? 1.3 : 0.75,
    haloI: reach > 0 ? 0.55 : 0.85,
    haze: isDark ? 1 : 0.35,
  };
}
