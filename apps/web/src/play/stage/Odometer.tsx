import { useState } from "react";

type OdometerProps = { value: number; digits: number; isRolling?: boolean };

type Memory = { value: number; previous: number; turn: number };

function useRollMemory(value: number): Memory {
  const [memory, setMemory] = useState<Memory>({ value, previous: value, turn: 0 });
  if (memory.value !== value) {
    const next = { value, previous: memory.value, turn: memory.turn + 1 };
    setMemory(next);
    return next;
  }
  return memory;
}

function padded(value: number, digits: number): string {
  return String(Math.max(Math.trunc(value), 0)).padStart(digits, "0");
}

export function Odometer({ value, digits, isRolling = false }: OdometerProps) {
  const memory = useRollMemory(value);
  const text = padded(value, digits);
  const before = padded(memory.previous, text.length);
  return (
    <span aria-hidden="true" className="k-odometer hud-odo">
      {[...text].map((digit, position) => {
        const place = text.length - position;
        const isTurning = isRolling && memory.turn > 0 && before[position] !== digit;
        return (
          <span
            key={
              isTurning ? `p${place.toString()}-${memory.turn.toString()}` : `p${place.toString()}`
            }
            className="k-odo-digit"
            data-roll={isTurning ? "in" : undefined}
          >
            {digit}
          </span>
        );
      })}
    </span>
  );
}
