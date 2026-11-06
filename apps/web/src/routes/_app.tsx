import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "../app/AppShell.tsx";
import { sessionQuery } from "../auth/session.ts";

function ProtectedLayout() {
  const { user } = Route.useRouteContext();
  return (
    <AppShell user={user}>
      <Outlet />
    </AppShell>
  );
}

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData(sessionQuery);
    if (!user) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    return { user };
  },
  component: ProtectedLayout,
});
