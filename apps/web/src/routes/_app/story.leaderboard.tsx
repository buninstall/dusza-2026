import { createFileRoute } from "@tanstack/react-router";
import { StoryLeaderboardPage } from "../../leaderboard/StoryLeaderboardPage.tsx";

function StoryLeaderboardRoute() {
  const { user } = Route.useRouteContext();
  return <StoryLeaderboardPage user={user} />;
}

export const Route = createFileRoute("/_app/story/leaderboard")({
  component: StoryLeaderboardRoute,
});
