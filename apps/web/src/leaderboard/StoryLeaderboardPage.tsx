import { useQuery } from "@tanstack/react-query";
import { Loading } from "../app/StatusScreens.tsx";
import type { SessionUser } from "../auth/session.ts";
import "../components/DataTable.css";
import { EmptyState } from "../components/EmptyState.tsx";
import { LoadFailed } from "../components/LoadFailed.tsx";
import { LocationPlate } from "../components/LocationPlate.tsx";
import { Link } from "../components/ui/Link.tsx";
import { hu } from "../i18n/hu.ts";
import { CHAPTERS, story } from "../i18n/hu-story.ts";
import { type StoryBoard, storyBoardQuery } from "../maps/queries.ts";
import "./LeaderboardPage.css";

const PODIUM = 3;

function chapterNumeral(chapter: number): string {
  return CHAPTERS[chapter - 1]?.numeral ?? String(chapter);
}

function BoardTable({ data, user }: { data: StoryBoard; user: SessionUser }) {
  return (
    <div className="data-table">
      <table className="data-table-grid lb-table">
        <caption className="visually-hidden">{story.leaderboardCaption}</caption>
        <thead>
          <tr>
            <th scope="col">{story.columns.rank}</th>
            <th scope="col">{story.columns.player}</th>
            <th scope="col" className="data-table-number">
              {story.columns.nuggets}
            </th>
            <th scope="col">{story.columns.chapters}</th>
            <th scope="col" className="data-table-number">
              {story.columns.gold}
            </th>
            <th scope="col" className="data-table-number">
              {story.columns.steps}
            </th>
          </tr>
        </thead>
        <tbody>
          {data.entries.map((entry) => {
            const isMe = entry.userId === user.id;
            return (
              <tr
                key={entry.userId}
                className="lb-row"
                data-me={isMe}
                data-podium={entry.rank <= PODIUM}
              >
                <td className="lb-rank">
                  <span className="lb-rank-plate">{entry.rank}.</span>
                </td>
                <th scope="row" className="lb-player">
                  {entry.username}
                  {isMe ? <span className="data-table-tag">{hu.leaderboard.you}</span> : null}
                </th>
                <td className="data-table-number">{story.nuggets(entry.stars, data.maxStars)}</td>
                <td>{story.chapterReached(chapterNumeral(entry.chapter))}</td>
                <td className="data-table-number">{entry.gold}</td>
                <td className="data-table-number">{entry.steps}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function StoryLeaderboardPage({ user }: { user: SessionUser }) {
  const { data, error, isPending, refetch } = useQuery(storyBoardQuery());
  return (
    <div className="lb-page">
      <LocationPlate
        name={story.leaderboardTitle}
        lead={
          <Link to="/maps" search={{ mode: "story" }} variant="ghost" size="sm" icon="arrowLeft">
            {story.backToStory}
          </Link>
        }
      />
      <p className="lb-story-lead">{story.leaderboardLead}</p>
      {error ? (
        <LoadFailed
          error={error}
          fallback={story.leaderboardEmpty}
          onRetry={() => void refetch()}
        />
      ) : isPending ? (
        <Loading />
      ) : data.entries.length === 0 ? (
        <EmptyState text={story.leaderboardEmpty} />
      ) : (
        <BoardTable data={data} user={user} />
      )}
    </div>
  );
}
