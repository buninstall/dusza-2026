import { type ChangeEvent, type ReactNode, useRef } from "react";
import { Button } from "../../components/ui/Button.tsx";
import { IconButton } from "../../components/ui/IconButton.tsx";
import { Menu, MenuItem, MenuSeparator } from "../../components/ui/Menu.tsx";
import { hu } from "../../i18n/hu.ts";

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

type SheetToolbarProps = FileActions & {
  onOpenLibrary: () => void;
  onFormat: () => void;
  onSave: () => void;
  isSaving: boolean;
};

export function SheetToolbar({
  onOpenLibrary,
  onFormat,
  onSave,
  isSaving,
  ...file
}: SheetToolbarProps) {
  return (
    <SheetBar>
      <FileMenu {...file} />
      <Button
        size="sm"
        icon="book"
        className="sheet-compact"
        aria-keyshortcuts="Control+O"
        onPress={onOpenLibrary}
      >
        <span className="sheet-compact-label">{hu.programs.library}</span>
      </Button>
      <span className="sheet-spacer" />
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
        className="sheet-compact"
        aria-keyshortcuts="Control+S"
        isDisabled={file.isLocked}
        isPending={isSaving}
        onPress={onSave}
      >
        <span className="sheet-compact-label">{hu.programs.save}</span>
      </Button>
    </SheetBar>
  );
}

export function SheetBar({ children }: { children: ReactNode }) {
  return <div className="sheet-toolbar">{children}</div>;
}
