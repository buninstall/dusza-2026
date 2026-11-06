import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Form } from "react-aria-components";
import { Loading } from "../../app/StatusScreens.tsx";
import { Notice } from "../../components/Notice.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { ConfirmDialog, ModalShell } from "../../components/ui/Dialog.tsx";
import { TextField } from "../../components/ui/TextField.tsx";
import { formatTime, hu } from "../../i18n/hu.ts";
import { errorMessage } from "../../lib/api.ts";
import { hasVisibleText } from "../../lib/text.ts";
import type { ProgramDraft } from "../program-draft.ts";
import { type ProgramListItem, programsQuery } from "../programs.ts";
import type { ProgramPersistence } from "./useProgramPersistence.ts";

const TITLE_MAX = 80;

type ProgramRowProps = {
  program: ProgramListItem;
  isCurrent: boolean;
  onLoad: () => void;
  onDelete: () => void;
};

function ProgramRow({ program, isCurrent, onLoad, onDelete }: ProgramRowProps) {
  return (
    <li className="library-row" data-current={isCurrent}>
      <span className="library-title">
        {program.title}
        <span className="library-meta">{hu.programs.updated(formatTime(program.updatedAt))}</span>
      </span>
      <span className="library-actions">
        <Button
          size="sm"
          icon="folder"
          aria-label={hu.programs.loadFor(program.title)}
          onPress={onLoad}
        >
          {hu.programs.load}
        </Button>
        <ConfirmDialog
          triggerLabel={hu.programs.remove}
          triggerAriaLabel={hu.programs.removeFor(program.title)}
          triggerIcon="trash"
          triggerVariant="ghost"
          title={hu.programs.removeTitle}
          body={hu.programs.removeBody(program.title)}
          confirmLabel={hu.programs.removeConfirm}
          onConfirm={onDelete}
        />
      </span>
    </li>
  );
}

function SaveAsForm({
  defaultTitle,
  isLocked,
  onSave,
}: {
  defaultTitle: string;
  isLocked: boolean;
  onSave: (title: string) => void;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (hasVisibleText(title)) {
      onSave(title.trim());
    }
  };
  return (
    <Form className="library-save" onSubmit={handleSubmit}>
      <TextField
        label={hu.programs.titleField}
        value={title}
        onChange={setTitle}
        isRequired
        maxLength={TITLE_MAX}
        validate={(value) => (hasVisibleText(value) ? null : hu.programs.titleInvisible)}
      />
      <Button type="submit" variant="primary" icon="save" isDisabled={isLocked}>
        {hu.programs.saveAsSubmit}
      </Button>
    </Form>
  );
}

type ProgramLibraryDialogProps = {
  draft: ProgramDraft;
  defaultTitle: string;
  isLocked: boolean;
  persistence: ProgramPersistence;
};

function LibraryList({
  draft,
  persistence,
}: Pick<ProgramLibraryDialogProps, "draft" | "persistence">) {
  const programs = useQuery(programsQuery);
  if (programs.error) {
    return <Notice tone="error" title={errorMessage(programs.error, hu.programs.loadFailed)} />;
  }
  if (programs.isPending) {
    return <Loading />;
  }
  if (programs.data.programs.length === 0) {
    return <p className="library-meta">{hu.programs.empty}</p>;
  }
  return (
    <ul className="library-list">
      {programs.data.programs.map((program) => (
        <ProgramRow
          key={program.id}
          program={program}
          isCurrent={draft.linked?.id === program.id}
          onLoad={() => persistence.requestOpen(program)}
          onDelete={() => void persistence.deleteProgram(program.id)}
        />
      ))}
    </ul>
  );
}

export function ProgramLibraryDialog({
  draft,
  defaultTitle,
  isLocked,
  persistence,
}: ProgramLibraryDialogProps) {
  const { panel, setPanel, pending } = persistence;
  const isSaveAs = panel === "saveAs";
  const save = async (title: string) => {
    if (await persistence.persist(null, title)) {
      setPanel("closed");
    }
  };
  return (
    <ModalShell
      title={isSaveAs ? hu.programs.saveAsTitle : hu.programs.libraryTitle}
      size="wide"
      isOpen={panel !== "closed"}
      onOpenChange={(isOpen) => setPanel(isOpen ? panel : "closed")}
    >
      {() => (
        <>
          <SaveAsForm
            defaultTitle={draft.linked?.title ?? defaultTitle}
            isLocked={isLocked}
            onSave={(title) => void save(title)}
          />
          {pending ? (
            <Notice
              tone="warning"
              title={hu.programs.replaceTitle}
              live="alert"
              actions={
                <>
                  <Button size="sm" onPress={persistence.cancelPending}>
                    {hu.common.cancel}
                  </Button>
                  <Button size="sm" variant="primary" onPress={persistence.confirmPending}>
                    {hu.programs.replaceConfirm}
                  </Button>
                </>
              }
            >
              {hu.programs.replaceBody}
            </Notice>
          ) : null}
          {isSaveAs ? null : <LibraryList draft={draft} persistence={persistence} />}
        </>
      )}
    </ModalShell>
  );
}
