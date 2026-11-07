import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { SessionUser } from "../auth/session.ts";
import { Menu, MenuItem, MenuSeparator } from "../components/ui/Menu.tsx";
import { toast, toastQueue } from "../components/ui/Toast.tsx";
import { hu } from "../i18n/hu.ts";
import { api, call, errorMessage } from "../lib/api.ts";

export function UserMenu({ user }: { user: SessionUser }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const logout = async () => {
    toastQueue.clear();
    try {
      await call(api.auth.logout.$post());
    } catch (error) {
      toast.error(errorMessage(error, hu.app.unexpected));
    }
    queryClient.clear();
    await navigate({ to: "/login" });
  };

  return (
    <Menu
      icon="helmet"
      ariaLabel={hu.nav.userMenuFor(user.username)}
      label={<span className="shell-tool-label">{user.username}</span>}
    >
      <MenuItem isDisabled textValue={hu.nav.signedInAs(user.username)}>
        {hu.nav.signedInAs(user.username)}
      </MenuItem>
      <MenuSeparator />
      <MenuItem onAction={() => void logout()}>{hu.nav.logout}</MenuItem>
    </Menu>
  );
}
