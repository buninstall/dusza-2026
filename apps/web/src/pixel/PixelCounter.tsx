import { type CSSProperties, useState } from "react";
import { PixelText, type SignScale } from "./PixelText.tsx";
import "./pixel.css";

type PixelCounterProps = { value: number; scale: SignScale; isRolling?: boolean };

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

export function PixelCounter({ value, scale, isRolling = true }: PixelCounterProps) {
  const memory = useRollMemory(value);
  const digits = String(value);
  const before = String(memory.previous).padStart(digits.length, " ").slice(-digits.length);
  const cellSize = { "--cell-scale": `${scale}px` } as CSSProperties;
  return (
    <span aria-hidden="true" className="px-counter" style={cellSize}>
      {[...digits].map((digit, position) => {
        const old = before[position] ?? " ";
        const changes = isRolling && old !== digit && memory.turn > 0;
        const place = digits.length - position;
        return (
          <span key={`p${place.toString()}`} className="px-counter-cell">
            {changes && old !== " " ? (
              <span key={`o${memory.turn.toString()}`} className="px-counter-glyph" data-roll="out">
                <PixelText text={old} scale={scale} />
              </span>
            ) : null}
            <span
              key={changes ? `n${memory.turn.toString()}` : "still"}
              className="px-counter-glyph"
              data-roll={changes ? "in" : undefined}
            >
              <PixelText text={digit} scale={scale} />
            </span>
          </span>
        );
      })}
    </span>
  );
}
