import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotFound, RouteError } from "../../src/app/StatusScreens.tsx";
import { createQueryClient } from "../../src/lib/query.ts";
import { routeTree } from "../../src/routeTree.gen.ts";
import { installApi, respond } from "./api.ts";
import { adminUser, demoUser } from "./fixtures.ts";

type Session = "demo" | "admin" | "none";

export function signIn(session: Session): void {
  if (session === "none") {
    respond(
      "GET",
      "/auth/me",
      { error: { code: "UNAUTHENTICATED", message: "Jelentkezz be." } },
      401,
    );
    return;
  }
  respond("GET", "/auth/me", { user: session === "admin" ? adminUser : demoUser });
}

export function renderApp(path: string, session: Session = "demo") {
  installApi();
  signIn(session);
  const queryClient = createQueryClient();
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [path] }),
    defaultNotFoundComponent: NotFound,
    defaultErrorComponent: RouteError,
  });
  const user = userEvent.setup();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, router, queryClient, user };
}
