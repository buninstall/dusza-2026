import {
  UNSTABLE_Toast as AriaToast,
  Text,
  UNSTABLE_ToastContent as ToastContent,
  UNSTABLE_ToastQueue as ToastQueue,
  UNSTABLE_ToastRegion as ToastRegion,
} from "react-aria-components";
import { hu } from "../../i18n/hu.ts";
import type { IconName } from "../../pixel/icons.ts";
import { PixelIcon } from "../../pixel/PixelIcon.tsx";
import { Button } from "./Button.tsx";
import "./Overlay.css";

type ToastTone = "success" | "error" | "info";
type ToastMessage = { tone: ToastTone; text: string };

const TOAST_TIMEOUT_MS = 6000;
const MAX_VISIBLE = 4;

const TONE_ICON: Record<ToastTone, IconName> = {
  success: "check",
  error: "error",
  info: "warning",
};

export const toastQueue = new ToastQueue<ToastMessage>({ maxVisibleToasts: MAX_VISIBLE });

export const toast = {
  success: (text: string) =>
    toastQueue.add({ tone: "success", text }, { timeout: TOAST_TIMEOUT_MS }),
  error: (text: string) =>
    toastQueue.add({ tone: "error", text }, { timeout: TOAST_TIMEOUT_MS * 2 }),
  info: (text: string) => toastQueue.add({ tone: "info", text }, { timeout: TOAST_TIMEOUT_MS }),
};

export function Toasts() {
  return (
    <ToastRegion
      queue={toastQueue}
      aria-label={hu.common.notifications}
      className="overlay-toast-region"
    >
      {({ toast: item }) => (
        <AriaToast toast={item} className="overlay-toast" data-tone={item.content.tone}>
          <span className="overlay-toast-icon">
            <PixelIcon name={TONE_ICON[item.content.tone]} />
          </span>
          <ToastContent className="overlay-toast-content">
            <Text slot="title">{item.content.text}</Text>
          </ToastContent>
          <Button
            slot="close"
            variant="ghost"
            size="sm"
            icon="close"
            aria-label={hu.common.dismiss}
          />
        </AriaToast>
      )}
    </ToastRegion>
  );
}
