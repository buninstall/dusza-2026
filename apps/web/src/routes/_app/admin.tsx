import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Notice } from "../../components/Notice.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { ConfirmDialog } from "../../components/ui/Dialog.tsx";
import { toast } from "../../components/ui/Toast.tsx";
import { formatTime, hu } from "../../i18n/hu.ts";
import { api, call, errorMessage } from "../../lib/api.ts";

const usersQuery = queryOptions({
  queryKey: ["admin", "users"],
  queryFn: () => call(api.admin.users.$get()),
});

function AdminPage() {
  const { user: me } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const { data, error } = useQuery(usersQuery);

  const refresh = () => queryClient.invalidateQueries({ queryKey: usersQuery.queryKey });

  const setRole = async (id: number, role: "admin" | "user") => {
    try {
      await call(api.admin.users[":id"].$patch({ param: { id: String(id) }, json: { role } }));
      await refresh();
    } catch (caught) {
      toast.error(errorMessage(caught, hu.app.unexpected));
    }
  };

  const remove = async (id: number) => {
    try {
      await call(api.admin.users[":id"].$delete({ param: { id: String(id) } }));
      await refresh();
    } catch (caught) {
      toast.error(errorMessage(caught, hu.app.unexpected));
    }
  };

  return (
    <div className="flex flex-col gap-6 pt-6">
      <header>
        <h1 className="text-4xl font-black tracking-tighter">{hu.admin.title}</h1>
        <p className="mt-2 text-ink-muted">{hu.admin.lead}</p>
      </header>
      {error ? <Notice tone="error" title={errorMessage(error, hu.app.unexpected)} /> : null}
      {data ? (
        <div className="plate overflow-x-auto">
          <table className="w-full text-left">
            <caption className="sr-only">{hu.admin.tableLabel}</caption>
            <thead className="eyebrow border-b border-line">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">
                  {hu.admin.username}
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  {hu.admin.role}
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  {hu.admin.created}
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  {hu.admin.actions}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((account) => {
                const isMe = account.id === me.id;
                return (
                  <tr key={account.id} className="border-b border-line last:border-0">
                    <th scope="row" className="px-5 py-3 font-mono font-semibold">
                      {account.username}
                      {isMe ? (
                        <span className="ml-2 text-xs text-ink-muted">({hu.admin.you})</span>
                      ) : null}
                    </th>
                    <td className="px-5 py-3">
                      {account.role === "admin" ? hu.admin.roleAdmin : hu.admin.roleUser}
                    </td>
                    <td className="px-5 py-3 text-sm text-ink-muted">
                      {formatTime(account.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      {isMe ? null : (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onPress={() =>
                              void setRole(account.id, account.role === "admin" ? "user" : "admin")
                            }
                          >
                            {account.role === "admin" ? hu.admin.makeUser : hu.admin.makeAdmin}
                          </Button>
                          <ConfirmDialog
                            triggerLabel={hu.admin.remove}
                            title={hu.admin.remove}
                            body={hu.admin.removeConfirm(account.username)}
                            confirmLabel={hu.admin.remove}
                            onConfirm={() => void remove(account.id)}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

export const Route = createFileRoute("/_app/admin")({
  beforeLoad: ({ context }) => {
    if (context.user.role !== "admin") {
      throw redirect({ to: "/maps" });
    }
  },
  component: AdminPage,
});
