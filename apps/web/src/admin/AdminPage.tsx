import { keepPreviousData, queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SessionUser } from "../auth/session.ts";
import "../components/DataTable.css";
import { EmptyState } from "../components/EmptyState.tsx";
import { LocationPlate } from "../components/LocationPlate.tsx";
import { Notice } from "../components/Notice.tsx";
import { Pager } from "../components/Pager.tsx";
import { Button } from "../components/ui/Button.tsx";
import { ConfirmDialog } from "../components/ui/Dialog.tsx";
import { SearchField } from "../components/ui/SearchField.tsx";
import { toast } from "../components/ui/Toast.tsx";
import { formatTime, hu } from "../i18n/hu.ts";
import { browse, people } from "../i18n/hu-browse.ts";
import { pager } from "../i18n/hu-pager.ts";
import { api, call, errorMessage } from "../lib/api.ts";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
import "./AdminPage.css";
import { type NewAccount, NewAccountDialog } from "./NewAccountDialog.tsx";

export const USERS_PER_PAGE = 9;

const USERNAME_MAX = 24;

const USERS_KEY = ["admin", "users"] as const;

const fetchUsers = (page: number, q: string) =>
  call(
    api.admin.users.$get({
      query: { page: String(page), pageSize: String(USERS_PER_PAGE), q },
    }),
  );

const usersQuery = (page: number, q: string) =>
  queryOptions({
    queryKey: [...USERS_KEY, page, q],
    queryFn: () => fetchUsers(page, q),
    placeholderData: keepPreviousData,
  });

type UserPage = Awaited<ReturnType<typeof fetchUsers>>;
type Account = UserPage["users"][number];
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

type AdminPageProps = {
  me: SessionUser;
  page: number;
  q: string;
  onPageChange: (page: number) => void;
  onSearch: (q: string) => void;
};

export function AdminPage({ me, page, q, onPageChange, onSearch }: AdminPageProps) {
  const queryClient = useQueryClient();
  const { data, error, isPlaceholderData } = useQuery(usersQuery(Math.max(1, page), q));
  const refresh = () => queryClient.invalidateQueries({ queryKey: USERS_KEY });

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

  const create = async (account: NewAccount) => {
    await call(api.admin.users.$post({ json: account }));
    await refresh();
    toast.success(hu.admin.createdToast(account.username, ROLE_LABEL[account.role]));
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
        meta={data ? hu.admin.meta(data.total, data.admins) : undefined}
        actions={<NewAccountDialog onCreate={create} />}
      />
      <SearchField
        className="admin-search"
        label={people.searchLabel}
        clearLabel={browse.searchClear}
        placeholder={people.searchPlaceholder}
        maxLength={USERNAME_MAX}
        value={q}
        onCommit={onSearch}
      />
      {error ? (
        <Notice tone="error" title={errorMessage(error, hu.admin.loadFailed)} live="alert" />
      ) : null}
      {data?.total === 0 ? <EmptyState text={people.noMatch(q)} /> : null}
      {data && data.total > 0 ? (
        <>
          <div
            className="data-table admin-paged"
            aria-busy={isPlaceholderData}
            data-turning={isPlaceholderData}
          >
            <AccountsTable
              accounts={data.users}
              me={me}
              onRole={(account, role) => void setRole(account, role)}
              onRemove={(account) => void remove(account)}
            />
          </div>
          <UsersPager data={data} onPageChange={onPageChange} />
        </>
      ) : null}
    </div>
  );
}

function UsersPager({
  data,
  onPageChange,
}: {
  data: UserPage;
  onPageChange: (page: number) => void;
}) {
  const from = (data.page - 1) * data.pageSize;
  return (
    <div className="admin-pager">
      <p className="admin-range">{pager.range(from + 1, from + data.users.length, data.total)}</p>
      <Pager page={data.page} pageCount={data.pageCount} onChange={onPageChange} />
    </div>
  );
}

function AccountsTable({
  accounts,
  me,
  onRole,
  onRemove,
}: {
  accounts: readonly Account[];
  me: SessionUser;
  onRole: (account: Account, role: Role) => void;
  onRemove: (account: Account) => void;
}) {
  return (
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
        {accounts.map((account) => (
          <tr key={account.id}>
            <th scope="row" className="admin-name">
              {account.username}
              {account.id === me.id ? <span className="data-table-tag">{hu.admin.you}</span> : null}
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
                  onRole={(role) => onRole(account, role)}
                  onRemove={() => onRemove(account)}
                />
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
