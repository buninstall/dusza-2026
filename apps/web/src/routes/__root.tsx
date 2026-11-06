import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { Toasts } from "../components/ui/Toast.tsx";
import { EngineProvider } from "../engine/EngineProvider.tsx";
import { hu } from "../i18n/hu.ts";
import { SpriteSheet } from "../pixel/SpriteSheet.tsx";

export type RouterContext = { queryClient: QueryClient };

function RootLayout() {
  return (
    <>
      <a href="#main" className="skip-link">
        {hu.app.skipToContent}
      </a>
      <SpriteSheet />
      <EngineProvider>
        <Outlet />
      </EngineProvider>
      <Toasts />
    </>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});
