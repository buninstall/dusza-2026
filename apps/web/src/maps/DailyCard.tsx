import { useQuery } from "@tanstack/react-query";
import { Notice } from "../components/Notice.tsx";
import { Link } from "../components/ui/Link.tsx";
import { hu } from "../i18n/hu.ts";
import { errorMessage } from "../lib/api.ts";
import { MapPreview } from "../mine/MapPreview.tsx";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
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
  return (
    <section className="daily" data-mine="daily" aria-labelledby="daily-heading">
      <div className="daily-window" data-mine-pit="">
        <MapPreview content={map.content} box={120} />
      </div>
      <div className="daily-body">
        <h2 id="daily-heading" className="daily-head">
          <PixelIcon name="calendar" />
          {hu.daily.heading}
        </h2>
        <MapFacts map={map} />
        <Progress map={map} />
      </div>
      <div className="daily-actions">
        <Link to="/play/$mapId" params={{ mapId }} variant="primary" icon="play">
          {hu.daily.play}
        </Link>
        <Link
          to="/leaderboard/$mapId"
          params={{ mapId }}
          variant="secondary"
          size="sm"
          icon="trophy"
        >
          {hu.daily.leaderboard}
        </Link>
      </div>
    </section>
  );
}
