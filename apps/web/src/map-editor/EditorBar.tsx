import type { Ref } from "react";
import { FileTrigger } from "react-aria-components";
import { Led, type LedState } from "../components/Led.tsx";
import { LocationPlate } from "../components/LocationPlate.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Link } from "../components/ui/Link.tsx";
import { TextField } from "../components/ui/TextField.tsx";
import { hu } from "../i18n/hu.ts";
import { firstFile } from "../lib/files.ts";
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

export function EditorBar(props: EditorBarProps) {
  const chip = CHIP[props.saveState];
  const isNew = props.mapId === null;
  return (
    <LocationPlate
      name={hu.signs.editor}
      hasSign={false}
      detail={isNew ? hu.mapEditor.newTitle : hu.mapEditor.editTitle}
      documentTitle={isNew ? hu.mapEditor.documentNew : hu.mapEditor.documentEdit(props.title)}
      className="ed-bar"
      lead={
        <Link to="/maps" variant="ghost" size="sm" icon="arrowLeft" className="ed-back">
          {hu.mapEditor.back}
        </Link>
      }
      meta={props.version === null ? undefined : hu.maps.version(props.version)}
      actions={
        <>
          {props.mapId === null ? null : (
            <Link
              to="/play/$mapId"
              params={{ mapId: String(props.mapId) }}
              variant="secondary"
              size="sm"
              icon="play"
            >
              {hu.mapEditor.tryOut}
            </Link>
          )}
          <FileTrigger
            acceptedFileTypes={[".txt", "text/plain"]}
            onSelect={(files) => {
              const file = firstFile(files);
              if (file) {
                props.onImport(file);
              }
            }}
          >
            <Button size="sm" icon="upload">
              {hu.mapEditor.importMap}
            </Button>
          </FileTrigger>
          <Button
            size="sm"
            icon="download"
            data-blocked={props.isExportBlocked}
            onPress={props.onExport}
          >
            {hu.mapEditor.exportMap}
          </Button>
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
