import type { CSSProperties } from "react";
import { pager } from "../i18n/hu-pager.ts";
import { Button } from "./ui/Button.tsx";
import "./Pager.css";

type PagerProps = {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  onIntent?: ((page: number) => void) | undefined;
  label?: string | undefined;
};

export type PageItem = number | "gap";

const EDGE = 1;
const AROUND = 1;
export const PAGER_SLOTS = 2 * EDGE + 2 * AROUND + 3;
const BEND = EDGE + AROUND + 2;

function span(from: number, to: number): number[] {
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => from + index);
}

export function pageItems(page: number, pageCount: number): PageItem[] {
  if (pageCount <= PAGER_SLOTS) {
    return span(1, pageCount);
  }
  const current = Math.min(Math.max(page, 1), pageCount);
  const head = span(1, EDGE);
  const tail = span(pageCount - EDGE + 1, pageCount);
  const run = PAGER_SLOTS - EDGE - 1;
  if (current <= BEND) {
    return [...span(1, run), "gap", ...tail];
  }
  if (current > pageCount - BEND) {
    return [...head, "gap", ...span(pageCount - run + 1, pageCount)];
  }
  return [...head, "gap", ...span(current - AROUND, current + AROUND), "gap", ...tail];
}

export function Pager({ page, pageCount, onChange, onIntent, label }: PagerProps) {
  if (pageCount <= 1) {
    return null;
  }
  const items = pageItems(page, pageCount);
  const intent = (target: number) =>
    onIntent ? { onHoverStart: () => onIntent(target), onFocus: () => onIntent(target) } : {};
  const track = {
    "--pager-slots": items.length,
    "--pager-cells": items.length + 2,
  } as CSSProperties;
  return (
    <nav className="pager" aria-label={label ?? pager.label}>
      <div className="pager-track" style={track}>
        <Button
          size="sm"
          icon="arrowLeft"
          className="pager-step pager-prev"
          isDisabled={page <= 1}
          onPress={() => onChange(page - 1)}
          {...intent(page - 1)}
        >
          <span className="pager-step-label">{pager.previous}</span>
        </Button>
        <ol className="pager-pages">
          {items.map((item, index) =>
            item === "gap" ? (
              <li key={`gap-${index.toString()}`} className="pager-gap" aria-hidden="true">
                …
              </li>
            ) : (
              <li key={item}>
                {item === page ? (
                  <span className="pager-current" aria-current="page">
                    <span className="visually-hidden">{pager.page(item)}</span>
                    <span aria-hidden="true">{item}</span>
                  </span>
                ) : (
                  <Button
                    size="sm"
                    className="pager-page"
                    aria-label={pager.page(item)}
                    onPress={() => onChange(item)}
                    {...intent(item)}
                  >
                    {String(item)}
                  </Button>
                )}
              </li>
            ),
          )}
        </ol>
        <Button
          size="sm"
          icon="arrowRight"
          className="pager-step pager-next"
          isDisabled={page >= pageCount}
          onPress={() => onChange(page + 1)}
          {...intent(page + 1)}
        >
          <span className="pager-step-label">{pager.next}</span>
        </Button>
      </div>
    </nav>
  );
}
