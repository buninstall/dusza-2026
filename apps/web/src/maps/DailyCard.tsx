import { useQuery } from "@tanstack/react-query";
import { Notice } from "../components/Notice.tsx";
import { Link } from "../components/ui/Link.tsx";
import { hu } from "../i18n/hu.ts";
import { errorMessage } from "../lib/api.ts";
import { MapPreview } from "../mine/MapPreview.tsx";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
import { Progress } from "./LevelTile.tsx";
import { dailyQuery } from "./queries.ts";

function dayLabel(date: string): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }
  return new Intl.DateTimeFormat("hu-HU", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(parsed);
}

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
    <section className="daily" aria-labelledby="daily-heading">
      <div className="daily-window">
        <MapPreview content={map.content} box={120} />
      </div>
      <div className="daily-body">
        <h2 id="daily-heading" className="daily-head">
          <PixelIcon name="calendar" />
          {hu.daily.heading}
        </h2>
        <p className="daily-meta">
          {hu.daily.meta(dayLabel(data.date))} · {hu.maps.size(map.rows, map.cols)}
        </p>
        <p className="daily-note">{map.description}</p>
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
