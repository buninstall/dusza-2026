import type { Diagnostic } from "@minescript/engine";
import { FileTrigger } from "react-aria-components";
import { Led } from "../components/Led.tsx";
import { Notice } from "../components/Notice.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Select } from "../components/ui/Select.tsx";
import { TextField } from "../components/ui/TextField.tsx";
import { diagnosticTitles, hu } from "../i18n/hu.ts";
import "./MapEditor.css";

export type Visibility = "public" | "private";

export type MapDetails = { title: string; description: string; visibility: Visibility };

export const TITLE_MAX = 80;
export const DESCRIPTION_MAX = 500;

type DetailsFieldsProps = { details: MapDetails; onChange: (details: MapDetails) => void };

export function DetailsFields({ details, onChange }: DetailsFieldsProps) {
  return (
    <>
      <TextField
        label={hu.mapEditor.titleField}
        value={details.title}
        onChange={(title) => onChange({ ...details, title })}
        isRequired
        maxLength={TITLE_MAX}
      />
      <TextField
        label={hu.mapEditor.descriptionField}
        value={details.description}
        onChange={(description) => onChange({ ...details, description })}
        isMultiline
        maxLength={DESCRIPTION_MAX}
      />
      <Select
        label={hu.mapEditor.visibility}
        value={details.visibility}
        onChange={(visibility) => onChange({ ...details, visibility })}
        options={[
          { id: "public", label: hu.maps.public },
          { id: "private", label: hu.maps.private },
        ]}
      />
    </>
  );
}

export function DiagnosticItems({ diagnostics }: { diagnostics: readonly Diagnostic[] }) {
  return (
    <ul className="editor-diagnostics">
      {diagnostics.map((diagnostic, index) => (
        <li key={`${diagnostic.code}-${index.toString()}`} data-severity={diagnostic.severity}>
          <span className="editor-diagnostic-line">{hu.common.lineRef(diagnostic.span.line)}</span>
          <span>
            <strong>{diagnosticTitles[diagnostic.code]}.</strong> {diagnostic.message}
          </span>
        </li>
      ))}
    </ul>
  );
}

type ValidationReadoutProps = {
  errors: readonly Diagnostic[];
  warnings: readonly Diagnostic[];
  isTitleMissing: boolean;
};

export function ValidationReadout({ errors, warnings, isTitleMissing }: ValidationReadoutProps) {
  const isValid = errors.length === 0 && !isTitleMissing;
  return (
    <div className="editor-readout">
      <output>
        <Led
          state={isValid ? "ok" : "error"}
          label={isValid ? hu.mapEditor.valid : hu.mapEditor.invalid}
        />
      </output>
      {isTitleMissing ? <p className="editor-problem">{hu.mapEditor.titleMissing}</p> : null}
      {errors.length > 0 ? <DiagnosticItems diagnostics={errors} /> : null}
      {warnings.length > 0 ? (
        <>
          <p className="editor-subheading">{hu.mapEditor.warnings}</p>
          <DiagnosticItems diagnostics={warnings} />
        </>
      ) : null}
    </div>
  );
}

type FileControlsProps = {
  canExport: boolean;
  importError: { message: string; diagnostics: readonly Diagnostic[] } | null;
  onImport: (files: FileList | null) => void;
  onExport: () => void;
};

export function FileControls({ canExport, importError, onImport, onExport }: FileControlsProps) {
  return (
    <>
      <div className="editor-button-row">
        <FileTrigger acceptedFileTypes={[".txt", "text/plain"]} onSelect={onImport}>
          <Button size="sm" icon="upload">
            {hu.mapEditor.importMap}
          </Button>
        </FileTrigger>
        <Button size="sm" icon="download" isDisabled={!canExport} onPress={onExport}>
          {hu.mapEditor.exportMap}
        </Button>
      </div>
      {importError ? (
        <Notice tone="error" title={importError.message} live="alert">
          {importError.diagnostics.length > 0 ? (
            <DiagnosticItems diagnostics={importError.diagnostics} />
          ) : null}
        </Notice>
      ) : null}
    </>
  );
}

export type VersionInfo = { current: number; next: number; runCount: number };

export function VersionNote({ version }: { version: VersionInfo }) {
  return (
    <div className="editor-version-note">
      <p className="editor-version-badge">{hu.maps.version(version.current)}</p>
      <p>{hu.mapEditor.versionCurrent(version.current)}</p>
      <p>
        {version.runCount > 0
          ? hu.mapEditor.versionWillFork(version.runCount, version.next)
          : hu.mapEditor.versionInPlace}
      </p>
      <p className="editor-muted">{hu.mapEditor.versionMetaOnly}</p>
    </div>
  );
}
