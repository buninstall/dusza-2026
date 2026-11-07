import type { Diagnostic } from "@minescript/engine";
import { Button } from "../../components/ui/Button.tsx";
import { ModalShell } from "../../components/ui/Dialog.tsx";
import { diagnosticTitles, hu } from "../../i18n/hu.ts";

export type RejectedImport = {
  name: string;
  message: string;
  diagnostics: readonly Diagnostic[];
};

const LISTED_ERRORS = 8;

type ImportRejectedProps = {
  rejected: RejectedImport | null;
  onClose: () => void;
};

export function ImportRejected({ rejected, onClose }: ImportRejectedProps) {
  const listed = rejected?.diagnostics.slice(0, LISTED_ERRORS) ?? [];
  const hidden = (rejected?.diagnostics.length ?? 0) - listed.length;
  return (
    <ModalShell
      title={hu.play.importRejectedTitle}
      role="alertdialog"
      isOpen={rejected !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      {(close) => (
        <>
          <p className="overlay-body">{rejected?.message}</p>
          <p className="import-file">{hu.play.importFile(rejected?.name ?? "")}</p>
          {listed.length > 0 ? (
            <ul className="import-issues">
              {listed.map((diagnostic, index) => (
                <li key={`${diagnostic.code}-${index.toString()}`} className="import-issue">
                  <span className="import-issue-line">
                    {hu.common.lineRef(diagnostic.span.line)}
                  </span>
                  <span>
                    <strong>{diagnosticTitles[diagnostic.code]}.</strong> {diagnostic.message}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {hidden > 0 ? <p className="overlay-body">{hu.play.importMoreErrors(hidden)}</p> : null}
          <div className="overlay-actions">
            <Button variant="primary" onPress={close} autoFocus>
              {hu.common.close}
            </Button>
          </div>
        </>
      )}
    </ModalShell>
  );
}
