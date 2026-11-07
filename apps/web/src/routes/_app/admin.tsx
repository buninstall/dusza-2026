import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { AdminPage } from "../../admin/AdminPage.tsx";

const MAX_PAGE = 100_000;
const SEARCH_MAX = 24;

const searchSchema = z.object({
  page: z.coerce.number().int().min(1).max(MAX_PAGE).default(1).catch(1),
  q: z
    .string()
    .transform((value) => value.trim().slice(0, SEARCH_MAX))
    .default("")
    .catch(""),
});

function AdminRoute() {
  const { user } = Route.useRouteContext();
  const { page, q } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <AdminPage
      me={user}
      page={page}
      q={q}
      onPageChange={(next) => {
        void navigate({ search: (prev) => ({ ...prev, page: next }) });
        document.getElementById("main")?.focus({ preventScroll: true });
        window.scrollTo({ top: 0 });
      }}
      onSearch={(next) =>
        void navigate({
          search: (prev) => ({ ...prev, q: next, page: 1 }),
          replace: true,
          resetScroll: false,
        })
      }
    />
  );
}

export const Route = createFileRoute("/_app/admin")({
  validateSearch: searchSchema,
  beforeLoad: ({ context }) => {
    if (context.user.role !== "admin") {
      throw redirect({ to: "/maps" });
    }
  },
  component: AdminRoute,
});
