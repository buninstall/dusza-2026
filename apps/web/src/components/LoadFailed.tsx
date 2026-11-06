import { hu } from "../i18n/hu.ts";
import { errorMessage } from "../lib/api.ts";
import { isServerTrouble } from "../lib/query.ts";
import { Notice } from "./Notice.tsx";
import { Button } from "./ui/Button.tsx";

type LoadFailedProps = {
  error: unknown;
  fallback: string;
  onRetry: () => void;
};

export function LoadFailed({ error, fallback, onRetry }: LoadFailedProps) {
  const isTrouble = isServerTrouble(error);
  return (
    <Notice
      tone={isTrouble ? "warning" : "error"}
      title={isTrouble ? hu.app.serverTrouble : errorMessage(error, fallback)}
      live="alert"
      actions={
        <Button variant="secondary" icon="rewind" onPress={onRetry}>
          {hu.app.retry}
        </Button>
      }
    >
      {isTrouble ? <p>{hu.app.serverTroubleBody}</p> : null}
    </Notice>
  );
}
