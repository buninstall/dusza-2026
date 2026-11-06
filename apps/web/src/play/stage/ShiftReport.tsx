import type { RunResult } from "@minescript/engine";
import type { ReactNode, Ref } from "react";
import { Led } from "../../components/Led.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { formatCount, hu, runtimeErrors } from "../../i18n/hu.ts";
import { PixelText } from "../../pixel/PixelText.tsx";
import { type Blocked, errorLinesOf, type ReportKind } from "../phase.ts";
import { PROGRAM_MAX_CHARS } from "../program-file.ts";
import type { Submission } from "../useRunSession.ts";

type ReportActions = {
  onShowLine: (line: number) => void;
  onInsertGuard?: ((line: number) => void) | undefined;
};

type ShiftReportProps = ReportActions & {
  kind: ReportKind;
  result: RunResult | null;
  blocked: Blocked | null;
  reachableGold: number;
  footer: ReactNode;
  extra?: ReactNode;
  ref?: Ref<HTMLDivElement>;
};

type Content = {
  stamp: string;
  tone: "ok" | "error" | "neutral";
  title: ReactNode;
  body: ReactNode;
};

function ShowLine({ line, onShowLine }: { line: number; onShowLine: (line: number) => void }) {
  return (
    <Button size="sm" icon="arrowRight" onPress={() => onShowLine(line)}>
      {hu.play.showLine(line)}
    </Button>
  );
}

function blockedContent(blocked: Blocked, actions: ReportActions): Content {
  if (blocked.kind === "engine") {
    return {
      stamp: hu.stamps.error,
      tone: "error",
      title: hu.play.engineCrashTitle,
      body: <p>{hu.play.engineCrashBody}</p>,
    };
  }
  if (blocked.kind === "tooLong") {
    return {
      stamp: hu.stamps.blocked,
      tone: "error",
      title: hu.play.tooLongTitle,
      body: <p>{hu.play.tooLong(formatCount(blocked.length), formatCount(PROGRAM_MAX_CHARS))}</p>,
    };
  }
  const lines = errorLinesOf(blocked.diagnostics);
  const first = lines[0] ?? 1;
  return {
    stamp: hu.stamps.blocked,
    tone: "error",
    title: hu.play.syntaxErrorTitle,
    body: (
      <>
        <p>{hu.play.syntaxErrorLines(lines)}</p>
        <div className="report-actions">
          <ShowLine line={first} onShowLine={actions.onShowLine} />
        </div>
      </>
    ),
  };
}

function runtimeContent(result: RunResult, isLimit: boolean, actions: ReportActions): Content {
  if (result.outcome.kind !== "runtimeError") {
    return { stamp: hu.stamps.error, tone: "error", title: "", body: null };
  }
  const { code, line } = result.outcome;
  const explanation = runtimeErrors[code];
  return {
    stamp: isLimit ? hu.stamps.limit : hu.stamps.error,
    tone: "error",
    title: <code className="report-code">{hu.play.runtimeErrorTitle(code, line)}</code>,
    body: (
      <>
        <p>
          <strong>{explanation.title}.</strong> {explanation.hint}
        </p>
        <div className="report-actions">
          <ShowLine line={line} onShowLine={actions.onShowLine} />
          {code === "E_BEDROCK_HIT" && actions.onInsertGuard ? (
            <Button size="sm" icon="plus" onPress={() => actions.onInsertGuard?.(line)}>
              {hu.play.insertGuard(line)}
            </Button>
          ) : null}
        </div>
      </>
    ),
  };
}

function reportContent(props: ShiftReportProps): Content {
  const { kind, result, blocked, reachableGold } = props;
  if ((kind === "blocked" || kind === "crash") && blocked) {
    return blockedContent(blocked, props);
  }
  if (kind === "stopped") {
    return {
      stamp: hu.stamps.stopped,
      tone: "neutral",
      title: hu.play.stoppedTitle,
      body: <p>{hu.play.stoppedBody}</p>,
    };
  }
  if ((kind === "error" || kind === "limit") && result) {
    return runtimeContent(result, kind === "limit", props);
  }
  const gold = result?.gold ?? 0;
  const isTreasure = gold > 0 && gold >= reachableGold;
  return {
    stamp: isTreasure ? hu.stamps.treasure : hu.stamps.ok,
    tone: "ok",
    title: hu.play.finishedTitle,
    body: (
      <>
        <p>{hu.play.finishedBody(gold, result?.steps ?? 0)}</p>
        {isTreasure ? <p className="report-reward">{hu.play.allGold}</p> : null}
      </>
    ),
  };
}

export function ShiftReport(props: ShiftReportProps) {
  const content = reportContent(props);
  const isUrgent = props.kind === "blocked" || props.kind === "crash";
  return (
    <div
      ref={props.ref}
      tabIndex={-1}
      role={isUrgent ? "alert" : "status"}
      className="report"
      data-tone={content.tone}
      data-kind={props.kind}
    >
      <span className="report-stamp" aria-hidden="true">
        <PixelText text={content.stamp} scale={2} />
      </span>
      <p className="report-title">{content.title}</p>
      <div className="report-body">{content.body}</div>
      {props.extra}
      {props.footer ? <div className="report-footer">{props.footer}</div> : null}
    </div>
  );
}

type SubmissionLineProps = { submission: Submission | null; onRetry: () => void };

export function SubmissionLine({ submission, onRetry }: SubmissionLineProps) {
  if (submission === null || submission.state === "pending") {
    return <Led state="busy" label={hu.play.submitting} isBlinking isSentenceCase />;
  }
  if (submission.state === "done") {
    return (
      <Led state="ok" label={hu.play.submitted(submission.gold, submission.steps)} isSentenceCase />
    );
  }
  return (
    <div className="report-actions">
      <Led state="error" label={submission.message} isSentenceCase />
      <Button size="sm" icon="rewind" onPress={onRetry}>
        {hu.play.submitRetry}
      </Button>
    </div>
  );
}
