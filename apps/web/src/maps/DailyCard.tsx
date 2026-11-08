import { useQuery } from "@tanstack/react-query";
import { Notice } from "../components/Notice.tsx";
import { Link } from "../components/ui/Link.tsx";
import { hu } from "../i18n/hu.ts";
import { browse } from "../i18n/hu-browse.ts";
import { errorMessage } from "../lib/api.ts";
import { MapPreview } from "../mine/MapPreview.tsx";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
import { dayLabel } from "./daily-clock.ts";
import { MapFacts, Progress } from "./LevelTile.tsx";
import { dailyQuery } from "./queries.ts";

export function DailyCard() {
  const { data, error } = useQuery(dailyQuery());
  if (error) {
    return <Notice tone="warning" title={errorMessage(error, hu.daily.loadFailed)} />;
  }
  if (!data) {
    return null;
  }
  const { map } = data;
  const mapId = String(map.id);
  const day = dayLabel(data.date);
  return (
    <section className="daily" data-mine="daily" aria-labelledby="daily-heading">
      <div className="daily-window" data-mine-pit="">
        <MapPreview content={map.content} box={84} isFitted />
      </div>
      <div className="daily-body">
        <h2 className="daily-head">
          <PixelIcon name="calendar" />
          <span id="daily-heading">{hu.daily.heading}</span>
          {day ? <span className="daily-day">{day}</span> : null}
        </h2>
        <MapFacts map={map} author={browse.dailyAuthor} />
        <Progress map={map} />
      </div>
      <div className="lv-actions">
        <Link
          to="/play/$mapId"
          params={{ mapId }}
          variant="primary"
          icon="play"
          className="lv-play"
          aria-label={hu.daily.play}
        >
          {hu.maps.play}
        </Link>
        <Link
          to="/leaderboard/$mapId"
          params={{ mapId }}
          variant="secondary"
          size="sm"
          icon="trophy"
          aria-label={hu.daily.leaderboard}
        >
          {hu.maps.leaderboard}
        </Link>
        <span className="lv-action-slot" aria-hidden="true" />
      </div>
    </section>
  );
}
