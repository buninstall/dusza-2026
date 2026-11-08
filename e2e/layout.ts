import type { Page } from "@playwright/test";

export type LayoutIssue = {
  kind: "overflow" | "scroll-x" | "offscreen" | "clipped" | "overlap" | "covered" | "small-target";
  target: string;
  detail: string;
};

export type AuditOptions = { minTarget: number | null; scope?: string };

export async function settle(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) =>
          animation.playState !== "running" ||
          animation.effect?.getComputedTiming().iterations === Number.POSITIVE_INFINITY,
      ),
  );
}

export async function auditLayout(page: Page, options: AuditOptions): Promise<LayoutIssue[]> {
  await settle(page);
  return page.evaluate(
    ({ minTarget, scope }) => {
      const SELECTOR = [
        "a[href]",
        "button",
        "input:not([type='hidden'])",
        "select",
        "textarea",
        "[role='button']",
        "[role='tab']",
        "[role='slider']",
        "[role='menuitem']",
        "[role='gridcell'][tabindex='0']",
        "[role='grid']:not([aria-readonly='true']) [role='gridcell']",
      ].join(", ");
      const EXCLUDED = [
        "[aria-hidden='true']",
        "[inert]",
        "a[href='#main']",
        "[role='region'][aria-label='Értesítések']",
        "[contenteditable='true']",
      ].join(", ");
      const TWO_DIMENSIONAL = "[role='grid'], table, pre, [contenteditable='true']";
      const TOLERANCE = 1;
      const issues: LayoutIssue[] = [];
      const root = document.documentElement;
      const viewportWidth = root.clientWidth;
      const viewportHeight = window.innerHeight;

      const name = (element: Element): string => {
        const role = element.getAttribute("role") ?? element.tagName.toLowerCase();
        const label = element.getAttribute("aria-label") ?? element.textContent ?? "";
        return `${role} "${label.trim().replace(/\s+/g, " ").slice(0, 48)}"`;
      };

      const isScrollable = (value: string) => value === "auto" || value === "scroll";

      const isHiddenBox = (element: Element): boolean => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return (
          style.clipPath === "inset(50%)" ||
          ((rect.width <= TOLERANCE || rect.height <= TOLERANCE) && style.overflow !== "visible")
        );
      };

      const HIDDEN_DEPTH = 3;
      const visualTarget = (element: Element): Element | null => {
        let current: Element | null = element;
        let isHidden = false;
        for (let depth = 0; current && depth <= HIDDEN_DEPTH; depth += 1) {
          if (isHiddenBox(current)) {
            isHidden = true;
          } else if (isHidden) {
            return current;
          }
          current = current.parentElement;
        }
        return isHidden ? null : element;
      };

      const isExcluded = (element: Element): boolean => element.closest(EXCLUDED) !== null;

      const isTwoDimensional = (element: Element): boolean =>
        element.tagName === "PRE" || element.querySelector(TWO_DIMENSIONAL) !== null;

      const container = (scope ? document.querySelector(scope) : null) ?? document;
      const candidates = [...container.querySelectorAll(SELECTOR)]
        .filter((element) => !isExcluded(element))
        .map(visualTarget)
        .filter((element): element is Element => element !== null);
      const targets = [...new Set(candidates)].filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          rect.width > TOLERANCE &&
          rect.height > TOLERANCE
        );
      });

      if (root.scrollWidth > viewportWidth + TOLERANCE) {
        issues.push({
          kind: "overflow",
          target: "html",
          detail: `scrollWidth ${root.scrollWidth} > ${viewportWidth}`,
        });
      }

      for (const element of container.querySelectorAll("*")) {
        if (isExcluded(element) || isTwoDimensional(element)) {
          continue;
        }
        const style = getComputedStyle(element);
        if (
          isScrollable(style.overflowX) &&
          element.scrollWidth > element.clientWidth + TOLERANCE
        ) {
          issues.push({
            kind: "scroll-x",
            target: name(element),
            detail: `content ${element.scrollWidth} > box ${element.clientWidth}`,
          });
        }
      }

      const ancestorWith = (
        element: Element,
        predicate: (style: CSSStyleDeclaration) => boolean,
      ) => {
        let current = element.parentElement;
        while (current && current !== document.body) {
          const style = getComputedStyle(current);
          if (predicate(style)) {
            return { element: current, style };
          }
          current = current.parentElement;
        }
        return null;
      };

      for (const element of targets) {
        const rect = element.getBoundingClientRect();
        const scroller = ancestorWith(
          element,
          (style) => isScrollable(style.overflowX) || isScrollable(style.overflowY),
        );
        if (!scroller && (rect.left < -TOLERANCE || rect.right > viewportWidth + TOLERANCE)) {
          issues.push({
            kind: "offscreen",
            target: name(element),
            detail: `x ${Math.round(rect.left)}..${Math.round(rect.right)} / ${viewportWidth}`,
          });
        }
        const clip = ancestorWith(
          element,
          (style) => style.overflowX !== "visible" || style.overflowY !== "visible",
        );
        if (clip && !isScrollable(clip.style.overflowX) && !isScrollable(clip.style.overflowY)) {
          const box = clip.element.getBoundingClientRect();
          if (
            rect.left < box.left - TOLERANCE ||
            rect.right > box.right + TOLERANCE ||
            rect.top < box.top - TOLERANCE ||
            rect.bottom > box.bottom + TOLERANCE
          ) {
            issues.push({
              kind: "clipped",
              target: name(element),
              detail: `by ${name(clip.element)}`,
            });
          }
        }
        if (element.scrollWidth > element.clientWidth + 2 && element.tagName !== "INPUT") {
          issues.push({
            kind: "clipped",
            target: name(element),
            detail: `content ${element.scrollWidth} > box ${element.clientWidth}`,
          });
        }
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const scrollBox = scroller?.element.getBoundingClientRect();
        const isInScroller =
          !scrollBox ||
          (centerX >= scrollBox.left &&
            centerX <= scrollBox.right &&
            centerY >= scrollBox.top &&
            centerY <= scrollBox.bottom);
        if (
          isInScroller &&
          centerX > 0 &&
          centerX < viewportWidth &&
          centerY > 0 &&
          centerY < viewportHeight
        ) {
          const top = document.elementFromPoint(centerX, centerY);
          if (top && !element.contains(top) && !top.contains(element) && !isExcluded(top)) {
            issues.push({ kind: "covered", target: name(element), detail: `by ${name(top)}` });
          }
        }
        const isInline = element.tagName === "A" && getComputedStyle(element).display === "inline";
        const isReadOnlyCell = element.closest("[role='grid'][aria-readonly='true']") !== null;
        if (
          minTarget !== null &&
          !isInline &&
          !isReadOnlyCell &&
          (rect.width < minTarget - 0.5 || rect.height < minTarget - 0.5)
        ) {
          issues.push({
            kind: "small-target",
            target: name(element),
            detail: `${rect.width.toFixed(1)}×${rect.height.toFixed(1)}`,
          });
        }
      }

      const visibleRect = (element: Element) => {
        const rect = element.getBoundingClientRect();
        let { left, top, right, bottom } = rect;
        for (let node = element.parentElement; node; node = node.parentElement) {
          const style = getComputedStyle(node);
          if (isScrollable(style.overflowX) || isScrollable(style.overflowY)) {
            const box = node.getBoundingClientRect();
            left = Math.max(left, box.left);
            top = Math.max(top, box.top);
            right = Math.min(right, box.right);
            bottom = Math.min(bottom, box.bottom);
          }
        }
        return { left, top, right, bottom };
      };

      for (let first = 0; first < targets.length; first += 1) {
        const a = targets[first] as Element;
        const ra = visibleRect(a);
        for (let second = first + 1; second < targets.length; second += 1) {
          const b = targets[second] as Element;
          if (a.contains(b) || b.contains(a)) {
            continue;
          }
          const rb = visibleRect(b);
          const width = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
          const height = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
          if (width > TOLERANCE && height > TOLERANCE) {
            issues.push({
              kind: "overlap",
              target: name(a),
              detail: `${name(b)} (${width.toFixed(1)}×${height.toFixed(1)})`,
            });
          }
        }
      }
      return issues;
    },
    { minTarget: options.minTarget, scope: options.scope ?? null },
  );
}
