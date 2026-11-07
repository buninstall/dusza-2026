import "./styles/index.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Loading, NotFound, RouteError } from "./app/StatusScreens.tsx";
import { sessionQuery } from "./auth/session.ts";
import { applyCursor, initialCursor } from "./lib/cursor.ts";
import { createQueryClient } from "./lib/query.ts";
import { applyTheme, initialTheme } from "./lib/theme.ts";
import { routeTree } from "./routeTree.gen.ts";

const PENDING_MS = 300;

const SIGNED_OUT_PATHS = new Set(["/login", "/register"]);

const queryClient = createQueryClient(() => {
  queryClient.setQueryData(sessionQuery.queryKey, null);
  const { pathname, href } = router.state.location;
  if (!SIGNED_OUT_PATHS.has(pathname)) {
    void router.navigate({ to: "/login", search: { redirect: href } });
  }
});

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
  defaultNotFoundComponent: NotFound,
  defaultErrorComponent: RouteError,
  defaultPendingComponent: () => <Loading />,
  defaultPendingMs: PENDING_MS,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

applyTheme(initialTheme());
applyCursor(initialCursor());

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
}
