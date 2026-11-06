import type { DiagCode, Diagnostic } from "@minescript/engine";
import { hu } from "../../i18n/hu.ts";
import type { TipId } from "../play-ui-store.ts";

const SPACING_CODES: ReadonlySet<DiagCode> = new Set<DiagCode>([
  "SYN_TAB",
  "SYN_DOUBLE_SPACE",
  "SYN_TRAILING_SPACE",
  "SYN_EMPTY_LINE",
  "SYN_TOPLEVEL_INDENT",
  "SYN_UNEXPECTED_INDENT",
  "SYN_INCONSISTENT_INDENT",
  "SYN_DEDENT_MISMATCH",
]);

export type TipAction =
  | "firstError"
  | "format"
  | "showEmptyBlock"
  | "openRobot"
  | "fullMap"
  | "leaderboard";

export type Tip = { id: TipId; text: string; action: TipAction | null; actionLabel: string | null };

export type LastRun = { isOk: boolean; gold: number; isCurrentSource: boolean };

export type TipContext = {
  isActive: boolean;
  diagnostics: readonly Diagnostic[];
  isEmpty: boolean;
  wasRefused: boolean;
  isBlockedTipHidden: boolean;
  hasRunOnce: boolean;
  lastRun: LastRun | null;
  reachableGold: number;
  dismissed: readonly TipId[];
};

type Candidate = {
  id: TipId;
  matches: (ctx: TipContext) => boolean;
  build: (ctx: TipContext) => Tip;
};

const hasErrors = (ctx: TipContext) =>
  ctx.diagnostics.some((diagnostic) => diagnostic.severity === "error");

const isFreshSuccess = (ctx: TipContext): boolean =>
  Boolean(ctx.lastRun?.isOk && ctx.lastRun.isCurrentSource);

function tip(id: TipId, text: string, action: TipAction | null, actionLabel: string | null): Tip {
  return { id, text, action, actionLabel };
}

const CANDIDATES: readonly Candidate[] = [
  {
    id: "blocked",
    matches: (ctx) => ctx.wasRefused && !ctx.isBlockedTipHidden && hasErrors(ctx),
    build: () => tip("blocked", hu.tips.blocked, "firstError", hu.tips.blockedAction),
  },
  {
    id: "spacing",
    matches: (ctx) => ctx.diagnostics.some((diagnostic) => SPACING_CODES.has(diagnostic.code)),
    build: () => tip("spacing", hu.tips.spacing, "format", hu.tips.spacingAction),
  },
  {
    id: "emptyBlock",
    matches: (ctx) => ctx.diagnostics.some((diagnostic) => diagnostic.code === "LINT_EMPTY_BLOCK"),
    build: () => tip("emptyBlock", hu.tips.emptyBlock, "showEmptyBlock", hu.tips.emptyBlockAction),
  },
  {
    id: "empty",
    matches: (ctx) => ctx.isEmpty,
    build: () => tip("empty", hu.tips.empty, "openRobot", hu.tips.emptyAction),
  },
  {
    id: "firstRun",
    matches: (ctx) => !ctx.hasRunOnce && !hasErrors(ctx),
    build: () => tip("firstRun", hu.tips.firstRun, null, null),
  },
  {
    id: "goldLeft",
    matches: (ctx) => isFreshSuccess(ctx) && (ctx.lastRun?.gold ?? 0) < ctx.reachableGold,
    build: (ctx) =>
      tip(
        "goldLeft",
        hu.tips.goldLeft(ctx.reachableGold - (ctx.lastRun?.gold ?? 0)),
        "fullMap",
        hu.tips.goldLeftAction,
      ),
  },
  {
    id: "optimise",
    matches: (ctx) =>
      isFreshSuccess(ctx) && ctx.reachableGold > 0 && (ctx.lastRun?.gold ?? 0) >= ctx.reachableGold,
    build: () => tip("optimise", hu.tips.optimise, "leaderboard", hu.tips.optimiseAction),
  },
];

export function pickTip(ctx: TipContext): Tip | null {
  if (ctx.isActive) {
    return null;
  }
  const match = CANDIDATES.find(
    (candidate) =>
      (candidate.id === "blocked" || !ctx.dismissed.includes(candidate.id)) &&
      candidate.matches(ctx),
  );
  return match ? match.build(ctx) : null;
}
