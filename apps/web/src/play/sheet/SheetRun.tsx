import { createContext, useContext } from "react";
import { Button } from "../../components/ui/Button.tsx";
import { hu } from "../../i18n/hu.ts";
import { isLiveRun, usePlayback } from "../playback-store.ts";

export const SheetRunContext = createContext<(() => void) | null>(null);

export function SheetRunButton() {
  const onRun = useContext(SheetRunContext);
  const status = usePlayback((state) => state.status);
  const hasEnded = usePlayback((state) => state.hasEnded);
  if (!onRun) {
    return null;
  }
  if (isLiveRun(status, hasEnded)) {
    return (
      <Button
        size="sm"
        variant="danger"
        icon="stop"
        className="sheet-run"
        aria-keyshortcuts="Shift+F5"
        onPress={usePlayback.getState().stop}
      >
        {hu.play.sheetStop}
      </Button>
    );
  }
  return (
    <Button
      size="sm"
      variant="primary"
      icon="play"
      className="sheet-run"
      aria-keyshortcuts="Control+Enter F5"
      onPress={onRun}
    >
      {hu.play.sheetRun}
    </Button>
  );
}
