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
import { OVERLAY_SKIN } from "./overlay-skin.ts";
import "./Overlay.css";

type ToastTone = "success" | "error" | "info";
type ToastMessage = { tone: ToastTone; text: string };

const TOAST_TIMEOUT_MS = 6000;
const MAX_VISIBLE = 3;

const TONE_ICON: Record<ToastTone, IconName> = {
  success: "check",
  error: "error",
  info: "warning",
};

export const toastQueue = new ToastQueue<ToastMessage>({ maxVisibleToasts: MAX_VISIBLE });

function show(tone: ToastTone, text: string, timeout: number): string {
  for (const item of toastQueue.visibleToasts) {
    if (item.content.text === text) {
      toastQueue.close(item.key);
    }
  }
  return toastQueue.add({ tone, text }, { timeout });
}

export const toast = {
  success: (text: string) => show("success", text, TOAST_TIMEOUT_MS),
  error: (text: string) => show("error", text, TOAST_TIMEOUT_MS * 2),
  info: (text: string) => show("info", text, TOAST_TIMEOUT_MS),
};

export function Toasts() {
  return (
    <ToastRegion
      queue={toastQueue}
      aria-label={hu.common.notifications}
      className="overlay-toast-region"
      {...OVERLAY_SKIN}
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
