import { type ChangeEvent, type Ref, useRef } from "react";
import { Led, type LedState } from "../components/Led.tsx";
import { LocationPlate } from "../components/LocationPlate.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Link } from "../components/ui/Link.tsx";
import { Menu, MenuItem } from "../components/ui/Menu.tsx";
import { TextField } from "../components/ui/TextField.tsx";
import { hu } from "../i18n/hu.ts";
import { TITLE_MAX } from "./Inspector.tsx";

export type SaveState = "new" | "dirty" | "saving" | "saved" | "clean";

const CHIP: Record<SaveState, { led: LedState; label: string }> = {
  new: { led: "off", label: hu.mapEditor.chipNew },
  dirty: { led: "warn", label: hu.mapEditor.chipDirty },
  saving: { led: "busy", label: hu.mapEditor.chipSaving },
  saved: { led: "ok", label: hu.mapEditor.chipSaved },
  clean: { led: "ok", label: hu.mapEditor.chipSaved },
};

type EditorBarProps = {
  mapId: number | null;
  title: string;
  version: number | null;
  forkVersion: number | null;
  saveState: SaveState;
  isSaveBlocked: boolean;
  isExportBlocked: boolean;
  titleRef: Ref<HTMLInputElement>;
  onTitleChange: (title: string) => void;
  onImport: (file: File) => void;
  onExport: () => void;
  onSave: () => void;
  onTry: () => void;
};

function SaveButton({
  saveState,
  forkVersion,
  isBlocked,
  onSave,
}: {
  saveState: SaveState;
  forkVersion: number | null;
  isBlocked: boolean;
  onSave: () => void;
}) {
  const label = forkVersion === null ? hu.mapEditor.save : hu.mapEditor.saveForkLabel(forkVersion);
  return (
    <Button
      variant="primary"
      icon={saveState === "saved" ? "check" : "save"}
      aria-label={label}
      aria-keyshortcuts="Control+S"
      data-blocked={isBlocked}
      isPending={saveState === "saving"}
      onPress={onSave}
      className="ed-save"
    >
      <span className="ed-save-text">
        {saveState === "saving" ? hu.mapEditor.saving : hu.mapEditor.save}
        {forkVersion === null ? null : (
          <span className="ed-save-fork">{hu.mapEditor.saveFork(forkVersion)}</span>
        )}
      </span>
    </Button>
  );
}

function MapFileMenu({
  onImport,
  onExport,
}: {
  onImport: (file: File) => void;
  onExport: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.item(0);
    event.target.value = "";
    if (file) {
      onImport(file);
    }
  };
  return (
    <>
      <Menu
        label={hu.play.fileMenu}
        ariaLabel={hu.mapEditor.fileMenuLabel}
        icon="folder"
        variant="secondary"
        placement="bottom end"
      >
        <MenuItem onAction={() => inputRef.current?.click()}>{hu.mapEditor.importMap}</MenuItem>
        <MenuItem onAction={onExport}>{hu.mapEditor.exportMap}</MenuItem>
      </Menu>
      <input ref={inputRef} type="file" accept=".txt,text/plain" hidden onChange={handleFile} />
    </>
  );
}

export function EditorBar(props: EditorBarProps) {
  const chip = CHIP[props.saveState];
  const isNew = props.mapId === null;
  return (
    <LocationPlate
      name={hu.signs.editor}
      hasSign={false}
      isTitleHidden
      detail={isNew ? hu.mapEditor.newTitle : hu.mapEditor.editTitle}
      className="ed-bar"
      lead={
        <Link to="/maps" variant="ghost" size="sm" icon="arrowLeft" className="ed-back">
          {hu.mapEditor.back}
        </Link>
      }
      actions={
        <>
          {props.mapId !== null && props.saveState !== "dirty" && props.saveState !== "new" ? (
            <Link
              to="/play/$mapId"
              params={{ mapId: String(props.mapId) }}
              variant="secondary"
              size="sm"
              icon="play"
            >
              {hu.mapEditor.tryOut}
            </Link>
          ) : (
            <Button size="sm" icon="play" onPress={props.onTry}>
              {hu.mapEditor.tryOut}
            </Button>
          )}
          <MapFileMenu onImport={props.onImport} onExport={props.onExport} />
          <span className="ed-chip">
            <Led state={chip.led} label={chip.label} isBlinking={props.saveState === "saving"} />
          </span>
          <SaveButton
            saveState={props.saveState}
            forkVersion={props.forkVersion}
            isBlocked={props.isSaveBlocked}
            onSave={props.onSave}
          />
        </>
      }
    >
      <div className="ed-title">
        <TextField
          label={hu.mapEditor.titleField}
          isLabelHidden
          value={props.title}
          onChange={props.onTitleChange}
          isRequired
          maxLength={TITLE_MAX}
          placeholder={hu.mapEditor.titlePlaceholder}
          inputRef={props.titleRef}
        />
      </div>
    </LocationPlate>
  );
}
