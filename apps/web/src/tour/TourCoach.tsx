import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Dialog, Heading, Popover } from "react-aria-components";
import { InlineText } from "../components/InlineText.tsx";
import { Button } from "../components/ui/Button.tsx";
import { hu } from "../i18n/hu.ts";
import { usePlayback } from "../play/playback-store.ts";
import { activeStep, TOUR_STEPS, type TourStep, useTour } from "./tour-state.ts";
import "./Tour.css";

const FIRST_LINE = "step forward 3";
const MINE_LINE = "mine here";

type Placement = "top" | "bottom" | "left" | "right";

const ANCHOR: Record<TourStep, { selector: string; placement: Placement }> = {
  board: { selector: ".stage-well", placement: "bottom" },
  editor: { selector: ".sheet-editor", placement: "left" },
  run: { selector: ".deck-lever", placement: "top" },
  watch: { selector: ".sheet-editor", placement: "left" },
  mine: { selector: ".deck-lever", placement: "top" },
  stars: { selector: ".play-progress", placement: "bottom" },
};

function linesOf(source: string): string[] {
  return source.split("\n").map((line) => line.trim());
}

function hasFirstLine(source: string): boolean {
  return linesOf(source).includes(FIRST_LINE);
}

function hasMineAfterStep(source: string): boolean {
  const lines = linesOf(source);
  const step = lines.indexOf(FIRST_LINE);
  return step !== -1 && lines.slice(step + 1).includes(MINE_LINE);
}

function useAnchor(selector: string | null): Element | null {
  const [anchor, setAnchor] = useState<Element | null>(null);
  useLayoutEffect(() => {
    const element = selector ? document.querySelector(selector) : null;
    setAnchor(element);
    element?.setAttribute("data-tour-target", "true");
    return () => element?.removeAttribute("data-tour-target");
  }, [selector]);
  return anchor;
}

function useRunWatcher(step: TourStep | null, advance: () => void) {
  const runId = usePlayback((state) => state.runId);
  const status = usePlayback((state) => state.status);
  const gold = usePlayback((state) => state.result?.gold ?? 0);
  const [base, setBase] = useState({ step, runId });
  if (base.step !== step) {
    setBase({ step, runId });
  }
  const isNewRun = base.step === step && runId > base.runId;
  useEffect(() => {
    if (!isNewRun) {
      return;
    }
    const isOver = status === "finished" || status === "stopped";
    if (step === "run" && isOver) {
      advance();
    }
    if (step === "mine" && status === "finished" && gold > 0) {
      advance();
    }
  }, [isNewRun, step, status, gold, advance]);
}

type TourCoachProps = {
  mapId: number;
  source: string;
  onSourceChange: (source: string) => void;
};

export function TourCoach({ mapId, source, onSourceChange }: TourCoachProps) {
  const data = useTour((state) => state.data);
  const advance = useTour((state) => state.advance);
  const finish = useTour((state) => state.finish);
  const step = activeStep(data, mapId);
  const anchor = useAnchor(step ? ANCHOR[step].selector : null);
  const triggerRef = useMemo(() => ({ current: anchor }), [anchor]);
  useRunWatcher(step, advance);

  useEffect(() => {
    if (step === "editor" && hasFirstLine(source)) {
      advance();
    }
    if (step === "watch" && hasMineAfterStep(source)) {
      advance();
    }
  }, [step, source, advance]);

  if (!step || !anchor) {
    return null;
  }
  const index = TOUR_STEPS.indexOf(step);
  const copy = hu.tour.steps[step];
  const isLast = step === "stars";
  const insert =
    step === "editor"
      ? { label: hu.tour.insert(FIRST_LINE), apply: () => onSourceChange(FIRST_LINE) }
      : step === "watch"
        ? {
            label: hu.tour.insert(MINE_LINE),
            apply: () => onSourceChange(`${source.replace(/\n+$/, "")}\n${MINE_LINE}`),
          }
        : null;

  return (
    <Popover
      triggerRef={triggerRef}
      isOpen
      isNonModal
      placement={ANCHOR[step].placement}
      offset={12}
      className="overlay-popover tour"
    >
      <Dialog className="overlay-popover-dialog" aria-labelledby="tour-title">
        <p className="tour-progress">{hu.tour.progress(index + 1, TOUR_STEPS.length)}</p>
        <Heading id="tour-title" slot="title" className="tour-title">
          {copy.title}
        </Heading>
        <p className="tour-body" role="status">
          <InlineText text={copy.body} />
        </p>
        <div className="tour-actions">
          {insert ? (
            <Button size="sm" variant="primary" onPress={insert.apply}>
              {insert.label}
            </Button>
          ) : null}
          {isLast ? (
            <Button size="sm" variant="primary" icon="check" onPress={finish}>
              {hu.tour.finish}
            </Button>
          ) : (
            <Button size="sm" variant={insert ? "secondary" : "primary"} onPress={advance}>
              {hu.tour.next}
            </Button>
          )}
          {isLast ? null : (
            <Button size="sm" variant="ghost" onPress={finish}>
              {hu.tour.skip}
            </Button>
          )}
        </div>
      </Dialog>
    </Popover>
  );
}
