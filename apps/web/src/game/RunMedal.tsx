import { useQuery } from "@tanstack/react-query";
import { type CSSProperties, useEffect, useId, useState } from "react";
import { IconButton } from "../components/ui/IconButton.tsx";
import { Link } from "../components/ui/Link.tsx";
import { hu } from "../i18n/hu.ts";
import { mapQuery } from "../maps/queries.ts";
import { usePlayback } from "../play/playback-store.ts";
import type { Submission } from "../play/useRunSession.ts";
import { playCue } from "../sound/sfx.ts";
import { MAX_NUGGETS, NuggetRow } from "./NuggetRow.tsx";
import "./RunMedal.css";

const STAR_CUE_DELAY_MS = 1100;
const CONFETTI_START_MS = 1000;

type RunMedalProps = {
  mapId: number;
  submission: Submission | null;
  reachableGold: number;
  isDaily: boolean;
};

const CONFETTI: readonly { x: number; drift: number; tone: string; delay: number }[] = [
  { x: 8, drift: -18, tone: "ore", delay: 0 },
  { x: 16, drift: 10, tone: "gem", delay: 60 },
  { x: 24, drift: -6, tone: "lamp", delay: 120 },
  { x: 32, drift: 14, tone: "ore", delay: 30 },
  { x: 40, drift: -12, tone: "gem", delay: 150 },
  { x: 48, drift: 8, tone: "ore", delay: 90 },
  { x: 56, drift: -16, tone: "lamp", delay: 40 },
  { x: 64, drift: 12, tone: "ore", delay: 180 },
  { x: 72, drift: -8, tone: "gem", delay: 110 },
  { x: 80, drift: 16, tone: "ore", delay: 70 },
];

function MedalConfetti() {
  return (
    <span aria-hidden="true" className="medal-confetti">
      {CONFETTI.map((bit) => (
        <span
          key={`${bit.x.toString()}-${bit.tone}`}
          className="medal-bit"
          data-tone={bit.tone}
          style={
            {
              "--x": `${bit.x}%`,
              "--drift": `${bit.drift}px`,
              "--delay": `${bit.delay + CONFETTI_START_MS}ms`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}

function useNextMap(mapId: number, isDaily: boolean) {
  const { data } = useQuery({ ...mapQuery(mapId), enabled: !isDaily });
  return isDaily ? null : (data?.next ?? null);
}

export function RunMedal({ mapId, submission, reachableGold, isDaily }: RunMedalProps) {
  const headingId = useId();
  const next = useNextMap(mapId, isDaily);
  const runId = usePlayback((state) => state.runId);
  const isAtEnd = usePlayback(
    (state) => state.status === "finished" && state.index === (state.result?.events.length ?? -1),
  );
  const [dismissedRun, setDismissedRun] = useState(0);
  const standing = submission?.state === "done" ? submission.standing : null;
  const stars = standing?.stars ?? null;
  const gainedNow = stars ? Math.max(stars.best - stars.previous, 0) : 0;
  useEffect(() => {
    if (gainedNow === 0 || runId === 0) {
      return;
    }
    const timer = window.setTimeout(() => playCue("star"), STAR_CUE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [gainedNow, runId]);
  if (!stars || stars.run === 0 || !isAtEnd || dismissedRun === runId) {
    return null;
  }
  const gained = gainedNow;
  const hint =
    stars.run >= MAX_NUGGETS
      ? hu.game.allStars(reachableGold)
      : hu.game.nextStar(stars.run, stars.parSteps, reachableGold);
  return (
    <section className="medal" aria-labelledby={headingId} data-gained={gained > 0}>
      <h2 id={headingId} className="visually-hidden">
        {hu.game.medalTitle}
      </h2>
      {gained > 0 ? <MedalConfetti /> : null}
      <div className="medal-stars" role="status">
        <NuggetRow earned={stars.run} previous={stars.previous} size="lg" isAnimated />
        {gained > 0 ? <span className="medal-new">{hu.game.newStar(gained)}</span> : null}
      </div>
      <div className="medal-text">
        {standing ? (
          <p className="medal-rank" data-best={standing.isPersonalBest}>
            {standing.isPersonalBest
              ? hu.play.standingBest(standing.rank, standing.players)
              : hu.play.standingKept(standing.rank, standing.players)}
          </p>
        ) : null}
        <p className="medal-hint">{hint}</p>
      </div>
      <Link
        to="/leaderboard/$mapId"
        params={{ mapId: String(mapId) }}
        variant="ghost"
        size="sm"
        icon="trophy"
      >
        {hu.play.toLeaderboard}
      </Link>
      {next ? (
        <Link
          to="/play/$mapId"
          params={{ mapId: String(next.id) }}
          variant={stars.run >= 2 ? "primary" : "secondary"}
          size="sm"
          icon="arrowRight"
          aria-label={hu.game.nextMapFor(next.title)}
        >
          {hu.game.nextMap}
        </Link>
      ) : null}
      <IconButton
        icon="close"
        label={hu.common.close}
        variant="ghost"
        size="sm"
        onPress={() => setDismissedRun(runId)}
      />
    </section>
  );
}
