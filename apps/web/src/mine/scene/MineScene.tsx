import type { Pos } from "@minescript/engine";
import { type ComponentProps, useEffect, useLayoutEffect, useRef, useState } from "react";
import { MineBoard } from "../MineBoard.tsx";
import { posKey } from "../tiles-model.ts";
import {
  anchorCenter,
  fitScale,
  followCenter,
  frameCenter,
  placeView,
  type View,
  type Viewport,
  viewCenter,
  zoomScale,
} from "./camera.ts";
import { createSceneEngine, type SceneEngine } from "./engine.ts";
import { type Point, T } from "./layout.ts";
import type { SceneLighting } from "./presets.ts";
import { type PanButton, useSceneInput } from "./useSceneInput.ts";
import "./MineScene.css";

export type { PanButton, SceneLighting };

export type MineSceneProps = Omit<ComponentProps<typeof MineBoard>, "fit" | "size"> & {
  lighting: SceneLighting;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  follow?: Pos | null;
  panButton?: PanButton;
  isWheelZoom?: boolean;
};

const FOLLOW_MARGIN = 2 * T;

function deviceRatio(): number {
  const ratio = window.devicePixelRatio || 1;
  return ratio > 0 ? ratio : 1;
}

function pixelQuantum(): number {
  return 1 / deviceRatio();
}

function snap(value: number): number {
  const ratio = deviceRatio();
  return Math.round(value * ratio) / ratio;
}

type Anchor = { world: Point; clientX: number; clientY: number };

export function MineScene({
  lighting,
  zoom,
  onZoomChange,
  follow = null,
  panButton = "primary",
  isWheelZoom = true,
  ...board
}: MineSceneProps) {
  const { map, robot, exploration, shade = null, rulerMarks } = board;
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SceneEngine | null>(null);
  const centerRef = useRef<Point | null>(null);
  const viewRef = useRef<View | null>(null);
  const anchorRef = useRef<Anchor | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ width: 0, height: 0 });
  const [isPanning, setPanning] = useState(false);

  const layoutOf = () => engineRef.current?.layoutFor(map.cols, map.rows) ?? null;

  const apply = (scale: number) => {
    const layout = layoutOf();
    const canvas = canvasRef.current;
    const holder = boardRef.current;
    if (!layout || !canvas || !holder || viewport.width === 0) {
      return;
    }
    const center = centerRef.current ?? frameCenter(layout.frame);
    const view = placeView(center, viewport, scale, { width: layout.W, height: layout.H });
    centerRef.current = viewCenter(view);
    viewRef.current = view;
    const origin = rootRef.current?.getBoundingClientRect();
    const shiftX = origin ? origin.left - snap(origin.left) : 0;
    const shiftY = origin ? origin.top - snap(origin.top) : 0;
    canvas.style.width = `${snap(view.width * scale)}px`;
    canvas.style.height = `${snap(view.height * scale)}px`;
    canvas.style.left = `${snap(-view.fx * scale) - shiftX}px`;
    canvas.style.top = `${snap(-view.fy * scale) - shiftY}px`;
    holder.style.left = `${snap((layout.bx - view.x - view.fx) * scale) - shiftX}px`;
    holder.style.top = `${snap((layout.by - view.y - view.fy) * scale) - shiftY}px`;
    holder.style.setProperty("--scene-tile", `${snap(T * scale)}px`);
    engineRef.current?.setView(view);
  };

  const scaleNow = () => {
    const layout = layoutOf();
    const quantum = pixelQuantum();
    return layout ? zoomScale(fitScale(layout.frame, viewport, quantum), zoom, quantum) : 1;
  };

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) {
      return;
    }
    const engine = createSceneEngine(canvas, root);
    engineRef.current = engine;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry?.contentRect;
      if (box) {
        setViewport({ width: Math.floor(box.width), height: Math.floor(box.height) });
      }
    });
    observer.observe(root);
    return () => {
      observer.disconnect();
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    engineRef.current?.setInput({
      map,
      exploration: exploration ?? null,
      shade,
      lighting,
      flags: rulerMarks,
      robotKey: robot ? posKey(robot.pos) : null,
    });
  }, [map, exploration, shade, lighting, rulerMarks, robot]);

  const previousScale = useRef(0);
  const dims = useRef("");
  useLayoutEffect(() => {
    const size = `${map.cols}x${map.rows}`;
    if (dims.current !== size) {
      dims.current = size;
      centerRef.current = null;
    }
    const scale = scaleNow();
    const anchor = anchorRef.current;
    const before = previousScale.current;
    if (anchor && centerRef.current && before > 0 && before !== scale) {
      centerRef.current = anchorCenter(centerRef.current, anchor.world, before, scale);
    }
    anchorRef.current = null;
    previousScale.current = scale;
    const layout = layoutOf();
    if (zoom <= 1 && layout) {
      const fits =
        (layout.frame.x1 - layout.frame.x0) * scale <= viewport.width &&
        (layout.frame.y1 - layout.frame.y0) * scale <= viewport.height;
      if (fits) {
        centerRef.current = null;
      }
    }
    apply(scale);
  });

  useEffect(() => {
    const view = viewRef.current;
    const center = centerRef.current;
    if (!follow || !view || !center || zoom <= 1 || isPanning) {
      return;
    }
    const layout = layoutOf();
    if (!layout) {
      return;
    }
    const x0 = layout.bx + follow.col * T;
    const y0 = layout.by + follow.row * T;
    const next = followCenter(center, view, { x0, y0, x1: x0 + T, y1: y0 + T }, FOLLOW_MARGIN);
    if (next.x !== center.x || next.y !== center.y) {
      centerRef.current = next;
      apply(view.scale);
    }
  });

  useSceneInput(rootRef, panButton, {
    isWheelZoom: () => isWheelZoom,
    canPan: () => {
      const layout = layoutOf();
      const view = viewRef.current;
      if (!layout || !view) {
        return false;
      }
      return (
        zoom > 1 ||
        view.width < layout.frame.x1 - layout.frame.x0 ||
        view.height < layout.frame.y1 - layout.frame.y0
      );
    },
    panBy: (dx, dy) => {
      const view = viewRef.current;
      const center = centerRef.current;
      if (!view || !center) {
        return;
      }
      centerRef.current = { x: center.x - dx / view.scale, y: center.y - dy / view.scale };
      apply(view.scale);
    },
    zoomAt: (factor, clientX, clientY) => {
      const view = viewRef.current;
      const root = rootRef.current;
      if (!view || !root) {
        return;
      }
      const rect = root.getBoundingClientRect();
      anchorRef.current = {
        world: {
          x: view.x + view.fx + (clientX - rect.left) / view.scale,
          y: view.y + view.fy + (clientY - rect.top) / view.scale,
        },
        clientX,
        clientY,
      };
      onZoomChange(zoom * factor);
    },
    onPanning: setPanning,
  });

  return (
    <div
      ref={rootRef}
      className="mine-scene"
      data-theme="tarna"
      data-lighting={lighting}
      data-pan={panButton}
      data-panning={isPanning}
      data-zoomed={zoom > 1}
    >
      <div className="mine-scene-backdrop" aria-hidden="true">
        <canvas ref={canvasRef} className="mine-scene-canvas" />
      </div>
      <div ref={boardRef} className="mine-scene-board">
        <MineBoard {...board} shade={null} size="scene" fit="both" />
      </div>
    </div>
  );
}
