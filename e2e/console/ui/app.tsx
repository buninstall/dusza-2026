import "@fontsource-variable/atkinson-hyperlegible-next";
import "@fontsource-variable/atkinson-hyperlegible-mono";
import "@fontsource-variable/pixelify-sans";
import "./styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, StrictMode, useEffect, useRef, useState } from "react";
import { Button, Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { createRoot } from "react-dom/client";
import { api } from "./api.ts";
import { Compare } from "./compare.tsx";
import { Hint, STATUS_TEXT, Toasts, toast, useHotkey } from "./components.tsx";
import { Findings } from "./findings.tsx";
import { Cart, Cog, Exit, Gauge, Lamp, Nugget, Shaft, Split } from "./icons.tsx";
import { Overview } from "./overview.tsx";
import { CommandPalette } from "./palette.tsx";
import { type NavItem, Rail } from "./rail.tsx";
import { Runs } from "./runs.tsx";
import { notificationsEnabled, Settings } from "./settings.tsx";
import {
  connectEvents,
  href,
  navigate,
  OPEN_STATUSES,
  type Route,
  setFinishedHandler,
  useDescent,
  useLive,
  useRoute,
} from "./state.ts";
import { Suites } from "./suites.tsx";

try {
  document.documentElement.dataset.theme = localStorage.getItem("tc-theme") ?? "mine";
} catch {
  document.documentElement.dataset.theme = "mine";
}

const NAV: NavItem[] = [
  { page: "overview", label: "Áttekintés", hint: "aknajelentés", icon: Gauge, key: "o" },
  { page: "suites", label: "Csomagok", hint: "fúrási terv", icon: Shaft, key: "s" },
  { page: "runs", label: "Futások", hint: "csillék", icon: Cart, key: "r" },
  { page: "findings", label: "Találatok", hint: "hibanapló", icon: Nugget, key: "f" },
  { page: "compare", label: "Összevetés", hint: "rétegek", icon: Split, key: "c" },
  { page: "settings", label: "Beállítások", hint: "gépház", icon: Cog, key: "," },
];

function StatusStrip() {
  const { runs, findings, connected } = useLive();
  const all = [...runs.values()];
  const running = all.filter((run) => run.status === "running");
  const queued = all.filter((run) => run.status === "queued").length;
  const open = findings.filter((finding) => OPEN_STATUSES.has(finding.status));
  const blockers = open.filter((finding) => finding.severity === "blokkoló").length;
  return (
    <div className="strip" role="status" aria-live="polite">
      <span className={`beacon ${connected ? "on" : "off"}`}>
        <i aria-hidden="true" />
        {connected ? "élő kapcsolat" : "újrakapcsolódás…"}
      </span>
      <span className="strip-item">
        <strong>{running.length}</strong> fut{running[0] ? `: ${running[0].title}` : ""}
      </span>
      <span className="strip-item">
        <strong>{queued}</strong> sorban
      </span>
      <a
        className={`strip-item${blockers ? " strip-alert" : ""}`}
        href={href({ page: "findings" })}
      >
        <strong>{open.length}</strong> nyitott találat
        {blockers ? `, ebből ${blockers} blokkoló` : ""}
      </a>
    </div>
  );
}

function Shortcuts({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  return (
    <ModalOverlay className="overlay" isOpen={open} onOpenChange={onOpenChange} isDismissable>
      <Modal className="modal">
        <Dialog className="dialog-body">
          <Heading slot="title" className="dialog-title">
            Billentyűparancsok
          </Heading>
          <dl className="shortcuts">
            <dt>
              <kbd>Ctrl</kbd> + <kbd>K</kbd>
            </dt>
            <dd>parancspaletta: bármely csomag vagy találat</dd>
            {NAV.map((item) => (
              <div key={item.page} className="shortcut-row">
                <dt>
                  <kbd>g</kbd> <kbd>{item.key}</kbd>
                </dt>
                <dd>{item.label}</dd>
              </div>
            ))}
            <dt>
              <kbd>?</kbd>
            </dt>
            <dd>ez a súgó</dd>
          </dl>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function useGoKeys() {
  const pending = useRef(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const listener = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      )
        return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (pending.current) {
        pending.current = false;
        const item = NAV.find((candidate) => candidate.key === event.key);
        if (item) navigate({ page: item.page } as Route);
        return;
      }
      if (event.key === "g") {
        pending.current = true;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          pending.current = false;
        }, 1200);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
}

function App() {
  const ready = useLive((state) => state.ready);
  const route = useRoute();
  const descent = useDescent(route.page);
  const [help, setHelp] = useState(false);
  const main = useRef<HTMLElement>(null);
  useHotkey("?", () => setHelp(true));
  useGoKeys();
  useEffect(() => {
    void useLive
      .getState()
      .load()
      .catch((error: Error) => toast(error.message, "fail"));
    setFinishedHandler((run) => {
      const text = `${run.title}: ${STATUS_TEXT[run.status]} (${run.counts.passed} ✓, ${run.counts.failed} ✗)`;
      toast(text, run.status === "passed" ? "ok" : "fail");
      if (notificationsEnabled() && document.hidden)
        new Notification("MineScript tesztkonzol", { body: text });
    });
    return connectEvents();
  }, []);
  useEffect(() => {
    window.scrollTo({ top: 0 });
    main.current?.focus({ preventScroll: true });
    const label = NAV.find((item) => item.page === route.page)?.label;
    document.title = `${label ?? "Áttekintés"} · MineScript tesztkonzol`;
  }, [route.page]);
  const logout = async () => {
    await api("/api/logout", { method: "POST", body: {} }).catch(() => undefined);
    window.location.replace("/");
  };
  return (
    <div className="app">
      <a className="skip" href="#main">
        Ugrás a tartalomra
      </a>
      <Rail
        items={NAV}
        current={route.page}
        onHelp={() => setHelp(true)}
        onLogout={() => void logout()}
      />
      <div className="workspace">
        <header className="topbar">
          <StatusStrip />
          <Button
            className="palette-trigger"
            onPress={() =>
              window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))
            }
          >
            Parancs keresése… <kbd>Ctrl</kbd>
            <kbd>K</kbd>
          </Button>
        </header>
        <main id="main" className="page-stage" ref={main} tabIndex={-1}>
          {!ready ? (
            <p className="muted page" role="status">
              Betöltés…
            </p>
          ) : (
            <div key={route.page} className={`page-enter descent-${descent}`}>
              <span className="lamp-sweep" aria-hidden="true" />
              {route.page === "suites" ? (
                <Suites />
              ) : route.page === "runs" ? (
                <Runs runId={route.run} />
              ) : route.page === "findings" ? (
                <Findings findingId={route.finding} />
              ) : route.page === "compare" ? (
                <Compare a={route.a} b={route.b} />
              ) : route.page === "settings" ? (
                <Settings />
              ) : (
                <Overview />
              )}
            </div>
          )}
        </main>
      </div>
      <CommandPalette />
      <Shortcuts open={help} onOpenChange={setHelp} />
      <Toasts />
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  );
}
