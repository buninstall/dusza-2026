import type { ReactNode } from "react";
import { useDocumentTitle } from "../../components/LocationPlate.tsx";
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
  useDocumentTitle(documentTitle ?? title);
  return (
    <header className="bezel k-panel">
      <div className="bezel-id">
        <h1 className="bezel-plaque k-plaque">
          <span className="bezel-title">{title}</span>
        </h1>
        <div className="bezel-facts">
          <span aria-hidden="true" className="bezel-sign">
            {name}
          </span>
          {meta ? <p className="bezel-meta">{meta}</p> : null}
        </div>
      </div>
      <div className="bezel-controls">
        {actions}
        <ViewSwitch isLocked={isFullLocked} />
        <WellZoom />
        <span className="bezel-keys">
          <KeysPopover rows={hu.play.shortcuts} />
        </span>
      </div>
    </header>
  );
}
