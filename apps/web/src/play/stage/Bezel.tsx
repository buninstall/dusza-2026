import type { ReactNode } from "react";
import { LocationPlate } from "../../components/LocationPlate.tsx";
import { Segmented } from "../../components/ui/Segmented.tsx";
import { hu } from "../../i18n/hu.ts";
import { usePlayUi } from "../play-ui-store.ts";
import { KeysPopover } from "./KeysPopover.tsx";
import { WellZoom } from "./WellZoom.tsx";

type BezelProps = {
  name: string;
  title: string;
  meta?: ReactNode | undefined;
  documentTitle?: string;
  actions: ReactNode;
  isFullLocked?: boolean;
};

export function ViewSwitch({ isLocked = false }: { isLocked?: boolean }) {
  const fogMode = usePlayUi((state) => state.fogMode);
  const setFogMode = usePlayUi((state) => state.setFogMode);
  return (
    <Segmented
      label={isLocked ? `${hu.play.viewLabel}: ${hu.play.viewLocked}` : hu.play.viewLabel}
      isLabelHidden
      value={isLocked ? "lamp" : fogMode}
      onChange={setFogMode}
      isDisabled={isLocked}
      options={[
        { id: "lamp", label: hu.play.viewLamp, icon: "lantern" },
        { id: "full", label: hu.play.viewFull, icon: "grid" },
      ]}
    />
  );
}

export function Bezel({
  name,
  title,
  meta,
  documentTitle,
  actions,
  isFullLocked = false,
}: BezelProps) {
  return (
    <LocationPlate
      name={name}
      detail={title}
      isDocked={false}
      className="stage-bezel"
      {...(documentTitle ? { documentTitle } : {})}
      {...(meta ? { meta } : {})}
      actions={
        <>
          {actions}
          <ViewSwitch isLocked={isFullLocked} />
          <WellZoom />
          <span className="bezel-keys">
            <KeysPopover rows={hu.play.shortcuts} />
          </span>
        </>
      }
    />
  );
}
