import { createFileRoute } from "@tanstack/react-router";
import { withEngine } from "../../../engine/EngineProvider.tsx";
import { ManualPage } from "../../../manual/ManualPage.tsx";

export const Route = createFileRoute("/_app/manual/")({
  component: withEngine(ManualPage),
});
