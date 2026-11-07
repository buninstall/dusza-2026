import { useMatches, useRouterState } from "@tanstack/react-router";
import { createContext, type ReactNode, useContext } from "react";
import type { SessionUser } from "../auth/session.ts";
import { Link } from "../components/ui/Link.tsx";
import { hu } from "../i18n/hu.ts";
import { HazardStripe } from "../pixel/HazardStripe.tsx";
import type { IconName } from "../pixel/icons.ts";
import { Logo } from "../pixel/Logo.tsx";
import "./AppShell.css";
import { SoundToggle, useAudioUnlock } from "../sound/SoundToggle.tsx";
import { HeaderSky } from "./HeaderSky.tsx";
import { PageBackdrop } from "./PageBackdrop.tsx";
import { ThemeToggle } from "./ThemeToggle.tsx";
import { UserMenu } from "./UserMenu.tsx";

export type ShellLayout = "page" | "cab" | "workbench";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    layout?: ShellLayout;
  }
}

type NavTarget = "/maps" | "/maps/new" | "/runs" | "/manual" | "/admin";

type NavItem = { to: NavTarget; label: string; icon: IconName; section: RegExp };

const ShellContext = createContext(false);

export function useIsInShell(): boolean {
  return useContext(ShellContext);
}

function navItems(user: SessionUser): NavItem[] {
  const items: NavItem[] = [
    {
      to: "/maps",
      label: hu.nav.maps,
      icon: "grid",
      section: /^\/(maps\/?$|play\/|leaderboard\/)/,
    },
    { to: "/maps/new", label: hu.nav.editor, icon: "pickaxe", section: /^\/maps\/(new|\d+\/edit)/ },
    { to: "/manual", label: hu.nav.manual, icon: "book", section: /^\/manual/ },
    { to: "/runs", label: hu.nav.runs, icon: "list", section: /^\/runs/ },
  ];
  return user.role === "admin"
    ? [...items, { to: "/admin", label: hu.nav.admin, icon: "key", section: /^\/admin/ }]
    : items;
}

function isMapsHome(pathname: string): boolean {
  return /^\/maps\/?$/.test(pathname);
}

function useShellLayout(): ShellLayout {
  const matches = useMatches();
  return matches.findLast((match) => match.staticData.layout)?.staticData.layout ?? "page";
}

export function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const layout = useShellLayout();
  useAudioUnlock();
  return (
    <div className="shell" data-layout={layout}>
      <header className="shell-header" data-theme="tarna">
        <HeaderSky />
        <div className="shell-bar">
          <Link to="/maps" variant="plain" className="shell-brand" aria-label={hu.app.name}>
            <span className="shell-lockup">
              <Logo scale={2} />
            </span>
            <span className="shell-mark">
              <Logo scale={2} isMarkOnly />
            </span>
          </Link>
          <nav aria-label={hu.nav.label} className="shell-nav">
            <ul className="shell-nav-list">
              {navItems(user).map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    variant="plain"
                    icon={item.icon}
                    className="shell-nav-link"
                    data-current={item.section.test(pathname)}
                    activeOptions={{ exact: true }}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="shell-tools">
            <SoundToggle />
            <ThemeToggle />
            <UserMenu user={user} />
          </div>
        </div>
        <HazardStripe />
      </header>
      <main id="main" tabIndex={-1} className="shell-main">
        <ShellContext value={true}>{children}</ShellContext>
      </main>
      {isMapsHome(pathname) ? null : (
        <PageBackdrop routeKey={pathname} isCalm={layout !== "page"} />
      )}
    </div>
  );
}
