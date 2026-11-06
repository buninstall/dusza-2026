import "./Led.css";

export type LedState = "off" | "ok" | "busy" | "warn" | "error";
export type LedBlink = boolean | "thrice";

type LedProps = {
  state: LedState;
  label: string;
  isBlinking?: LedBlink;
  isSentenceCase?: boolean;
};

export function Led({ state, label, isBlinking = false, isSentenceCase = false }: LedProps) {
  return (
    <span className="led" data-state={state} data-case={isSentenceCase ? "sentence" : "upper"}>
      <span aria-hidden="true" className="led-lamp" data-blink={String(isBlinking)} />
      <span className="led-label">{label}</span>
    </span>
  );
}
