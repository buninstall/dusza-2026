import { clsx } from "clsx";

const SYMBOL_CLASS: Record<string, string> = {
  "#": "bg-wall",
  "@": "bg-ore",
  ".": "bg-paper-raised",
};

export function MiniMap({ content }: { content: string }) {
  const [, ...rows] = content.trimEnd().split("\n");
  const cols = rows[0]?.length ?? 1;
  return (
    <div
      aria-hidden
      className="grid w-20 shrink-0 gap-px overflow-hidden rounded-[6px] border border-line-strong bg-line-strong"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {rows.flatMap((row, rowIndex) =>
        [...row].map((symbol, colIndex) => (
          <span
            key={`${rowIndex.toString()}-${colIndex.toString()}`}
            className={clsx("aspect-square", SYMBOL_CLASS[symbol] ?? "bg-signal")}
          />
        )),
      )}
    </div>
  );
}
