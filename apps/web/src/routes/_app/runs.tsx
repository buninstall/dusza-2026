import { createFileRoute } from "@tanstack/react-router";
import { MyRunsPage } from "../../runs/MyRunsPage.tsx";

export const Route = createFileRoute("/_app/runs")({
  component: MyRunsPage,
});
