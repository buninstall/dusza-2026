import { pager } from "../i18n/hu-pager.ts";
import { Button } from "./ui/Button.tsx";
import "./Pager.css";

type PagerProps = {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
};

const EDGE = 1;
const AROUND = 1;

export function pageItems(page: number, pageCount: number): (number | "gap")[] {
  const keep = new Set<number>();
  for (let p = 1; p <= Math.min(EDGE, pageCount); p += 1) keep.add(p);
  for (let p = Math.max(1, pageCount - EDGE + 1); p <= pageCount; p += 1) keep.add(p);
  for (let p = page - AROUND; p <= page + AROUND; p += 1) {
    if (p >= 1 && p <= pageCount) keep.add(p);
  }
  const sorted = [...keep].sort((a, b) => a - b);
  const items: (number | "gap")[] = [];
  for (const [index, p] of sorted.entries()) {
    const previous = sorted[index - 1];
    if (previous !== undefined && p - previous === 2) items.push(previous + 1);
    else if (previous !== undefined && p - previous > 2) items.push("gap");
    items.push(p);
  }
  return items;
}

export function Pager({ page, pageCount, onChange }: PagerProps) {
  if (pageCount <= 1) {
    return null;
  }
  return (
    <nav className="pager" aria-label={pager.label}>
      <Button size="sm" icon="arrowLeft" isDisabled={page <= 1} onPress={() => onChange(page - 1)}>
        {pager.previous}
      </Button>
      <ol className="pager-pages">
        {pageItems(page, pageCount).map((item, index) =>
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
        isDisabled={page >= pageCount}
        onPress={() => onChange(page + 1)}
      >
        {pager.next}
      </Button>
    </nav>
  );
}
