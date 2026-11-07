import { Notice } from "../../components/Notice.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { hu } from "../../i18n/hu.ts";
import { LIMIT_CODE } from "../phase.ts";
import { SPEED_MAX, usePlayback } from "../playback-store.ts";

const LONG_RUN_SECONDS = 20;
const SECONDS_PER_MINUTE = 60;

export function LongRunNotice() {
  const result = usePlayback((state) => state.result);
  const index = usePlayback((state) => state.index);
  const speed = usePlayback((state) => state.speed);
  const status = usePlayback((state) => state.status);
  if (!result || status !== "playing") {
    return null;
  }
  const total = result.events.length;
  const seconds = (total - index) / speed;
  if (seconds < LONG_RUN_SECONDS) {
    return null;
  }
  const isLimit = result.outcome.kind === "runtimeError" && result.outcome.code === LIMIT_CODE;
  const minutes = Math.round(seconds / SECONDS_PER_MINUTE);
  const { seek, setSpeed } = usePlayback.getState();
  return (
    <Notice
      tone="warning"
      title={hu.play.longRunTitle(total, minutes)}
      actions={
        <>
          <Button size="sm" variant="primary" icon="skipEnd" onPress={() => seek(total)}>
            {hu.play.skipToEnd}
          </Button>
          {speed < SPEED_MAX ? (
            <Button size="sm" icon="stepForward" onPress={() => setSpeed(SPEED_MAX)}>
              {hu.play.speedUp}
            </Button>
          ) : null}
        </>
      }
    >
      {isLimit ? hu.play.longRunLoop : hu.play.longRunHint}
    </Notice>
  );
}
