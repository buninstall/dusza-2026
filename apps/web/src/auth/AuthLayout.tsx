import type { ReactNode } from "react";
import { hu } from "../i18n/hu.ts";

const ART = [
  "#####@####",
  "#>....#..#",
  "#.##.##@.#",
  "#.#@.....#",
  "#.####.#.#",
  "#..@...#@#",
  "##########",
];

const artClass: Record<string, string> = {
  "#": "cell-wall",
  "@": "cell-gold",
  ".": "bg-paper-raised",
  ">": "bg-signal",
};

export function AuthLayout({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto grid min-h-dvh max-w-5xl items-center gap-10 px-6 py-10 outline-none md:grid-cols-[1.1fr_1fr]"
    >
      <section aria-hidden className="hidden md:block">
        <p className="eyebrow">{hu.app.tagline}</p>
        <p className="mt-3 text-6xl font-black tracking-tighter text-ink">
          Mine<span className="text-ore-deep">Script</span>
        </p>
        <div className="mt-8 grid w-full max-w-sm grid-cols-10 gap-px overflow-hidden rounded-[12px] border border-line-strong bg-line-strong shadow-plate">
          {ART.flatMap((row, rowIndex) =>
            [...row].map((symbol, colIndex) => (
              <span
                key={`${rowIndex.toString()}-${colIndex.toString()}`}
                className={`aspect-square ${artClass[symbol] ?? ""}`}
              />
            )),
          )}
        </div>
      </section>
      <section aria-labelledby="auth-title" className="plate p-7 sm:p-9">
        <h1 id="auth-title" className="text-3xl font-extrabold tracking-tight">
          {title}
        </h1>
        <p className="mt-2 text-ink-muted">{lead}</p>
        <div className="mt-7">{children}</div>
      </section>
    </main>
  );
}
