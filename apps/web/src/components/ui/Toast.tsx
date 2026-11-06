import { clsx } from "clsx";
import { X } from "lucide-react";
import {
  UNSTABLE_Toast as AriaToast,
  Text,
  UNSTABLE_ToastContent as ToastContent,
  UNSTABLE_ToastQueue as ToastQueue,
  UNSTABLE_ToastRegion as ToastRegion,
} from "react-aria-components";
import { hu } from "../../i18n/hu.ts";
import { Button } from "./Button.tsx";

type ToastTone = "success" | "error" | "info";
type ToastMessage = { tone: ToastTone; text: string };

const TOAST_TIMEOUT = 6000;

export const toastQueue = new ToastQueue<ToastMessage>({ maxVisibleToasts: 4 });

export const toast = {
  success: (text: string) => toastQueue.add({ tone: "success", text }, { timeout: TOAST_TIMEOUT }),
  error: (text: string) => toastQueue.add({ tone: "error", text }, { timeout: TOAST_TIMEOUT * 2 }),
  info: (text: string) => toastQueue.add({ tone: "info", text }, { timeout: TOAST_TIMEOUT }),
};

const toneClass: Record<ToastTone, string> = {
  success: "border-l-moss",
  error: "border-l-rust",
  info: "border-l-ore",
};

export function Toasts() {
  return (
    <ToastRegion
      queue={toastQueue}
      aria-label={hu.common.notifications}
      className="fixed right-4 bottom-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 outline-none"
    >
      {({ toast: item }) => (
        <AriaToast
          toast={item}
          className={clsx(
            "plate flex items-start gap-3 border-l-4 px-4 py-3 outline-none data-[focus-visible]:outline-3 data-[focus-visible]:outline-lamp",
            toneClass[item.content.tone],
          )}
        >
          <ToastContent className="flex-1">
            <Text slot="title" className="text-sm font-medium text-ink">
              {item.content.text}
            </Text>
          </ToastContent>
          <Button slot="close" variant="ghost" size="sm" aria-label={hu.common.dismiss}>
            <X aria-hidden size={16} />
          </Button>
        </AriaToast>
      )}
    </ToastRegion>
  );
}
