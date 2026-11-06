import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { Slider } from "../src/components/ui/Slider.tsx";

describe("csúszka", () => {
  test("a képernyőolvasó a mértékegységes értéket kapja, frissítéskor is", () => {
    const format = (value: number) => `${value} sor/s`;
    const { rerender } = render(
      <Slider label="Sebesség" minValue={1} maxValue={30} value={4} format={format} />,
    );
    const slider = screen.getByRole("slider", { name: "Sebesség" });
    expect(slider.getAttribute("aria-valuetext")).toBe("4 sor/s");
    expect(screen.getByText("4 sor/s").tagName).toBe("OUTPUT");
    rerender(<Slider label="Sebesség" minValue={1} maxValue={30} value={30} format={format} />);
    expect(slider.getAttribute("aria-valuetext")).toBe("30 sor/s");
  });
});
