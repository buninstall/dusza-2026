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
};

export function ViewSwitch() {
  const fogMode = usePlayUi((state) => state.fogMode);
  const setFogMode = usePlayUi((state) => state.setFogMode);
  return (
    <Segmented
      label={hu.play.viewLabel}
      isLabelHidden
      value={fogMode}
      onChange={setFogMode}
      options={[
        { id: "lamp", label: hu.play.viewLamp, icon: "lantern" },
        { id: "full", label: hu.play.viewFull, icon: "grid" },
      ]}
    />
  );
}

export function Bezel({ name, title, meta, documentTitle, actions }: BezelProps) {
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
          <ViewSwitch />
          <WellZoom />
          <span className="bezel-keys">
            <KeysPopover rows={hu.play.shortcuts} />
          </span>
        </>
      }
    />
  );
}
