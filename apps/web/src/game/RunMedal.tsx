import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { IconButton } from "../components/ui/IconButton.tsx";
import { Link } from "../components/ui/Link.tsx";
import { hu } from "../i18n/hu.ts";
import { mapsQuery } from "../maps/queries.ts";
import { sortMaps } from "../maps/sort.ts";
import { usePlayback } from "../play/playback-store.ts";
import type { Submission } from "../play/useRunSession.ts";
import { MAX_STARS, StarRow } from "./StarRow.tsx";
import "./RunMedal.css";

type RunMedalProps = {
  mapId: number;
  submission: Submission | null;
  reachableGold: number;
  isDaily: boolean;
};

function useNextMap(mapId: number, isDaily: boolean) {
  const { data } = useQuery({ ...mapsQuery("all"), enabled: !isDaily });
  if (!data || isDaily) {
    return null;
  }
  const ordered = sortMaps(data.maps, "order");
  const position = ordered.findIndex((map) => map.id === mapId);
  return position === -1 ? null : (ordered[position + 1] ?? null);
}

export function RunMedal({ mapId, submission, reachableGold, isDaily }: RunMedalProps) {
  const headingId = useId();
  const next = useNextMap(mapId, isDaily);
  const runId = usePlayback((state) => state.runId);
  const isAtEnd = usePlayback(
    (state) => state.status === "finished" && state.index === (state.result?.events.length ?? -1),
  );
  const [dismissedRun, setDismissedRun] = useState(0);
  const stars = submission?.state === "done" ? (submission.standing?.stars ?? null) : null;
  if (!stars || !isAtEnd || dismissedRun === runId) {
    return null;
  }
  const gained = Math.max(stars.best - stars.previous, 0);
  const hint =
    stars.run >= MAX_STARS
      ? hu.game.allStars
      : hu.game.nextStar(stars.run, stars.parSteps, reachableGold);
  return (
    <aside className="medal" aria-labelledby={headingId} data-gained={gained > 0}>
      <div className="medal-head">
        <h2 id={headingId} className="medal-title">
          {hu.game.medalTitle}
        </h2>
        <IconButton
          icon="close"
          label={hu.common.close}
          variant="ghost"
          size="sm"
          onPress={() => setDismissedRun(runId)}
        />
      </div>
      <div className="medal-stars" role="status">
        <StarRow stars={stars.run} previous={stars.previous} size="lg" isAnimated />
        {gained > 0 ? <span className="medal-new">{hu.game.newStar(gained)}</span> : null}
      </div>
      <p className="medal-hint">{hint}</p>
      {next ? (
        <Link
          to="/play/$mapId"
          params={{ mapId: String(next.id) }}
          variant={stars.run >= 2 ? "primary" : "secondary"}
          size="sm"
          icon="arrowRight"
          aria-label={hu.game.nextMapFor(next.title)}
          className="medal-next"
        >
          {hu.game.nextMap}
        </Link>
      ) : null}
    </aside>
  );
}
