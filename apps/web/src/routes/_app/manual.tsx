import { createFileRoute } from "@tanstack/react-router";
import { ManualPage } from "../../manual/ManualPage.tsx";

export const Route = createFileRoute("/_app/manual")({
  component: ManualPage,
});
