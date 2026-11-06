import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { LoadFailed } from "../src/components/LoadFailed.tsx";
import { ApiError } from "../src/lib/api.ts";

describe("betöltési hiba", () => {
  test("szerverzavarnál megnyugtat, és kézzel is újrapróbálható", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <LoadFailed
        error={new ApiError(503, "UNAVAILABLE", "x")}
        fallback="Nem sikerült."
        onRetry={onRetry}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("A szerver most nem válaszol.");
    expect(alert.textContent).toContain("magától újrapróbálom");
    await user.click(screen.getByRole("button", { name: "Újrapróbálás" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  test("más hibánál a szerver üzenetét mutatja", () => {
    render(
      <LoadFailed
        error={new ApiError(403, "FORBIDDEN", "Nincs jogod megnézni.")}
        fallback="Nem sikerült."
        onRetry={() => undefined}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain("Nincs jogod megnézni.");
    expect(screen.getByRole("alert").textContent).not.toContain("nem válaszol");
  });
});
