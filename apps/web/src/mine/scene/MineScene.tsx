import { type ComponentProps, useLayoutEffect, useRef, useState } from "react";
import { MineBoard } from "../MineBoard.tsx";
import { posKey } from "../tiles-model.ts";
import {
  anchorCenter,
  fitScale,
  frameCenter,
  placeView,
  restingScale,
  type View,
  type Viewport,
  viewCenter,
  zoomScale,
} from "./camera.ts";
import { createSceneEngine, type SceneEngine } from "./engine.ts";
import { type Box, type Point, type SceneLayout, SILL_H, T } from "./layout.ts";
import type { SceneLighting } from "./presets.ts";
import { type PanButton, useSceneInput } from "./useSceneInput.ts";
import "./MineScene.css";

export type { PanButton, SceneLighting };

export type MineSceneProps = Omit<ComponentProps<typeof MineBoard>, "fit" | "size"> & {
  lighting: SceneLighting;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  panButton?: PanButton;
  isWheelZoom?: boolean;
  reserve?: number;
};

const CART_MOUTH = { x: 4, y: 0, w: 18, h: 6 };

function fitBox(layout: SceneLayout): Box {
  return { ...layout.frame, y0: layout.beamY - 2, y1: layout.sillY + SILL_H };
}

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
  panButton = "primary",
  isWheelZoom = true,
  reserve = 0,
  ...board
}: MineSceneProps) {
  const { map, robot, exploration, shade = null, rulerMarks } = board;
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const cartRef = useRef<HTMLSpanElement>(null);
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
    const resting = frameCenter(fitBox(layout));
    const center = centerRef.current ?? {
      x: resting.x,
      y: resting.y + (viewport.height * reserve) / scale / 2,
    };
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
    const cart = cartRef.current;
    if (cart) {
      cart.style.left = `${snap((layout.cart.x + CART_MOUTH.x - view.x - view.fx) * scale) - shiftX}px`;
      cart.style.top = `${snap((layout.cart.y + CART_MOUTH.y - view.y - view.fy) * scale) - shiftY}px`;
      cart.style.width = `${snap(CART_MOUTH.w * scale)}px`;
      cart.style.height = `${snap(CART_MOUTH.h * scale)}px`;
    }
    engineRef.current?.setView(view);
  };

  const scaleNow = () => {
    const layout = layoutOf();
    const quantum = pixelQuantum();
    const room = { width: viewport.width, height: viewport.height * (1 - reserve) };
    if (!layout) {
      return 1;
    }
    const fit = fitScale(fitBox(layout), room, quantum);
    const resting = restingScale(fit, Math.max(map.cols, map.rows), quantum);
    return zoomScale(resting, zoom, quantum);
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
        (fitBox(layout).x1 - fitBox(layout).x0) * scale <= viewport.width &&
        (fitBox(layout).y1 - fitBox(layout).y0) * scale <= viewport.height * (1 - reserve);
      if (fits) {
        centerRef.current = null;
      }
    }
    apply(scale);
  });

  const pendingZoom = useRef<number | null>(null);
  pendingZoom.current = null;

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
      const nextZoom = (pendingZoom.current ?? zoom) * factor;
      pendingZoom.current = nextZoom;
      onZoomChange(nextZoom);
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
      <span ref={cartRef} className="mine-scene-cart" data-scene-cart aria-hidden="true" />
      <div ref={boardRef} className="mine-scene-board">
        <MineBoard {...board} shade={null} size="scene" fit="both" />
      </div>
    </div>
  );
}
