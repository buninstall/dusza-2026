import { type RefObject, useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../lib/motion.ts";

export type TurnDirection = "next" | "prev" | "none";

type PageTurnInput = {
  page: number;
  isSettled: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  regionRef: RefObject<HTMLElement | null>;
  onPageChange: (page: number) => void;
};

export function usePageTurn({
  page,
  isSettled,
  anchorRef,
  regionRef,
  onPageChange,
}: PageTurnInput) {
  const isReduced = usePrefersReducedMotion();
  const [direction, setDirection] = useState<TurnDirection>("none");
  const pendingFocus = useRef(false);

  useEffect(() => {
    if (!isSettled || !pendingFocus.current || page < 1) {
      return;
    }
    pendingFocus.current = false;
    regionRef.current?.focus({ preventScroll: true });
  }, [page, isSettled, regionRef]);

  const turnTo = (target: number) => {
    if (target === page) {
      return;
    }
    setDirection(target > page ? "next" : "prev");
    pendingFocus.current = true;
    anchorRef.current?.scrollIntoView({
      behavior: isReduced ? "auto" : "smooth",
      block: "start",
    });
    onPageChange(target);
  };

  return { direction, turnTo };
}
