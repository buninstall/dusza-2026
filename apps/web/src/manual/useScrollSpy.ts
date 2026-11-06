import { useEffect, useState } from "react";

const ROOT_MARGIN = "0px 0px -70% 0px";

export function useScrollSpy(ids: readonly string[]): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      return;
    }
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (records) => {
        for (const record of records) {
          if (record.isIntersecting) {
            visible.add(record.target.id);
          } else {
            visible.delete(record.target.id);
          }
        }
        const first = ids.find((id) => visible.has(id));
        if (first) {
          setActive(first);
        }
      },
      { rootMargin: ROOT_MARGIN },
    );
    for (const id of ids) {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    }
    return () => observer.disconnect();
  }, [ids]);
  return active;
}
