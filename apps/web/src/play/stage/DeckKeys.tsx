import type { Ref } from "react";
import { Toolbar } from "react-aria-components";
import { IconButton } from "../../components/ui/IconButton.tsx";
import { hu } from "../../i18n/hu.ts";
import { isScrubbable, usePlayback } from "../playback-store.ts";

type CenterKey = { label: string; icon: "pause" | "play" | "replay"; act: () => void };

function centerKey(status: string): CenterKey {
  const actions = usePlayback.getState();
  if (status === "playing") {
    return { label: hu.play.pause, icon: "pause", act: actions.pause };
  }
  if (status === "finished") {
    return { label: hu.play.replay, icon: "replay", act: actions.replay };
  }
  return { label: hu.play.resume, icon: "play", act: actions.play };
}

export function DeckKeys({ centerRef }: { centerRef: Ref<HTMLButtonElement> }) {
  const index = usePlayback((state) => state.index);
  const status = usePlayback((state) => state.status);
  const total = usePlayback((state) => state.result?.events.length ?? 0);
  const actions = usePlayback.getState();
  const isOn = isScrubbable(status);
  const center = centerKey(status);
  const key = (label: string, shortcut: string) => hu.play.withKey(label, shortcut);
  return (
    <Toolbar aria-label={hu.play.transportKeys} className="deck-keys">
      <IconButton
        icon="rewind"
        label={hu.play.restart}
        tooltip={key(hu.play.restart, "Home")}
        aria-keyshortcuts="Home"
        isDisabled={!isOn || index === 0}
        onPress={actions.restart}
      />
      <IconButton
        icon="stepBack"
        label={hu.play.stepBack}
        tooltip={key(hu.play.stepBack, "←")}
        aria-keyshortcuts="ArrowLeft"
        isDisabled={!isOn || index === 0}
        onPress={actions.back}
      />
      <IconButton
        ref={centerRef}
        icon={center.icon}
        label={center.label}
        tooltip={key(center.label, "Szóköz")}
        aria-keyshortcuts="Space"
        isDisabled={!isOn}
        onPress={center.act}
      />
      <IconButton
        icon="stepForward"
        label={hu.play.stepForward}
        tooltip={key(hu.play.stepForward, "→")}
        aria-keyshortcuts="ArrowRight"
        isDisabled={!isOn || index >= total}
        onPress={actions.step}
      />
      <IconButton
        icon="skipEnd"
        label={hu.play.skipToEnd}
        tooltip={key(hu.play.skipToEnd, "End")}
        aria-keyshortcuts="End"
        isDisabled={!isOn || index >= total}
        onPress={() => actions.seek(total)}
      />
    </Toolbar>
  );
}
