import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { I18nProvider } from "react-aria-components";
import { LoadingCurtain } from "../app/LoadingCurtain.tsx";
import { RouteFocus } from "../app/RouteFocus.tsx";
import { Toasts } from "../components/ui/Toast.tsx";
import { hu } from "../i18n/hu.ts";
import { SpriteSheet } from "../pixel/SpriteSheet.tsx";

export type RouterContext = { queryClient: QueryClient };

function RootLayout() {
  return (
    <I18nProvider locale="hu-HU">
      <a href="#main" className="skip-link">
        {hu.app.skipToContent}
      </a>
      <SpriteSheet />
      <Outlet />
      <Toasts />
      <RouteFocus />
      <LoadingCurtain />
    </I18nProvider>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});
