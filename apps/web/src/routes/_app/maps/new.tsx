import { createFileRoute } from "@tanstack/react-router";
import { NewMapPage } from "../../../map-editor/MapEditorPages.tsx";

export const Route = createFileRoute("/_app/maps/new")({
  staticData: { layout: "workbench" },
  component: NewMapPage,
});
