import { cleanup, configure } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, vi } from "vitest";
import { toastQueue } from "../src/components/ui/Toast.tsx";
import { usePlayUi } from "../src/play/play-ui-store.ts";
import { usePlayback } from "../src/play/playback-store.ts";
import { useTour } from "../src/tour/tour-state.ts";
import { resetApi } from "./support/api.ts";

configure({ asyncUtilTimeout: 4000 });

beforeEach(() => {
  window.localStorage.clear();
  usePlayUi.getState().reset();
  useTour.setState({ data: { status: "unasked" } });
  usePlayback.setState({ breakpoints: new Set() });
});

afterEach(() => {
  act(() => {
    toastQueue.clear();
    usePlayback.getState().clear();
  });
  cleanup();
  resetApi();
  vi.useRealTimers();
});
