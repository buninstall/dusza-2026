import type { CSSProperties, ReactNode } from "react";
import { Button } from "react-aria-components";
import { Hint } from "./components.tsx";
import { Exit, Lamp } from "./icons.tsx";
import { href, OPEN_STATUSES, type Route, useLive } from "./state.ts";

export type NavItem = {
  page: Route["page"];
  label: string;
  hint: string;
  icon: (props: { size?: number }) => ReactNode;
  key: string;
};

function useCounters(): Partial<
  Record<Route["page"], { value: number; tone: string; label: string }>
> {
  const runs = useLive((state) => state.runs);
  const findings = useLive((state) => state.findings);
  const suites = useLive((state) => state.suites);
  const all = [...runs.values()];
  const running = all.filter((run) => run.status === "running" || run.status === "queued").length;
  const open = findings.filter((finding) => OPEN_STATUSES.has(finding.status));
  const blocking = open.some(
    (finding) => finding.severity === "blokkoló" || finding.severity === "magas",
  );
  return {
    suites: { value: suites.length, tone: "plain", label: `${suites.length} csomag` },
    ...(running
      ? { runs: { value: running, tone: "live", label: `${running} fut vagy várakozik` } }
      : {}),
    ...(open.length
      ? {
          findings: {
            value: open.length,
            tone: blocking ? "alert" : "warn",
            label: `${open.length} nyitott találat`,
          },
        }
      : {}),
  };
}

export function Rail({
  items,
  current,
  onHelp,
  onLogout,
}: {
  items: NavItem[];
  current: Route["page"];
  onHelp: () => void;
  onLogout: () => void;
}) {
  const connected = useLive((state) => state.connected);
  const counters = useCounters();
  const index = Math.max(
    0,
    items.findIndex((item) => item.page === current),
  );
  return (
    <nav className="rail" aria-label="Fő navigáció">
      <a
        className="rail-brand"
        href={href({ page: "overview" })}
        aria-label="Tesztakna – áttekintés"
      >
        <span className="rail-lamp" aria-hidden="true">
          <Lamp size={20} />
        </span>
        <span className="rail-brand-text">
          <span className="brand-word">TESZTAKNA</span>
          <span className="rail-sub">tesztkonzol</span>
        </span>
      </a>
      <p className="rail-depth" aria-hidden="true">
        <span>mélység</span>
        <strong>−{String((index + 1) * 120).padStart(4, "0")} m</strong>
      </p>
      <ol className="rail-shaft" style={{ "--active": index } as CSSProperties}>
        {items.map((item, position) => {
          const Glyph = item.icon;
          const active = item.page === current;
          const counter = counters[item.page];
          return (
            <li key={item.page} className={`rail-stop${active ? " active" : ""}`}>
              <a
                className="rail-link"
                href={href({ page: item.page } as Route)}
                aria-current={active ? "page" : undefined}
                aria-label={counter ? `${item.label}, ${counter.label}` : item.label}
              >
                <span className="rail-node" aria-hidden="true" />
                <span className="rail-icon" aria-hidden="true">
                  <Glyph size={18} />
                </span>
                <span className="rail-text">
                  <span className="rail-label">{item.label}</span>
                  <span className="rail-hint">{item.hint}</span>
                </span>
                {counter ? (
                  <span className={`rail-count count-${counter.tone}`} aria-hidden="true">
                    {counter.value > 99 ? "99+" : counter.value}
                  </span>
                ) : (
                  <span className="rail-key" aria-hidden="true">
                    <kbd>g {item.key}</kbd>
                  </span>
                )}
              </a>
              {position < items.length - 1 ? (
                <span className="rail-cable" aria-hidden="true" />
              ) : null}
            </li>
          );
        })}
      </ol>
      <div className="rail-foot">
        <p className={`rail-signal ${connected ? "on" : "off"}`}>
          <i aria-hidden="true" />
          {connected ? "Jelzés a felszínnel" : "Nincs jelzés, újrakapcsolódás…"}
        </p>
        <div className="rail-tools">
          <Hint label="Billentyűparancsok">
            <Button className="rail-tool" aria-label="Billentyűparancsok" onPress={onHelp}>
              <kbd>?</kbd>
            </Button>
          </Hint>
          <Hint label="Kijelentkezés">
            <Button className="rail-tool" aria-label="Kijelentkezés" onPress={onLogout}>
              <Exit size={18} />
            </Button>
          </Hint>
        </div>
      </div>
    </nav>
  );
}
