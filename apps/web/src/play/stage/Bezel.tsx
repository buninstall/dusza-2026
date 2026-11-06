import type { ReactNode } from "react";
import { LocationPlate } from "../../components/LocationPlate.tsx";
import { Segmented } from "../../components/ui/Segmented.tsx";
import { hu } from "../../i18n/hu.ts";
import { usePlayUi } from "../play-ui-store.ts";
import { KeysPopover } from "./KeysPopover.tsx";

type BezelProps = {
  name: string;
  title: string;
  meta: string;
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

export function WellBar({
  description,
  descriptionId,
}: {
  description?: string | undefined;
  descriptionId: string;
}) {
  return (
    <div className="well-bar">
      {description ? (
        <p id={descriptionId} className="well-description">
          {description}
        </p>
      ) : (
        <span className="well-description" />
      )}
      <ViewSwitch />
    </div>
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
      meta={meta}
      actions={
        <>
          {actions}
          <KeysPopover rows={hu.play.shortcuts} />
        </>
      }
    />
  );
}
