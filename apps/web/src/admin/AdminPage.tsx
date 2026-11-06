import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loading } from "../app/StatusScreens.tsx";
import type { SessionUser } from "../auth/session.ts";
import "../components/DataTable.css";
import { LocationPlate } from "../components/LocationPlate.tsx";
import { Notice } from "../components/Notice.tsx";
import { Button } from "../components/ui/Button.tsx";
import { ConfirmDialog } from "../components/ui/Dialog.tsx";
import { toast } from "../components/ui/Toast.tsx";
import { formatTime, hu } from "../i18n/hu.ts";
import { api, call, errorMessage } from "../lib/api.ts";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
import "./AdminPage.css";

const fetchUsers = () => call(api.admin.users.$get());

const usersQuery = queryOptions({ queryKey: ["admin", "users"], queryFn: fetchUsers });

type Account = Awaited<ReturnType<typeof fetchUsers>>["users"][number];
type Role = Account["role"];

const ROLE_LABEL: Record<Role, string> = { admin: hu.admin.roleAdmin, user: hu.admin.roleUser };

function AccountActions({
  account,
  onRole,
  onRemove,
}: {
  account: Account;
  onRole: (role: Role) => void;
  onRemove: () => void;
}) {
  const nextRole: Role = account.role === "admin" ? "user" : "admin";
  return (
    <div className="data-table-actions">
      <Button
        size="sm"
        icon="key"
        aria-label={
          nextRole === "admin"
            ? hu.admin.makeAdminFor(account.username)
            : hu.admin.makeUserFor(account.username)
        }
        onPress={() => onRole(nextRole)}
      >
        {nextRole === "admin" ? hu.admin.makeAdmin : hu.admin.makeUser}
      </Button>
      <ConfirmDialog
        triggerLabel={hu.admin.remove}
        triggerAriaLabel={hu.admin.removeFor(account.username)}
        triggerIcon="trash"
        title={hu.admin.removeTitle}
        body={hu.admin.removeConfirm(account.username)}
        confirmLabel={hu.admin.remove}
        onConfirm={onRemove}
      />
    </div>
  );
}

function countAdmins(accounts: readonly Account[]): number {
  return accounts.filter((account) => account.role === "admin").length;
}

export function AdminPage({ me }: { me: SessionUser }) {
  const queryClient = useQueryClient();
  const { data, error } = useQuery(usersQuery);
  const refresh = () => queryClient.invalidateQueries({ queryKey: usersQuery.queryKey });

  const setRole = async (account: Account, role: Role) => {
    try {
      await call(
        api.admin.users[":id"].$patch({ param: { id: String(account.id) }, json: { role } }),
      );
      await refresh();
      toast.success(hu.admin.roleChanged(account.username, ROLE_LABEL[role]));
    } catch (caught) {
      toast.error(errorMessage(caught, hu.app.unexpected));
    }
  };

  const remove = async (account: Account) => {
    try {
      await call(api.admin.users[":id"].$delete({ param: { id: String(account.id) } }));
      await refresh();
      toast.success(hu.admin.removed(account.username));
    } catch (caught) {
      toast.error(errorMessage(caught, hu.app.unexpected));
    }
  };

  return (
    <div className="admin-page">
      <LocationPlate
        name={hu.signs.admin}
        meta={data ? hu.admin.meta(data.users.length, countAdmins(data.users)) : undefined}
      />
      {error ? (
        <Notice tone="error" title={errorMessage(error, hu.admin.loadFailed)} live="alert" />
      ) : null}
      {!data && !error ? <Loading /> : null}
      {data ? (
        <div className="data-table">
          <table className="data-table-grid">
            <caption className="visually-hidden">{hu.admin.tableLabel}</caption>
            <thead>
              <tr>
                <th scope="col">{hu.admin.username}</th>
                <th scope="col">{hu.admin.role}</th>
                <th scope="col">{hu.admin.created}</th>
                <th scope="col">{hu.admin.actions}</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((account) => (
                <tr key={account.id}>
                  <th scope="row" className="admin-name">
                    {account.username}
                    {account.id === me.id ? (
                      <span className="data-table-tag">{hu.admin.you}</span>
                    ) : null}
                  </th>
                  <td data-role={account.role} className="admin-role">
                    <PixelIcon name={account.role === "admin" ? "key" : "helmet"} />
                    {ROLE_LABEL[account.role]}
                  </td>
                  <td className="data-table-muted">{formatTime(account.createdAt)}</td>
                  <td>
                    {account.id === me.id ? (
                      <span className="data-table-muted">{hu.admin.ownAccount}</span>
                    ) : (
                      <AccountActions
                        account={account}
                        onRole={(role) => void setRole(account, role)}
                        onRemove={() => void remove(account)}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
