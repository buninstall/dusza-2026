import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { MyRunsPage } from "../../../runs/MyRunsPage.tsx";

const searchSchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1).catch(1),
});

function MyRunsRoute() {
  const { page } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <MyRunsPage
      page={page}
      onPageChange={(next) => {
        void navigate({ search: { page: next } });
        document.getElementById("main")?.focus({ preventScroll: true });
        window.scrollTo({ top: 0 });
      }}
    />
  );
}

export const Route = createFileRoute("/_app/runs/")({
  validateSearch: searchSchema,
  component: MyRunsRoute,
});
