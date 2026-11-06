import { type ChangeEvent, type ReactNode, useRef } from "react";
import { Button } from "../../components/ui/Button.tsx";
import { IconButton } from "../../components/ui/IconButton.tsx";
import { Menu, MenuItem, MenuSeparator } from "../../components/ui/Menu.tsx";
import { hu } from "../../i18n/hu.ts";
import { PixelIcon } from "../../pixel/PixelIcon.tsx";
import { isModified, type ProgramDraft } from "../program-draft.ts";

type FileActions = {
  onImport?: ((file: File) => void) | undefined;
  onExport: () => void;
  onSaveAs?: (() => void) | undefined;
  isLocked: boolean;
};

export function FileMenu({ onImport, onExport, onSaveAs, isLocked }: FileActions) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.item(0);
    event.target.value = "";
    if (file && onImport) {
      onImport(file);
    }
  };
  return (
    <>
      <Menu
        label={hu.play.fileMenu}
        ariaLabel={hu.play.fileMenuLabel}
        icon="folder"
        variant="secondary"
        placement="bottom start"
      >
        {onSaveAs ? (
          <MenuItem onAction={onSaveAs} isDisabled={isLocked} textValue={hu.programs.saveAs}>
            {hu.programs.saveAs}
            <kbd>Ctrl+Shift+S</kbd>
          </MenuItem>
        ) : null}
        {onImport ? (
          <MenuItem onAction={() => inputRef.current?.click()} isDisabled={isLocked}>
            {hu.play.importProgram}
          </MenuItem>
        ) : null}
        {onSaveAs || onImport ? <MenuSeparator /> : null}
        <MenuItem onAction={onExport}>{hu.play.exportProgram}</MenuItem>
      </Menu>
      {onImport ? (
        <input
          ref={inputRef}
          type="file"
          accept=".ms,.txt,text/plain"
          hidden
          onChange={handleFile}
        />
      ) : null}
    </>
  );
}

export function DocumentTab({
  draft,
  isLocked,
  lockText,
}: {
  draft: ProgramDraft;
  isLocked: boolean;
  lockText: string;
}) {
  if (isLocked) {
    return (
      <span className="sheet-tab" data-state="locked">
        <PixelIcon name="lock" size="sm" />
        {lockText}
      </span>
    );
  }
  if (draft.linked === null) {
    return null;
  }
  return (
    <span className="sheet-tab">
      <span className="sheet-tab-title">{hu.programs.current(draft.linked.title)}</span>
      {isModified(draft) ? <em className="sheet-pill">{hu.programs.modified}</em> : null}
    </span>
  );
}

type SheetToolbarProps = FileActions & {
  onOpenLibrary: () => void;
  onFormat: () => void;
  onSave: () => void;
  isSaving: boolean;
  status?: ReactNode;
};

export function SheetToolbar({
  onOpenLibrary,
  onFormat,
  onSave,
  isSaving,
  status,
  ...file
}: SheetToolbarProps) {
  return (
    <SheetBar>
      <FileMenu {...file} />
      <Button size="sm" icon="book" aria-keyshortcuts="Control+O" onPress={onOpenLibrary}>
        {hu.programs.library}
      </Button>
      <span className="sheet-spacer">{status}</span>
      <IconButton
        size="sm"
        icon="format"
        label={hu.play.format}
        tooltip={hu.play.withKey(hu.play.format, "Shift+Alt+F")}
        aria-keyshortcuts="Shift+Alt+F"
        isDisabled={file.isLocked}
        onPress={onFormat}
      />
      <Button
        size="sm"
        icon="save"
        aria-keyshortcuts="Control+S"
        isDisabled={file.isLocked}
        isPending={isSaving}
        onPress={onSave}
      >
        {hu.programs.save}
      </Button>
    </SheetBar>
  );
}

export function SheetBar({ children }: { children: ReactNode }) {
  return <div className="sheet-toolbar">{children}</div>;
}
