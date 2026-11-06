import "./Led.css";

export type LedState = "off" | "ok" | "busy" | "warn" | "error";

type LedProps = { state: LedState; label: string; isBlinking?: boolean };

export function Led({ state, label, isBlinking = false }: LedProps) {
  return (
    <span className="led" data-state={state}>
      <span aria-hidden="true" className="led-lamp" data-blink={isBlinking} />
      <span className="led-label">{label}</span>
    </span>
  );
}
