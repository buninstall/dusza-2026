import { useBlocker } from "@tanstack/react-router";
import { Button } from "../components/ui/Button.tsx";
import { ModalShell } from "../components/ui/Dialog.tsx";
import { hu } from "../i18n/hu.ts";

export function LeaveGuard({ shouldBlock }: { shouldBlock: () => boolean }) {
  const blocker = useBlocker({
    shouldBlockFn: shouldBlock,
    enableBeforeUnload: shouldBlock,
    withResolver: true,
  });
  return (
    <ModalShell
      title={hu.mapEditor.leaveTitle}
      role="alertdialog"
      isOpen={blocker.status === "blocked"}
      onOpenChange={(isOpen) => (isOpen ? undefined : blocker.reset?.())}
    >
      {() => (
        <>
          <p className="overlay-body">{hu.mapEditor.leaveBody}</p>
          <div className="overlay-actions">
            <Button onPress={() => blocker.reset?.()} autoFocus>
              {hu.mapEditor.leaveStay}
            </Button>
            <Button variant="danger" icon="arrowLeft" onPress={() => blocker.proceed?.()}>
              {hu.mapEditor.leaveGo}
            </Button>
          </div>
        </>
      )}
    </ModalShell>
  );
}
