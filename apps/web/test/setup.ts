import { cleanup } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, vi } from "vitest";
import { toastQueue } from "../src/components/ui/Toast.tsx";
import { usePlayback } from "../src/play/playback-store.ts";
import { resetApi } from "./support/api.ts";

beforeEach(() => {
  window.localStorage.clear();
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
