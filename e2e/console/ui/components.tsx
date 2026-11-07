import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Button, Tooltip, TooltipTrigger } from "react-aria-components";
import { create } from "zustand";
import type { RunSummary } from "./api.ts";
import { Check, Clock, Cross, Play, Square, Warn } from "./icons.tsx";
import { expectedDuration, formatDuration, useLive, useNow } from "./state.ts";

export const STATUS_TEXT: Record<RunSummary["status"], string> = {
  queued: "sorban",
  running: "fut",
  passed: "sikeres",
  failed: "sikertelen",
  error: "nem futott le",
  cancelled: "leállítva",
};

const STATUS_ICON: Record<RunSummary["status"], (props: { size?: number }) => ReactNode> = {
  queued: Clock,
  running: Play,
  passed: Check,
  failed: Cross,
  error: Warn,
  cancelled: Square,
};

export function StatusPill({
  status,
  compact = false,
}: {
  status: RunSummary["status"];
  compact?: boolean;
}) {
  const Glyph = STATUS_ICON[status];
  return (
    <span className={`pill pill-${status}${compact ? " pill-compact" : ""}`}>
      <Glyph size={compact ? 12 : 14} />
      <span className={compact ? "sr-only" : undefined}>{STATUS_TEXT[status]}</span>
    </span>
  );
}

export function SeverityTag({ severity }: { severity: string }) {
  const rank = ["blokkoló", "magas", "közepes", "alacsony"].indexOf(severity);
  return (
    <span className={`sev sev-${rank}`}>
      <span className="sev-bars" aria-hidden="true">
        {[0, 1, 2, 3].map((bar) => (
          <i key={bar} className={bar >= rank ? "on" : ""} />
        ))}
      </span>
      {severity}
    </span>
  );
}

export function Hint({ label, children }: { label: string; children: ReactNode }) {
  return (
    <TooltipTrigger delay={400}>
      {children}
      <Tooltip className="tooltip" offset={6}>
        {label}
      </Tooltip>
    </TooltipTrigger>
  );
}

export function IconButton({
  label,
  onPress,
  children,
  tone,
  isDisabled,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
  tone?: "danger" | "primary";
  isDisabled?: boolean;
}) {
  return (
    <Hint label={label}>
      <Button
        aria-label={label}
        className={`icon-button${tone ? ` ${tone}` : ""}`}
        onPress={onPress}
        isDisabled={isDisabled ?? false}
      >
        {children}
      </Button>
    </Hint>
  );
}

export function Panel({
  title,
  actions,
  children,
  className,
  id,
}: {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section className={`panel${className ? ` ${className}` : ""}`} aria-labelledby={id}>
      <header className="panel-head">
        <h2 id={id}>{title}</h2>
        {actions ? <div className="panel-actions">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-art" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p className="empty-title">{title}</p>
      {children ? <p className="muted">{children}</p> : null}
    </div>
  );
}

export function CountTriplet({
  passed,
  failed,
  skipped,
}: {
  passed: number;
  failed: number;
  skipped: number;
}) {
  return (
    <span className="triplet">
      <span className="t-pass">
        <Check size={12} />
        {passed}
        <span className="sr-only"> sikeres</span>
      </span>
      <span className="t-fail">
        <Cross size={12} />
        {failed}
        <span className="sr-only"> sikertelen</span>
      </span>
      <span className="t-skip">
        <Square size={12} />
        {skipped}
        <span className="sr-only"> kihagyott</span>
      </span>
    </span>
  );
}

export function RunProgress({ run }: { run: Omit<RunSummary, "failedCases"> }) {
  const runs = useLive((state) => state.runs);
  const now = useNow(1000);
  const expected = expectedDuration(runs, run.suiteId);
  const elapsed = run.startedAt ? now - run.startedAt : 0;
  const ratio = expected ? Math.min(elapsed / expected, 0.99) : null;
  const progress = run.progress;
  return (
    <div className="progress">
      <div
        className={`progress-track${ratio === null ? " indeterminate" : ""}`}
        role="progressbar"
        aria-label={`${run.title} haladása`}
        aria-valuemin={0}
        aria-valuemax={100}
        {...(ratio === null
          ? { "aria-valuetext": "ismeretlen hátralévő idő" }
          : { "aria-valuenow": Math.round(ratio * 100) })}
      >
        <span style={{ width: ratio === null ? undefined : `${ratio * 100}%` }} />
      </div>
      <div className="progress-meta">
        <span>{formatDuration(elapsed)}</span>
        {expected ? (
          <span>· várható: {formatDuration(Math.max(expected - elapsed, 0))} van hátra</span>
        ) : (
          <span>· első futás, nincs becslés</span>
        )}
        {progress ? <CountTriplet {...progress} /> : null}
      </div>
    </div>
  );
}

type Toast = { id: number; text: string; tone: "info" | "ok" | "fail" };
const useToasts = create<{
  toasts: Toast[];
  push: (text: string, tone?: Toast["tone"]) => void;
  drop: (id: number) => void;
}>((set, get) => ({
  toasts: [],
  push: (text, tone = "info") => {
    const id = Date.now() + Math.random();
    set({ toasts: [...get().toasts.slice(-3), { id, text, tone }] });
    setTimeout(() => get().drop(id), 5000);
  },
  drop: (id) => set({ toasts: get().toasts.filter((toast) => toast.id !== id) }),
}));

export const toast = (text: string, tone?: Toast["tone"]) => useToasts.getState().push(text, tone);

export function Toasts() {
  const toasts = useToasts((state) => state.toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((item) => (
        <div key={item.id} className={`toast toast-${item.tone}`}>
          {item.text}
        </div>
      ))}
    </div>
  );
}

export function useCopy(): (text: string, label?: string) => Promise<void> {
  return useCallback(async (text, label = "Vágólapra másolva.") => {
    try {
      await navigator.clipboard.writeText(text);
      toast(label, "ok");
    } catch {
      toast("A vágólap nem érhető el.", "fail");
    }
  }, []);
}

export function useDebounced<T>(value: T, delay = 200): T {
  const [current, setCurrent] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setCurrent(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return current;
}

export function Highlight({ text, needle }: { text: string; needle: string }) {
  if (!needle) return <>{text}</>;
  const lower = text.toLowerCase();
  const target = needle.toLowerCase();
  const parts: ReactNode[] = [];
  let index = 0;
  let found = lower.indexOf(target);
  while (found >= 0 && parts.length < 200) {
    if (found > index) parts.push(text.slice(index, found));
    parts.push(<mark key={found}>{text.slice(found, found + needle.length)}</mark>);
    index = found + needle.length;
    found = lower.indexOf(target, index);
  }
  parts.push(text.slice(index));
  return <>{parts}</>;
}

export function useHotkey(combo: string, handler: (event: KeyboardEvent) => void, enabled = true) {
  const saved = useRef(handler);
  saved.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const listener = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      const wantsMod = combo.startsWith("mod+");
      const key = wantsMod ? combo.slice(4) : combo;
      if (wantsMod !== (event.ctrlKey || event.metaKey)) return;
      if (!wantsMod && typing) return;
      if (event.key.toLowerCase() !== key) return;
      event.preventDefault();
      saved.current(event);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [combo, enabled]);
}
