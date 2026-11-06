import { useEffect, useSyncExternalStore } from "react";
import { IconButton } from "../components/ui/IconButton.tsx";
import { hu } from "../i18n/hu.ts";
import { isSoundOn, setSoundOn, subscribeSound, unlockAudio } from "./sfx.ts";

export function useSoundOn(): boolean {
  return useSyncExternalStore(subscribeSound, isSoundOn, () => true);
}

export function useAudioUnlock(): void {
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);
}

export function SoundToggle() {
  const isOn = useSoundOn();
  return (
    <IconButton
      variant="ghost"
      size="sm"
      icon={isOn ? "soundOn" : "soundOff"}
      label={hu.nav.soundToggle}
      aria-pressed={isOn}
      tooltip={isOn ? hu.nav.soundOn : hu.nav.soundOff}
      onPress={() => {
        setSoundOn(!isOn);
        unlockAudio();
      }}
    />
  );
}
