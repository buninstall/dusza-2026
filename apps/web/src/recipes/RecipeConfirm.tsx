import { Button } from "../components/ui/Button.tsx";
import { ModalShell } from "../components/ui/Dialog.tsx";
import { hu } from "../i18n/hu.ts";

type RecipeConfirmProps = { isOpen: boolean; onConfirm: () => void; onCancel: () => void };

export function RecipeConfirm({ isOpen, onConfirm, onCancel }: RecipeConfirmProps) {
  return (
    <ModalShell
      title={hu.programs.replaceTitle}
      role="alertdialog"
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
    >
      {() => (
        <>
          <p className="overlay-body">{hu.programs.replaceBody}</p>
          <div className="overlay-actions">
            <Button onPress={onCancel} autoFocus>
              {hu.common.cancel}
            </Button>
            <Button variant="primary" icon="play" onPress={onConfirm}>
              {hu.programs.replaceConfirm}
            </Button>
          </div>
        </>
      )}
    </ModalShell>
  );
}
