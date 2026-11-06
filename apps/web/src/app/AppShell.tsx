import type { ReactNode } from "react";
import type { SessionUser } from "../auth/session.ts";
import { Link } from "../components/ui/Link.tsx";
import { hu } from "../i18n/hu.ts";
import { HazardStripe } from "../pixel/HazardStripe.tsx";
import type { IconName } from "../pixel/icons.ts";
import { Logo } from "../pixel/Logo.tsx";
import "./AppShell.css";
import { ThemeToggle } from "./ThemeToggle.tsx";
import { UserMenu } from "./UserMenu.tsx";

type NavTarget = "/maps" | "/maps/new" | "/runs" | "/manual" | "/admin";

type NavItem = { to: NavTarget; label: string; icon: IconName; isExact?: boolean };

function navItems(user: SessionUser): NavItem[] {
  const items: NavItem[] = [
    { to: "/maps", label: hu.nav.maps, icon: "grid", isExact: true },
    { to: "/maps/new", label: hu.nav.newMap, icon: "pickaxe" },
    { to: "/runs", label: hu.nav.runs, icon: "list" },
    { to: "/manual", label: hu.nav.manual, icon: "book" },
  ];
  return user.role === "admin"
    ? [...items, { to: "/admin", label: hu.nav.admin, icon: "key" }]
    : items;
}

export function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  return (
    <div className="shell-shell">
      <header className="shell-header">
        <div className="shell-bar">
          <Link to="/maps" variant="plain" className="shell-brand" aria-label={hu.app.name}>
            <Logo />
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
                    activeOptions={{ exact: item.isExact ?? false }}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="shell-tools">
            <ThemeToggle />
            <UserMenu user={user} />
          </div>
        </div>
        <HazardStripe />
      </header>
      <main id="main" tabIndex={-1} className="shell-main">
        {children}
      </main>
    </div>
  );
}
