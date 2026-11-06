import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import type { CSSProperties } from "react";
import { Loading } from "../app/StatusScreens.tsx";
import type { SessionUser } from "../auth/session.ts";
import "../components/DataTable.css";
import { Notice } from "../components/Notice.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { Link } from "../components/ui/Link.tsx";
import { Select } from "../components/ui/Select.tsx";
import { formatTime, hu } from "../i18n/hu.ts";
import { errorMessage } from "../lib/api.ts";
import { type Leaderboard, leaderboardQuery } from "../maps/queries.ts";
import "./LeaderboardPage.css";

type LeaderboardPageProps = {
  mapId: number;
  versionId: number | undefined;
  user: SessionUser;
  onVersionChange: (versionId: number) => void;
};

const PODIUM = 3;

type Entry = Leaderboard["entries"][number];

function GoldBar({ gold, best }: { gold: number; best: number }) {
  const share = { "--share": best > 0 ? gold / best : 0 } as CSSProperties;
  return (
    <span className="lb-gold-cell">
      <span className="lb-gold-bar" style={share} aria-hidden="true" />
      <span className="data-table-number">{gold}</span>
    </span>
  );
}

function EntryRow({ entry, best, isMe }: { entry: Entry; best: number; isMe: boolean }) {
  return (
    <tr className={clsx(isMe && "lb-me")} data-podium={entry.rank <= PODIUM}>
      <td className="lb-rank">
        <span className="lb-rank-plate">{entry.rank}.</span>
      </td>
      <th scope="row" className="lb-player">
        {entry.username}
        {isMe ? <span className="data-table-tag">{hu.leaderboard.you}</span> : null}
      </th>
      <td>
        <GoldBar gold={entry.gold} best={best} />
      </td>
      <td className="data-table-number">{entry.steps}</td>
      <td className="data-table-muted">
        {entry.outcomeKind === "ok" ? hu.leaderboard.outcomeOk : hu.leaderboard.outcomeError}
      </td>
      <td className="data-table-muted">{formatTime(entry.createdAt)}</td>
    </tr>
  );
}

function Board({ data, user }: { data: Leaderboard; user: SessionUser }) {
  const version = data.versions.find((item) => item.id === data.versionId)?.version ?? 1;
  if (data.entries.length === 0) {
    return <Notice tone="info" title={hu.leaderboard.empty} />;
  }
  const best = data.entries[0]?.gold ?? 0;
  return (
    <div className="data-table">
      <table className="data-table-grid">
        <caption className="visually-hidden">
          {hu.leaderboard.tableLabel(data.title, version)}
        </caption>
        <thead>
          <tr>
            <th scope="col">{hu.leaderboard.rank}</th>
            <th scope="col">{hu.leaderboard.player}</th>
            <th scope="col">{hu.leaderboard.gold}</th>
            <th scope="col" className="data-table-number">
              {hu.leaderboard.steps}
            </th>
            <th scope="col">{hu.leaderboard.outcome}</th>
            <th scope="col">{hu.leaderboard.when}</th>
          </tr>
        </thead>
        <tbody>
          {data.entries.map((entry) => (
            <EntryRow key={entry.runId} entry={entry} best={best} isMe={entry.userId === user.id} />
          ))}
        </tbody>
      </table>
    </div>
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
      <PageHeader
        eyebrow={hu.leaderboard.eyebrow}
        title={data ? hu.leaderboard.title(data.title) : hu.leaderboard.eyebrow}
        lead={hu.leaderboard.lead}
        actions={
          <>
            {data && versionOptions.length > 1 ? (
              <Select
                label={hu.leaderboard.version}
                value={String(data.versionId)}
                options={versionOptions}
                onChange={(next) => onVersionChange(Number(next))}
              />
            ) : null}
            <Link to="/play/$mapId" params={{ mapId: String(mapId) }} variant="primary" icon="play">
              {hu.leaderboard.play}
            </Link>
          </>
        }
      />
      {error ? (
        <Notice tone="error" title={errorMessage(error, hu.app.unexpected)} live="alert" />
      ) : null}
      {data ? <Board data={data} user={user} /> : null}
      {!data && !error ? <Loading /> : null}
    </div>
  );
}
