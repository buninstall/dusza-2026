import type { RunResult } from "@minescript/engine";
import type { Ref } from "react";
import { Led } from "../../components/Led.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { formatCount, hu, runtimeErrors } from "../../i18n/hu.ts";
import { PixelText } from "../../pixel/PixelText.tsx";
import { type Blocked, errorLinesOf, type ReportKind } from "../phase.ts";
import { PROGRAM_MAX_CHARS } from "../program-file.ts";
import type { Submission } from "../useRunSession.ts";
import "./ShiftReport.css";

type ShiftReportProps = {
  kind: ReportKind;
  result: RunResult | null;
  blocked: Blocked | null;
  onShowLine: (line: number) => void;
  ref?: Ref<HTMLDivElement>;
};

type Content = { stamp: string; text: string; line: number | null };

function blockedContent(blocked: Blocked): Content {
  if (blocked.kind === "engine") {
    return { stamp: hu.stamps.error, text: hu.play.engineCrashTitle, line: null };
  }
  if (blocked.kind === "tooLong") {
    return {
      stamp: hu.stamps.blocked,
      text: hu.play.tooLong(formatCount(blocked.length), formatCount(PROGRAM_MAX_CHARS)),
      line: null,
    };
  }
  const lines = errorLinesOf(blocked.diagnostics);
  return {
    stamp: hu.stamps.blocked,
    text: `${hu.play.syntaxErrorShort} · ${hu.play.syntaxErrorLines(lines)}`,
    line: lines[0] ?? 1,
  };
}

function reportContent({ kind, result, blocked }: ShiftReportProps): Content | null {
  if ((kind === "blocked" || kind === "crash") && blocked) {
    return blockedContent(blocked);
  }
  if (kind === "stopped") {
    return { stamp: hu.stamps.stopped, text: hu.play.stoppedBody, line: null };
  }
  if ((kind === "error" || kind === "limit") && result?.outcome.kind === "runtimeError") {
    const { code, line } = result.outcome;
    return {
      stamp: kind === "limit" ? hu.stamps.limit : hu.stamps.error,
      text: `${hu.play.runtimeErrorTitle(code, line)} · ${runtimeErrors[code].title}`,
      line,
    };
  }
  return null;
}

export function ShiftReport(props: ShiftReportProps) {
  const content = reportContent(props);
  if (!content) {
    return null;
  }
  const isUrgent = props.kind === "blocked" || props.kind === "crash";
  const tone = props.kind === "stopped" ? "neutral" : "error";
  return (
    <div
      ref={props.ref}
      tabIndex={-1}
      role={isUrgent ? "alert" : "status"}
      className="report"
      data-tone={tone}
      data-kind={props.kind}
    >
      <span className="report-stamp" aria-hidden="true">
        <PixelText text={content.stamp} scale={2} />
      </span>
      <p className="report-text">{content.text}</p>
      {content.line === null ? null : (
        <Button size="sm" icon="arrowRight" onPress={() => props.onShowLine(content.line ?? 1)}>
          {hu.play.showLine(content.line)}
        </Button>
      )}
    </div>
  );
}

type SubmissionLineProps = { submission: Submission | null; onRetry: () => void };

export function SubmissionLine({ submission, onRetry }: SubmissionLineProps) {
  if (submission?.state === "done") {
    return (
      <p className="visually-hidden" role="status">
        {hu.play.submitted(submission.gold, submission.steps)}
      </p>
    );
  }
  if (submission?.state !== "error") {
    return null;
  }
  return (
    <div className="report" data-tone="error" role="alert">
      <Led state="error" label={submission.message} isSentenceCase />
      <Button size="sm" icon="rewind" onPress={onRetry}>
        {hu.play.submitRetry}
      </Button>
    </div>
  );
}
