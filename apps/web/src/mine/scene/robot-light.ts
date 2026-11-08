import { MINE_META } from "../../pixel/mine-art.ts";
import type { BoardShade } from "../MineBoard.tsx";
import type { View } from "./camera.ts";
import type { Burst } from "./emissive.ts";
import { type SceneLayout, T } from "./layout.ts";
import type { Baked, LightField, Solid } from "./light.ts";
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
      r: 76,
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

function robotReach(scene: RobotScene): number {
  if (scene.lighting === "open") {
    return OPEN_REACH;
  }
  const radius = scene.shade?.radius ?? 1;
  return radius > 0 ? (radius + REACH_PAD) * T * REACH_GAIN : 0;
}

export function addRobotLights(
  field: LightField,
  layout: SceneLayout,
  baked: readonly BakedFixture[],
  preset: Preset,
  scene: RobotScene,
): void {
  for (const fixture of baked) {
    field.addBaked(
      fixture.data,
      FIXTURE_COLOR[fixture.kind],
      fixtureIntensity(fixture, preset, scene),
    );
  }
  const contained = scene.contained;
  const isDark = scene.lighting === "lamp" || scene.lighting === "dark";
  for (const burst of scene.bursts) {
    field.addDynamic({
      x: layout.bx + burst.c * T + HALF,
      y: layout.by + burst.r * T + HALF,
      r: 42,
      i: 1.1 * Math.max(0, 1 - burst.t / 0.55),
      falloff: 1.4,
      color: BURST_COLOR,
      solid: contained,
    });
  }
  const robot = scene.robot;
  if (!robot || scene.lighting === "work" || scene.shade?.isBroken) {
    return;
  }
  const dx = Math.cos(robot.angle);
  const dy = Math.sin(robot.angle);
  const reach = robotReach(scene);
  if (reach > 0) {
    field.addDynamic(
      {
        x: robot.x + dx * 5,
        y: robot.y + dy * 5,
        r: reach,
        i: isDark ? 1.3 : 0.75,
        falloff: 1.2,
        color: LAMP_COLOR,
        cone: { dx, dy, half: 0.5, soft: 0.42 },
        near: 9,
        solid: contained,
      },
      isDark ? 1 : 0.35,
    );
  }
  field.addDynamic({
    x: robot.x,
    y: robot.y,
    r: reach > 0 ? 26 : 15,
    i: reach > 0 ? 0.55 : 0.85,
    falloff: 1.7,
    color: HALO_COLOR,
    solid: contained,
  });
}
