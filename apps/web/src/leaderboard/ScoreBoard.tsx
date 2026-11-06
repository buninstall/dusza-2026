import { type ReactNode, type Ref, useEffect, useState } from "react";
import type { SessionUser } from "../auth/session.ts";
import "../components/DataTable.css";
import { EmptyState } from "../components/EmptyState.tsx";
import { Button } from "../components/ui/Button.tsx";
import { formatTime, hu } from "../i18n/hu.ts";
import type { Leaderboard } from "../maps/queries.ts";

export type Entry = Leaderboard["entries"][number];

const PODIUM = 3;
const SEGMENTS = 10;

function GoldSegments({ gold, best }: { gold: number; best: number }) {
  const lit = best > 0 ? Math.round((gold / best) * SEGMENTS) : 0;
  return (
    <span className="lb-gold">
      <span className="lb-segments" aria-hidden="true">
        {Array.from({ length: SEGMENTS }, (_, index) => (
          <span
            key={`s${index.toString()}`}
            className="lb-segment"
            data-lit={index < lit}
            style={{ animationDelay: `${(index * 30).toString()}ms` }}
          />
        ))}
      </span>
      <span className="data-table-number">{gold}</span>
    </span>
  );
}

type EntryRowProps = {
  entry: Entry;
  best: number;
  isMe: boolean;
  meRef?: Ref<HTMLTableCellElement>;
};

function EntryRow({ entry, best, isMe, meRef }: EntryRowProps) {
  const outcome =
    entry.outcomeKind === "ok" ? hu.leaderboard.outcomeOk : hu.leaderboard.outcomeError;
  const time = formatTime(entry.createdAt);
  return (
    <tr className="lb-row" data-me={isMe} data-podium={entry.rank <= PODIUM}>
      <td className="lb-rank">
        <span className="lb-rank-plate">{entry.rank}.</span>
      </td>
      <th
        scope="row"
        className="lb-player"
        ref={meRef}
        tabIndex={isMe ? -1 : undefined}
        data-sub={hu.leaderboard.subLine(outcome, time)}
      >
        {entry.username}
        {isMe ? <span className="data-table-tag">{hu.leaderboard.you}</span> : null}
      </th>
      <td>
        <GoldSegments gold={entry.gold} best={best} />
      </td>
      <td className="data-table-number">{entry.steps}</td>
      <td className="data-table-muted lb-wide">{outcome}</td>
      <td className="data-table-muted lb-wide">{time}</td>
    </tr>
  );
}

function useOutOfView(target: HTMLElement | null): boolean {
  const [isOut, setOut] = useState(false);
  useEffect(() => {
    if (!target || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver(([record]) => setOut(!record?.isIntersecting));
    observer.observe(target);
    return () => observer.disconnect();
  }, [target]);
  return isOut;
}

export function ownEntry(entries: readonly Entry[], user: SessionUser): Entry | undefined {
  return entries.find((entry) => entry.userId === user.id);
}

function MyPlace({ entry, onJump }: { entry: Entry; onJump: () => void }) {
  return (
    <div className="lb-my-place">
      <p>
        <strong>{hu.leaderboard.yourPlace(entry.rank)}</strong>{" "}
        {hu.leaderboard.summary(entry.gold, entry.steps)}
      </p>
      <Button size="sm" icon="arrowDown" onPress={onJump}>
        {hu.leaderboard.jumpToMine}
      </Button>
    </div>
  );
}

type ScoreBoardProps = {
  data: Leaderboard;
  version: number;
  user: SessionUser;
  playAction: ReactNode;
};

export function ScoreBoard({ data, version, user, playAction }: ScoreBoardProps) {
  const [meCell, setMeCell] = useState<HTMLTableCellElement | null>(null);
  const isMeHidden = useOutOfView(meCell);
  const mine = ownEntry(data.entries, user);
  if (data.entries.length === 0) {
    return (
      <div className="lb-board" data-empty="true">
        <EmptyState text={hu.leaderboard.empty} action={playAction} />
      </div>
    );
  }
  const best = data.entries[0]?.gold ?? 0;
  const jump = () => {
    meCell?.scrollIntoView({ block: "center" });
    meCell?.focus();
  };
  return (
    <div className="lb-board">
      <div className="data-table lb-table">
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
              <th scope="col" className="lb-wide">
                {hu.leaderboard.outcome}
              </th>
              <th scope="col" className="lb-wide">
                {hu.leaderboard.when}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.entries.map((entry) => (
              <EntryRow
                key={entry.runId}
                entry={entry}
                best={best}
                isMe={entry.userId === user.id}
                {...(entry.userId === user.id ? { meRef: setMeCell } : {})}
              />
            ))}
          </tbody>
        </table>
      </div>
      {mine && isMeHidden ? <MyPlace entry={mine} onJump={jump} /> : null}
    </div>
  );
}
