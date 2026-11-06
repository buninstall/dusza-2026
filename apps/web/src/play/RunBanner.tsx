import type { Diagnostic, Outcome } from "@minescript/engine";
import type { ReactNode, Ref } from "react";
import { Led } from "../components/Led.tsx";
import { Button } from "../components/ui/Button.tsx";
import { hu, runtimeErrors } from "../i18n/hu.ts";
import { HazardStripe } from "../pixel/HazardStripe.tsx";
import type { IconName } from "../pixel/icons.ts";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
import type { PlaybackStatus } from "./playback-store.ts";
import "./PlayPage.css";
import type { Submission } from "./useRunSession.ts";

type BannerTone = "ok" | "error" | "neutral";

type BannerProps = {
  tone: BannerTone;
  icon: IconName;
  title: string;
  isUrgent?: boolean;
  bannerRef?: Ref<HTMLDivElement> | undefined;
  children: ReactNode;
};

function Banner({ tone, icon, title, isUrgent = false, bannerRef, children }: BannerProps) {
  return (
    <div
      ref={bannerRef}
      tabIndex={-1}
      role={isUrgent ? "alert" : "status"}
      className="play-banner"
      data-tone={tone}
    >
      {tone === "error" ? <HazardStripe /> : null}
      <div className="play-banner-body">
        <p className="play-banner-title">
          <PixelIcon name={icon} />
          {title}
        </p>
        {children}
      </div>
    </div>
  );
}

function SubmissionLine({
  submission,
  onRetry,
}: {
  submission: Submission | null;
  onRetry: () => void;
}) {
  if (submission === null || submission.state === "pending") {
    return <Led state="busy" label={hu.play.submitting} isBlinking />;
  }
  if (submission.state === "done") {
    return <Led state="ok" label={hu.play.submitted(submission.gold, submission.steps)} />;
  }
  return (
    <div className="play-banner-actions">
      <Led state="error" label={submission.message} />
      <Button size="sm" icon="rewind" onPress={onRetry}>
        {hu.play.submitRetry}
      </Button>
    </div>
  );
}

type RunBannerProps = {
  status: PlaybackStatus;
  outcome: Outcome | null;
  gold: number;
  steps: number;
  syntaxErrors: readonly Diagnostic[] | null;
  submission: Submission | null;
  onRetry: () => void;
  onShowLine: (line: number) => void;
  ref?: Ref<HTMLDivElement>;
};

function errorLines(diagnostics: readonly Diagnostic[]): number[] {
  return [...new Set(diagnostics.map((diagnostic) => diagnostic.span.line))].sort((a, b) => a - b);
}

export function RunBanner({
  status,
  outcome,
  gold,
  steps,
  syntaxErrors,
  submission,
  onRetry,
  onShowLine,
  ref,
}: RunBannerProps) {
  if (syntaxErrors && syntaxErrors.length > 0) {
    const lines = errorLines(syntaxErrors);
    const first = lines[0] ?? 1;
    return (
      <Banner tone="error" icon="error" title={hu.play.syntaxErrorTitle} isUrgent bannerRef={ref}>
        <p>{hu.play.syntaxErrorLines(lines)}</p>
        <div className="play-banner-actions">
          <Button size="sm" icon="arrowRight" onPress={() => onShowLine(first)}>
            {hu.play.showLine(first)}
          </Button>
        </div>
      </Banner>
    );
  }
  if (status === "stopped") {
    return (
      <Banner tone="neutral" icon="stop" title={hu.play.stoppedTitle} bannerRef={ref}>
        <p>{hu.play.stoppedBody}</p>
      </Banner>
    );
  }
  if (status !== "finished" || outcome === null) {
    return null;
  }
  if (outcome.kind === "runtimeError") {
    const explanation = runtimeErrors[outcome.code];
    return (
      <Banner
        tone="error"
        icon="warning"
        title={hu.play.runtimeErrorTitle(outcome.code, outcome.line)}
      >
        <p>
          <strong>{explanation.title}.</strong> {explanation.hint}
        </p>
        <div className="play-banner-actions">
          <Button size="sm" icon="arrowRight" onPress={() => onShowLine(outcome.line)}>
            {hu.play.showLine(outcome.line)}
          </Button>
        </div>
        <SubmissionLine submission={submission} onRetry={onRetry} />
      </Banner>
    );
  }
  return (
    <Banner tone="ok" icon="check" title={hu.play.finishedTitle} bannerRef={ref}>
      <p>{hu.play.finishedBody(gold, steps)}</p>
      <SubmissionLine submission={submission} onRetry={onRetry} />
    </Banner>
  );
}
