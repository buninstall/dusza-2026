import type { ReactNode } from "react";
import {
  Dialog as AriaDialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { hu } from "../../i18n/hu.ts";
import { Button, type ButtonVariant } from "./Button.tsx";

type ConfirmDialogProps = {
  triggerLabel: ReactNode;
  triggerVariant?: ButtonVariant;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
};

export function ConfirmDialog({
  triggerLabel,
  triggerVariant = "danger",
  title,
  body,
  confirmLabel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <DialogTrigger>
      <Button variant={triggerVariant} size="sm">
        {triggerLabel}
      </Button>
      <ModalOverlay
        isDismissable
        className="fixed inset-0 z-40 flex items-center justify-center bg-[oklch(15%_0.02_60/0.45)] p-4 backdrop-blur-[2px]"
      >
        <Modal className="plate w-full max-w-md p-6">
          <AriaDialog role="alertdialog" className="outline-none">
            {({ close }) => (
              <>
                <Heading slot="title" className="text-lg font-bold">
                  {title}
                </Heading>
                <p className="mt-2 text-ink-muted">{body}</p>
                <div className="mt-6 flex justify-end gap-2">
                  <Button variant="secondary" onPress={close} autoFocus>
                    {hu.editor.cancel}
                  </Button>
                  <Button
                    variant="danger"
                    onPress={() => {
                      onConfirm();
                      close();
                    }}
                  >
                    {confirmLabel}
                  </Button>
                </div>
              </>
            )}
          </AriaDialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
