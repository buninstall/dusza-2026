import type { Diagnostic, Pos } from "@minescript/engine";
import { clsx } from "clsx";
import type { ReactNode, Ref } from "react";
import { Led } from "../components/Led.tsx";
import { Notice } from "../components/Notice.tsx";
import { Button } from "../components/ui/Button.tsx";
import { ConfirmDialog } from "../components/ui/Dialog.tsx";
import { Link } from "../components/ui/Link.tsx";
import { NumberField } from "../components/ui/NumberField.tsx";
import { Segmented } from "../components/ui/Segmented.tsx";
import { TextField } from "../components/ui/TextField.tsx";
import { diagnosticTitles, hu } from "../i18n/hu.ts";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
import type { LampMode } from "../play/lamp-mode.ts";

export type Visibility = "public" | "private";

export type MapDetails = {
  title: string;
  description: string;
  visibility: Visibility;
  parSteps: number | null;
  lampMode: LampMode;
};

export type VersionInfo = { current: number; next: number; runCount: number };

export type ImportError = { file: string; message: string; diagnostics: readonly Diagnostic[] };

export const TITLE_MAX = 80;
export const PAR_MAX = 1000;
export const DESCRIPTION_MAX = 500;

function InspectorSection({
  title,
  headingRef,
  className,
  isTitleHidden = false,
  children,
}: {
  title: string;
  headingRef?: Ref<HTMLHeadingElement>;
  className?: string;
  isTitleHidden?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={clsx("k-panel ed-section", className)} aria-label={title}>
      {isTitleHidden ? (
        <h2 className="visually-hidden">{title}</h2>
      ) : (
        <h2 ref={headingRef} tabIndex={-1} className="ed-section-title">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

function DiagnosticItem({
  diagnostic,
  action,
  hasFileLine = false,
  isBrief = false,
}: {
  diagnostic: Diagnostic;
  action?: ReactNode;
  hasFileLine?: boolean;
  isBrief?: boolean;
}) {
  return (
    <li className="ed-issue" data-severity={diagnostic.severity}>
      {hasFileLine ? (
        <span className="ed-issue-line">{hu.common.lineRef(diagnostic.span.line)}</span>
      ) : null}
      <span className="ed-issue-text">
        <strong>{diagnosticTitles[diagnostic.code]}.</strong>
        {isBrief ? null : ` ${diagnostic.message}`}
      </span>
      {action}
    </li>
  );
}

export function ImportErrorNotice({ error, onClose }: { error: ImportError; onClose: () => void }) {
  return (
    <Notice
      tone="error"
      title={error.message}
      live="alert"
      actions={
        <Button size="sm" icon="close" onPress={onClose}>
          {hu.common.close}
        </Button>
      }
    >
      <p className="mono">{hu.mapEditor.importFile(error.file)}</p>
      {error.diagnostics.length > 0 ? (
        <ul className="ed-issues">
          {error.diagnostics.map((diagnostic, index) => (
            <DiagnosticItem
              key={`${diagnostic.code}-${index.toString()}`}
              diagnostic={diagnostic}
              hasFileLine
            />
          ))}
        </ul>
      ) : null}
    </Notice>
  );
}

type CheckListProps = {
  errors: readonly Diagnostic[];
  warnings: readonly Diagnostic[];
  isTitleMissing: boolean;
  unreachable: readonly Pos[];
  headingRef: Ref<HTMLHeadingElement>;
  onFixTitle: () => void;
  onPickRobot: () => void;
  onPickGold: () => void;
  onGoTo: (pos: Pos) => void;
};

function issueAction(diagnostic: Diagnostic, props: CheckListProps): ReactNode {
  if (diagnostic.code === "MAP_NO_ROBOT") {
    return (
      <Button size="sm" variant="ghost" icon="robot" onPress={props.onPickRobot}>
        {hu.mapEditor.fixRobot}
      </Button>
    );
  }
  if (diagnostic.code === "MAP_NO_GOLD") {
    return (
      <Button size="sm" variant="ghost" icon="plus" onPress={props.onPickGold}>
        {hu.mapEditor.fixGold}
      </Button>
    );
  }
  return null;
}

function UnreachableItem({
  unreachable,
  onGoTo,
}: {
  unreachable: readonly Pos[];
  onGoTo: (pos: Pos) => void;
}) {
  return (
    <li className="ed-issue" data-severity="warning">
      <span className="ed-issue-text">
        <strong>{diagnosticTitles.MAP_UNREACHABLE_GOLD}.</strong>
      </span>
      <span className="ed-issue-jumps">
        {unreachable.map((pos) => (
          <Button
            key={`u-${pos.row}-${pos.col}`}
            size="sm"
            variant="ghost"
            icon="arrowRight"
            aria-label={hu.mapEditor.goToLabel(pos.row + 1, pos.col + 1)}
            onPress={() => onGoTo(pos)}
          >
            {hu.mapEditor.goTo(pos.row + 1, pos.col + 1)}
          </Button>
        ))}
      </span>
    </li>
  );
}

export function CheckList(props: CheckListProps) {
  const { errors, warnings, isTitleMissing, unreachable } = props;
  const isValid = errors.length === 0 && !isTitleMissing;
  const others = warnings.filter((diagnostic) => diagnostic.code !== "MAP_UNREACHABLE_GOLD");
  return (
    <InspectorSection title={hu.mapEditor.checkHeading} headingRef={props.headingRef}>
      <output className="ed-verdict" data-valid={isValid}>
        <Led
          state={isValid ? "ok" : "error"}
          label={isValid ? hu.mapEditor.valid : hu.mapEditor.invalid}
          isSentenceCase
        />
      </output>
      <ul className="ed-issues">
        {isTitleMissing ? (
          <li className="ed-issue" data-severity="error">
            <span className="ed-issue-text">
              <strong>{hu.mapEditor.titleMissing}</strong>
            </span>
            <Button size="sm" variant="ghost" icon="format" onPress={props.onFixTitle}>
              {hu.mapEditor.fixTitle}
            </Button>
          </li>
        ) : null}
        {[...errors, ...others].map((diagnostic, index) => (
          <DiagnosticItem
            key={`${diagnostic.code}-${index.toString()}`}
            diagnostic={diagnostic}
            action={issueAction(diagnostic, props)}
            isBrief
          />
        ))}
        {unreachable.length > 0 ? (
          <UnreachableItem unreachable={unreachable} onGoTo={props.onGoTo} />
        ) : null}
      </ul>
    </InspectorSection>
  );
}

type DetailsBlockProps = {
  details: MapDetails;
  onChange: (details: MapDetails) => void;
  isParStale: boolean;
  canComputePar: boolean;
  isComputingPar: boolean;
  onComputePar: () => void;
};

export function DetailsBlock({
  details,
  onChange,
  isParStale,
  canComputePar,
  isComputingPar,
  onComputePar,
}: DetailsBlockProps) {
  return (
    <InspectorSection title={hu.mapEditor.detailsHeading}>
      <div className="ed-par">
        <NumberField
          label={hu.par.field}
          minValue={1}
          maxValue={PAR_MAX}
          value={details.parSteps ?? Number.NaN}
          onChange={(value) =>
            onChange({
              ...details,
              parSteps: Number.isFinite(value) ? Math.round(value) : null,
            })
          }
        />
        <Button
          size="sm"
          icon="robot"
          isDisabled={!canComputePar || isComputingPar}
          onPress={onComputePar}
          className="ed-par-compute"
        >
          {isComputingPar ? hu.par.computing : hu.par.compute}
        </Button>
      </div>
      <output className="ed-stale">
        {isParStale ? (
          <>
            <PixelIcon name="warning" size="sm" />
            {hu.par.stale}
          </>
        ) : null}
      </output>
      <TextField
        label={hu.mapEditor.descriptionField}
        value={details.description}
        onChange={(description) => onChange({ ...details, description })}
        isMultiline
        rows={2}
        maxLength={DESCRIPTION_MAX}
      />
      <Segmented
        label={hu.mapEditor.visibility}
        value={details.visibility}
        onChange={(visibility) => onChange({ ...details, visibility })}
        options={[
          { id: "public", label: hu.maps.public, icon: "grid" },
          { id: "private", label: hu.maps.private, icon: "lock" },
        ]}
      />
      <Segmented
        label={hu.mapEditor.lampMode}
        value={details.lampMode}
        onChange={(lampMode) => onChange({ ...details, lampMode })}
        options={[
          { id: "open", label: hu.mapEditor.lampOpen },
          { id: "lamp", label: hu.mapEditor.lampLamp },
          { id: "dark", label: hu.mapEditor.lampDark },
        ]}
      />
    </InspectorSection>
  );
}

type VersionBlockProps = {
  mapId: number;
  title: string;
  version: VersionInfo;
  onDelete: () => void;
};

export function VersionBlock({ mapId, title, version, onDelete }: VersionBlockProps) {
  return (
    <InspectorSection
      title={hu.mapEditor.versionHeading}
      className="ed-version-block"
      isTitleHidden
    >
      <p className="ed-version">
        {version.runCount > 0
          ? hu.mapEditor.versionSummary(version.current, version.runCount)
          : hu.mapEditor.versionSummaryEmpty(version.current)}
      </p>
      <div className="ed-version-actions">
        <Link
          to="/leaderboard/$mapId"
          params={{ mapId: String(mapId) }}
          variant="secondary"
          size="sm"
          icon="trophy"
          className="ed-version-board"
        >
          {hu.mapEditor.toLeaderboard}
        </Link>
        <ConfirmDialog
          triggerLabel={hu.mapEditor.deleteMap}
          isTriggerIconOnly
          triggerIcon="trash"
          triggerVariant="danger"
          title={hu.mapEditor.deleteTitle}
          body={hu.mapEditor.deleteConfirm(title)}
          confirmLabel={hu.mapEditor.confirmDelete}
          onConfirm={onDelete}
        />
      </div>
    </InspectorSection>
  );
}
