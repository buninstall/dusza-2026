import { useQuery } from "@tanstack/react-query";
import { Loading } from "../app/StatusScreens.tsx";
import type { SessionUser } from "../auth/session.ts";
import { LocationPlate } from "../components/LocationPlate.tsx";
import { Notice } from "../components/Notice.tsx";
import { Link } from "../components/ui/Link.tsx";
import { Select } from "../components/ui/Select.tsx";
import { hu } from "../i18n/hu.ts";
import { errorMessage } from "../lib/api.ts";
import { type Leaderboard, leaderboardQuery, mapQuery } from "../maps/queries.ts";
import { MapPreview } from "../mine/MapPreview.tsx";
import { mapRows } from "../mine/map-preview.ts";
import "./LeaderboardPage.css";
import { ownEntry, ScoreBoard } from "./ScoreBoard.tsx";

type LeaderboardPageProps = {
  mapId: number;
  versionId: number | undefined;
  user: SessionUser;
  onVersionChange: (versionId: number) => void;
};

function versionOf(data: Leaderboard, versionId: number): number {
  return data.versions.find((item) => item.id === versionId)?.version ?? 1;
}

function mapFacts(content: string, version: number): string {
  const rows = mapRows(content);
  const cols = Math.max(0, ...rows.map((row) => row.length));
  const gold = rows.join("").split("@").length - 1;
  return `${hu.maps.size(rows.length, cols)} · ${hu.leaderboard.goldCount(gold)} · ${hu.maps.version(version)}`;
}

function SideColumn({
  mapId,
  data,
  user,
}: {
  mapId: number;
  data: Leaderboard;
  user: SessionUser;
}) {
  const { data: detail } = useQuery(mapQuery(mapId));
  const isOld = data.versionId !== data.currentVersionId;
  const version = versionOf(data, data.versionId);
  const mine = ownEntry(data.entries, user);
  return (
    <aside className="lb-side" aria-label={hu.leaderboard.sideLabel}>
      {isOld ? (
        <p className="lb-old-plate">{hu.leaderboard.olderVersion(version)}</p>
      ) : detail ? (
        <>
          <MapPreview content={detail.version.content} box={224} className="lb-preview" />
          <p className="lb-facts mono">{mapFacts(detail.version.content, version)}</p>
        </>
      ) : null}
      <section className="lb-side-block">
        <h2 className="label">{hu.leaderboard.yourBest}</h2>
        {mine ? (
          <p>
            <strong className="lb-best-rank">{hu.leaderboard.rankOf(mine.rank)}</strong>
            <span className="mono">{hu.leaderboard.summary(mine.gold, mine.steps)}</span>
          </p>
        ) : (
          <p className="lb-muted">{hu.leaderboard.noOwnRun}</p>
        )}
      </section>
      <section className="lb-side-block">
        <h2 className="label">{hu.leaderboard.ruleHeading}</h2>
        <p className="lb-muted">{hu.leaderboard.rule}</p>
      </section>
    </aside>
  );
}

function PlayLink({ mapId }: { mapId: number }) {
  return (
    <Link to="/play/$mapId" params={{ mapId: String(mapId) }} variant="primary" icon="play">
      {hu.leaderboard.play}
    </Link>
  );
}

export function LeaderboardPage({ mapId, versionId, user, onVersionChange }: LeaderboardPageProps) {
  const { data, error } = useQuery(leaderboardQuery(mapId, versionId));
  const versionOptions =
    data?.versions.map((item) => ({
      id: String(item.id),
      label:
        item.id === data.currentVersionId
          ? `${hu.maps.versionLong(item.version)} (${hu.leaderboard.current})`
          : hu.maps.versionLong(item.version),
    })) ?? [];

  return (
    <div className="lb-page">
      <LocationPlate
        name={hu.signs.leaderboard}
        detail={data?.title}
        headingPrefix={hu.leaderboard.headingPrefix}
        documentTitle={data ? `${hu.signs.leaderboard} – ${data.title}` : hu.signs.leaderboard}
        lead={
          <Link to="/maps" variant="ghost" size="sm" icon="arrowLeft">
            {hu.leaderboard.back}
          </Link>
        }
        actions={
          <>
            {data && versionOptions.length > 1 ? (
              <Select
                label={hu.leaderboard.version}
                isLabelHidden
                value={String(data.versionId)}
                options={versionOptions}
                onChange={(next) => onVersionChange(Number(next))}
              />
            ) : null}
            <PlayLink mapId={mapId} />
          </>
        }
      />
      {error ? (
        <Notice tone="error" title={errorMessage(error, hu.app.unexpected)} live="alert" />
      ) : null}
      {data ? (
        <div className="lb-layout">
          <SideColumn mapId={mapId} data={data} user={user} />
          <div className="lb-main">
            {data.versionId === data.currentVersionId ? null : (
              <Notice
                tone="info"
                title={hu.leaderboard.oldVersionNotice(versionOf(data, data.versionId))}
              />
            )}
            <ScoreBoard
              data={data}
              version={versionOf(data, data.versionId)}
              user={user}
              playAction={<PlayLink mapId={mapId} />}
            />
          </div>
        </div>
      ) : null}
      {!data && !error ? <Loading /> : null}
    </div>
  );
}
