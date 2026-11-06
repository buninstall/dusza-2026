import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { CircleUser, Moon, Sun } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { SessionUser } from "../auth/session.ts";
import { hu } from "../i18n/hu.ts";
import { api, call } from "../lib/api.ts";
import { applyTheme, initialTheme, type Theme } from "../lib/theme.ts";
import { Button } from "./ui/Button.tsx";
import { Link } from "./ui/Link.tsx";
import { Menu, MenuItem } from "./ui/Menu.tsx";
import { toast } from "./ui/Toast.tsx";

const navLink =
  "rounded-[9px] px-3 py-2 text-sm font-semibold text-ink-muted no-underline outline-none data-[hovered]:bg-paper-sunken data-[hovered]:text-ink data-[focus-visible]:outline-3 data-[focus-visible]:outline-lamp aria-[current=page]:bg-paper-raised aria-[current=page]:text-ink aria-[current=page]:shadow-plate";

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => initialTheme());
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={next === "dark" ? hu.nav.themeDark : hu.nav.themeLight}
      onPress={() => {
        applyTheme(next);
        setTheme(next);
      }}
    >
      {theme === "dark" ? <Sun aria-hidden size={18} /> : <Moon aria-hidden size={18} />}
    </Button>
  );
}

export function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const logout = async () => {
    try {
      await call(api.auth.logout.$post());
    } catch {
      toast.error(hu.app.unexpected);
    }
    queryClient.clear();
    await navigate({ to: "/login" });
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-[90rem] flex-col px-4 sm:px-6">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 py-4">
        <Link to="/maps" variant="plain" className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="grid size-9 place-items-center rounded-[10px] bg-ink text-ore shadow-plate"
          >
            <svg viewBox="0 0 32 32" className="size-6" fill="currentColor" aria-hidden>
              <path d="M6 24 16 6l10 18z" />
            </svg>
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-lg font-extrabold tracking-tight">{hu.app.name}</span>
            <span className="eyebrow mt-1 hidden sm:block">{hu.app.tagline}</span>
          </span>
        </Link>
        <nav
          aria-label={hu.nav.label}
          className="order-3 flex w-full gap-1 sm:order-none sm:w-auto"
        >
          <Link to="/maps" variant="plain" className={navLink} activeOptions={{ exact: true }}>
            {hu.nav.maps}
          </Link>
          <Link to="/maps/new" variant="plain" className={navLink}>
            {hu.nav.newMap}
          </Link>
          {user.role === "admin" ? (
            <Link to="/admin" variant="plain" className={navLink}>
              {hu.nav.admin}
            </Link>
          ) : null}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <Menu
            ariaLabel={hu.nav.userMenu}
            label={
              <>
                <CircleUser aria-hidden size={18} />
                <span className="font-mono text-sm">{user.username}</span>
              </>
            }
          >
            <MenuItem isDisabled textValue={hu.nav.signedInAs(user.username)}>
              {hu.nav.signedInAs(user.username)}
            </MenuItem>
            <MenuItem onAction={() => void logout()}>{hu.nav.logout}</MenuItem>
          </Menu>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="flex-1 pb-12 outline-none">
        {children}
      </main>
    </div>
  );
}
