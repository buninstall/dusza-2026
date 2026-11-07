import { Button } from "../../components/ui/Button.tsx";
import { ModalShell } from "../../components/ui/Dialog.tsx";
import { hu } from "../../i18n/hu.ts";

export type PendingImport = { name: string; text: string };

type ImportConfirmProps = {
  pending: PendingImport | null;
  onCancel: () => void;
  onConfirm: (pending: PendingImport) => void;
};

export function ImportConfirm({ pending, onCancel, onConfirm }: ImportConfirmProps) {
  return (
    <ModalShell
      title={hu.programs.replaceTitle}
      role="alertdialog"
      isOpen={pending !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onCancel();
        }
      }}
    >
      {(close) => (
        <>
          <p className="overlay-body">{hu.programs.importReplaceBody}</p>
          <div className="overlay-actions">
            <Button onPress={close} autoFocus>
              {hu.common.cancel}
            </Button>
            <Button
              variant="primary"
              icon="upload"
              onPress={() => {
                if (pending) {
                  onConfirm(pending);
                }
              }}
            >
              {hu.programs.importConfirm}
            </Button>
          </div>
        </>
      )}
    </ModalShell>
  );
}
