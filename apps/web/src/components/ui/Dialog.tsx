import type { ReactNode } from "react";
import {
  Dialog as AriaDialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { hu } from "../../i18n/hu.ts";
import { HazardStripe } from "../../pixel/HazardStripe.tsx";
import type { IconName } from "../../pixel/icons.ts";
import { Button, type ButtonSize, type ButtonVariant } from "./Button.tsx";
import { IconButton } from "./IconButton.tsx";
import "./Overlay.css";

type ModalShellProps = {
  title: string;
  role?: "dialog" | "alertdialog";
  size?: "default" | "wide";
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  children: (close: () => void) => ReactNode;
};

export function ModalShell({
  title,
  role = "dialog",
  size = "default",
  isOpen,
  onOpenChange,
  children,
}: ModalShellProps) {
  const control = isOpen === undefined ? {} : { isOpen };
  const listener = onOpenChange === undefined ? {} : { onOpenChange };
  return (
    <ModalOverlay isDismissable {...control} {...listener} className="overlay-backdrop">
      <Modal
        className="overlay-modal"
        data-size={size}
        data-tone={role === "alertdialog" ? "danger" : "neutral"}
      >
        {role === "alertdialog" ? <HazardStripe /> : null}
        <AriaDialog role={role} className="overlay-dialog">
          {({ close }) => (
            <>
              <div className="overlay-head">
                <Heading slot="title" className="overlay-title">
                  {title}
                </Heading>
                {role === "dialog" ? (
                  <IconButton
                    icon="close"
                    label={hu.common.close}
                    variant="ghost"
                    size="sm"
                    onPress={close}
                  />
                ) : null}
              </div>
              {children(close)}
            </>
          )}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

type ConfirmDialogProps = {
  triggerLabel: string;
  triggerAriaLabel?: string;
  triggerIcon?: IconName;
  triggerVariant?: ButtonVariant;
  triggerSize?: ButtonSize;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
};

export function ConfirmDialog({
  triggerLabel,
  triggerAriaLabel,
  triggerIcon,
  triggerVariant = "danger",
  triggerSize = "sm",
  title,
  body,
  confirmLabel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <DialogTrigger>
      <Button
        variant={triggerVariant}
        size={triggerSize}
        icon={triggerIcon}
        {...(triggerAriaLabel ? { "aria-label": triggerAriaLabel } : {})}
      >
        {triggerLabel}
      </Button>
      <ModalShell title={title} role="alertdialog">
        {(close) => (
          <>
            <p className="overlay-body">{body}</p>
            <div className="overlay-actions">
              <Button onPress={close} autoFocus>
                {hu.common.cancel}
              </Button>
              <Button
                variant="danger"
                icon="trash"
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
      </ModalShell>
    </DialogTrigger>
  );
}
