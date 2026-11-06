import { useState } from "react";
import { Button } from "../components/ui/Button.tsx";
import { hu } from "../i18n/hu.ts";
import { initialTheme, nextTheme, saveTheme, type Theme } from "../lib/theme.ts";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const target = nextTheme(theme);
  const isToLight = target === "felszin";
  return (
    <Button
      variant="ghost"
      size="sm"
      icon={isToLight ? "sun" : "lantern"}
      aria-label={isToLight ? hu.nav.toLightLabel : hu.nav.toDarkLabel}
      onPress={() => {
        saveTheme(target);
        setTheme(target);
      }}
    >
      {isToLight ? hu.nav.toLight : hu.nav.toDark}
    </Button>
  );
}
