import "./styles/index.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { NotFound, RouteError } from "./app/StatusScreens.tsx";
import { sessionQuery } from "./auth/session.ts";
import { preloadEngine } from "./engine/EngineProvider.tsx";
import { applyCursor, initialCursor } from "./lib/cursor.ts";
import { clearPersistedQueries, createQueryClient, persistQueries } from "./lib/query.ts";
import { keepScrollbarGap } from "./lib/scrollbar-gap.ts";
import { applyTheme } from "./lib/theme.ts";
import { startPixelClock } from "./pixel/pixel-clock.ts";
import { routeTree } from "./routeTree.gen.ts";

const SIGNED_OUT_PATHS = new Set(["/login", "/register"]);

const queryClient = createQueryClient(() => {
  queryClient.setQueryData(sessionQuery.queryKey, null);
  clearPersistedQueries();
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
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

applyTheme();
startPixelClock();
persistQueries(queryClient);
applyCursor(initialCursor());
keepScrollbarGap();

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

const idle = window.requestIdleCallback ?? ((run: () => void) => window.setTimeout(run, 400));
idle(() => preloadEngine());
