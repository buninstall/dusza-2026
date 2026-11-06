import { createFileRoute, redirect } from "@tanstack/react-router";
import { AdminPage } from "../../admin/AdminPage.tsx";

function AdminRoute() {
  const { user } = Route.useRouteContext();
  return <AdminPage me={user} />;
}

export const Route = createFileRoute("/_app/admin")({
  beforeLoad: ({ context }) => {
    if (context.user.role !== "admin") {
      throw redirect({ to: "/maps" });
    }
  },
  component: AdminRoute,
});
