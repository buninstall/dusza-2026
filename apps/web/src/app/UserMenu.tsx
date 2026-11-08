import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { SessionUser } from "../auth/session.ts";
import { Menu, MenuItem, MenuSeparator } from "../components/ui/Menu.tsx";
import { toast, toastQueue } from "../components/ui/Toast.tsx";
import { announceDownload, downloadHref, useDesktopOffer } from "../desktop/release.ts";
import { hu } from "../i18n/hu.ts";
import { api, call, errorMessage } from "../lib/api.ts";
import { type CursorStyle, initialCursor, saveCursor } from "../lib/cursor.ts";
import { clearPersistedQueries } from "../lib/query.ts";

export function UserMenu({ user }: { user: SessionUser }) {
  const queryClient = useQueryClient();
  const [cursor, setCursor] = useState<CursorStyle>(initialCursor);
  const navigate = useNavigate();
  const { offer } = useDesktopOffer();

  const logout = async () => {
    toastQueue.clear();
    try {
      await call(api.auth.logout.$post());
    } catch (error) {
      toast.error(errorMessage(error, hu.app.unexpected));
    }
    queryClient.clear();
    clearPersistedQueries();
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
      <MenuItem
        onAction={() => {
          const next = cursor === "pickaxe" ? "system" : "pickaxe";
          saveCursor(next);
          setCursor(next);
        }}
      >
        {cursor === "pickaxe" ? hu.nav.cursorSystem : hu.nav.cursorPickaxe}
      </MenuItem>
      {offer ? <MenuSeparator /> : null}
      {offer ? (
        <MenuItem
          href={downloadHref(offer.primary.format)}
          download
          onAction={() => announceDownload(offer.primary.format)}
        >
          {hu.desktop.menuItem[offer.platform]}
        </MenuItem>
      ) : null}
      <MenuSeparator />
      <MenuItem onAction={() => void logout()}>{hu.nav.logout}</MenuItem>
    </Menu>
  );
}
