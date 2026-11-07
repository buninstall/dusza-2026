import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { Slider } from "../src/components/ui/Slider.tsx";
import { renderApp } from "./support/app.tsx";
import { CORRIDOR, mapSummary, respondMaps } from "./support/fixtures.ts";

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

describe("billentyűzettel aktivált link", () => {
  test("az Enter nem tölti újra az oldalt, a router navigál; módosítóbillentyűvel a böngészőé", async () => {
    respondMaps([mapSummary(1, "Folyosó", CORRIDOR)]);
    const { router } = renderApp("/maps");
    const link = await screen.findByRole("link", { name: "Ranglista: Folyosó" });
    link.focus();
    expect(fireEvent.keyDown(link, { key: "Enter", ctrlKey: true })).toBe(true);
    fireEvent.keyUp(link, { key: "Enter", ctrlKey: true });
    expect(fireEvent.keyDown(link, { key: "Enter" })).toBe(false);
    fireEvent.keyUp(link, { key: "Enter" });
    await waitFor(() => expect(router.state.location.pathname).toBe("/leaderboard/1"));
  });
});
