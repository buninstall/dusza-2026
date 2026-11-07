import { render } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { GoldFlight } from "../src/play/GoldFlight.tsx";

function rect(left: number, top: number, size: number): DOMRect {
  return {
    left,
    top,
    width: size,
    height: size,
    right: left + size,
    bottom: top + size,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}

function scene(cellSize: number) {
  const root = document.createElement("div");
  root.innerHTML =
    '<span data-row="0" data-col="1"></span><div data-gold-target><span class="hud-cart-art"></span></div>';
  document.body.append(root);
  const cell = root.querySelector("[data-row]") as HTMLElement;
  const cart = root.querySelector(".hud-cart-art") as HTMLElement;
  cell.getBoundingClientRect = () => rect(100, 50, cellSize);
  cart.getBoundingClientRect = () => rect(10, 10, 48);
  const ref = createRef<HTMLElement>();
  Object.assign(ref, { current: root });
  return ref;
}

const originalAnimate = HTMLElement.prototype.animate;

afterEach(() => {
  HTMLElement.prototype.animate = originalAnimate;
  document.body.replaceChildren();
});

describe("aranyrög röppályája", () => {
  test("a bányászott mezőről ívben, felpattanva a csille felé repül", () => {
    const cancel = vi.fn();
    const animate = vi.fn(() => ({ finished: Promise.resolve(), cancel }));
    HTMLElement.prototype.animate = animate as unknown as HTMLElement["animate"];
    const rootRef = scene(64);
    const { rerender, unmount } = render(
      <GoldFlight flight={{ key: "1:1", from: { row: 0, col: 1 } }} rootRef={rootRef} />,
    );
    const [frames, options] = (animate.mock.calls[0] ?? []) as unknown as [
      Keyframe[],
      KeyframeAnimationOptions,
    ];
    expect(options).toEqual({ duration: 1300 });
    expect(frames).toHaveLength(5);
    expect(String(frames[0]?.transform)).toContain("translate(116px, 66px)");
    expect(String(frames[1]?.transform)).toContain("translate(116px, 44px)");
    expect(String(frames[3]?.transform)).toContain("translate(18px, 18px)");
    expect(frames[4]?.opacity).toBe(0);
    rerender(<GoldFlight flight={null} rootRef={rootRef} />);
    expect(cancel).toHaveBeenCalledOnce();
    unmount();
  });

  test("ha a csille ki van görgetve vagy le van vágva, nem repül sehová", () => {
    const animate = vi.fn(() => ({ finished: Promise.resolve(), cancel: vi.fn() }));
    HTMLElement.prototype.animate = animate as unknown as HTMLElement["animate"];
    const rootRef = scene(64);
    const cart = rootRef.current?.querySelector(".hud-cart-art") as HTMLElement;
    cart.getBoundingClientRect = () => rect(10, -200, 48);
    render(<GoldFlight flight={{ key: "1:9", from: { row: 0, col: 1 } }} rootRef={rootRef} />);
    expect(animate).not.toHaveBeenCalled();
  });

  test("a levágó görgetődoboz látható részéből indul", () => {
    const animate = vi.fn(() => ({ finished: Promise.resolve(), cancel: vi.fn() }));
    HTMLElement.prototype.animate = animate as unknown as HTMLElement["animate"];
    const rootRef = scene(64);
    const root = rootRef.current as HTMLElement;
    root.style.overflow = "hidden";
    root.getBoundingClientRect = () => rect(0, 0, 120);
    render(<GoldFlight flight={{ key: "1:8", from: { row: 0, col: 1 } }} rootRef={rootRef} />);
    const [frames] = (animate.mock.calls[0] ?? []) as unknown as [Keyframe[]];
    expect(String(frames[0]?.transform)).toContain("translate(94px, 66px)");
  });

  test("más állapot miatti újrarajzolás nem indítja újra ugyanazt a röppályát", () => {
    const animate = vi.fn(() => ({ finished: Promise.resolve(), cancel: vi.fn() }));
    HTMLElement.prototype.animate = animate as unknown as HTMLElement["animate"];
    const rootRef = scene(64);
    const { rerender } = render(
      <GoldFlight flight={{ key: "1:3", from: { row: 0, col: 1 } }} rootRef={rootRef} />,
    );
    rerender(<GoldFlight flight={{ key: "1:3", from: { row: 0, col: 1 } }} rootRef={rootRef} />);
    rerender(<GoldFlight flight={{ key: "1:3", from: { row: 0, col: 1 } }} rootRef={rootRef} />);
    expect(animate).toHaveBeenCalledOnce();
    rerender(<GoldFlight flight={{ key: "2:3", from: { row: 0, col: 1 } }} rootRef={rootRef} />);
    expect(animate).toHaveBeenCalledTimes(2);
  });

  test("láthatatlan mezőnél nem indul", () => {
    const animate = vi.fn();
    HTMLElement.prototype.animate = animate as unknown as HTMLElement["animate"];
    const rootRef = scene(0);
    render(<GoldFlight flight={{ key: "1:2", from: { row: 0, col: 1 } }} rootRef={rootRef} />);
    expect(animate).not.toHaveBeenCalled();
  });
});
