import { queryOptions, useQuery } from "@tanstack/react-query";
import { Menu, MenuItem, MenuSeparator } from "../components/ui/Menu.tsx";
import { hu } from "../i18n/hu.ts";
import { api, call } from "../lib/api.ts";
import {
  DESKTOP_PLATFORM_ORDER,
  type DesktopPlatform,
  detectFamily,
  downloadHref,
  isDesktopShell,
  orderForFamily,
} from "./platform.ts";

const DESKTOP_STALE_MS = 10 * 60_000;

export const desktopInfoQuery = queryOptions({
  queryKey: ["desktop-info"],
  queryFn: () => call(api.desktop.info.$get()),
  staleTime: DESKTOP_STALE_MS,
  retry: false,
  refetchInterval: false,
});

export function DesktopDownload() {
  const inShell = typeof document !== "undefined" && isDesktopShell(document.documentElement);
  const { data } = useQuery({ ...desktopInfoQuery, enabled: !inShell });
  if (inShell || !data) return null;
  const available = DESKTOP_PLATFORM_ORDER.filter((platform) => data.files[platform]);
  if (available.length === 0) return null;
  const family = detectFamily(typeof navigator === "undefined" ? undefined : navigator);
  const ordered = orderForFamily(available, family);
  const recommended: DesktopPlatform | undefined = family
    ? ordered.find((platform) => platform.startsWith(family))
    : undefined;
  return (
    <Menu
      icon="download"
      ariaLabel={hu.desktop.menuFor(data.version)}
      label={<span className="shell-tool-label">{hu.desktop.label}</span>}
    >
      <MenuItem isDisabled textValue={hu.desktop.version(data.version)}>
        {hu.desktop.version(data.version)}
      </MenuItem>
      <MenuSeparator />
      {ordered.map((platform) => {
        const text =
          platform === recommended
            ? hu.desktop.recommended(hu.desktop.platforms[platform])
            : hu.desktop.platforms[platform];
        return (
          <MenuItem key={platform} href={downloadHref(platform)} textValue={text}>
            {text}
          </MenuItem>
        );
      })}
    </Menu>
  );
}
