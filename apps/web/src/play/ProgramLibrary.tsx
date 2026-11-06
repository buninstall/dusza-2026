import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Form } from "react-aria-components";
import { Loading } from "../app/StatusScreens.tsx";
import { Notice } from "../components/Notice.tsx";
import { Button } from "../components/ui/Button.tsx";
import { ConfirmDialog, ModalShell } from "../components/ui/Dialog.tsx";
import { TextField } from "../components/ui/TextField.tsx";
import { toast } from "../components/ui/Toast.tsx";
import { formatTime, hu } from "../i18n/hu.ts";
import { errorMessage } from "../lib/api.ts";
import { isModified, type ProgramDraft } from "./program-draft.ts";
import "./PlayPage.css";
import {
  fetchProgram,
  type ProgramListItem,
  programsQuery,
  useDeleteProgram,
  useSaveProgram,
} from "./programs.ts";

type ProgramControlsProps = {
  draft: ProgramDraft;
  defaultTitle: string;
  isLocked: boolean;
  onDraftChange: (draft: ProgramDraft) => void;
};

const TITLE_MAX = 80;

function hasUnsavedWork(draft: ProgramDraft): boolean {
  return draft.linked === null ? draft.source.trim().length > 0 : isModified(draft);
}

function ProgramRow({
  program,
  isCurrent,
  onLoad,
  onDelete,
}: {
  program: ProgramListItem;
  isCurrent: boolean;
  onLoad: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="play-program-row" data-current={isCurrent}>
      <span className="play-program-title">
        {program.title}
        <span className="play-muted">{hu.programs.updated(formatTime(program.updatedAt))}</span>
      </span>
      <span className="play-program-actions">
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
          confirmLabel={hu.programs.remove}
          onConfirm={onDelete}
        />
      </span>
    </li>
  );
}

export function ProgramControls({
  draft,
  defaultTitle,
  isLocked,
  onDraftChange,
}: ProgramControlsProps) {
  const [isOpen, setOpen] = useState(false);
  const [pending, setPending] = useState<ProgramListItem | null>(null);
  const [title, setTitle] = useState(draft.linked?.title ?? defaultTitle);
  const programs = useQuery({ ...programsQuery, enabled: isOpen });
  const save = useSaveProgram();
  const remove = useDeleteProgram();

  const persist = async (id: number | null, programTitle: string) => {
    try {
      const { program } = await save.mutateAsync({ id, title: programTitle, source: draft.source });
      onDraftChange({
        source: draft.source,
        linked: { id: program.id, title: program.title, savedSource: program.source },
      });
      toast.success(hu.programs.saved(program.title));
      return true;
    } catch (error) {
      toast.error(errorMessage(error, hu.app.unexpected));
      return false;
    }
  };

  const open = async (item: ProgramListItem) => {
    try {
      const { program } = await fetchProgram(item.id);
      onDraftChange({
        source: program.source,
        linked: { id: program.id, title: program.title, savedSource: program.source },
      });
      setPending(null);
      setOpen(false);
      toast.success(hu.programs.loaded(program.title));
    } catch (error) {
      toast.error(errorMessage(error, hu.programs.loadFailed));
    }
  };

  const requestOpen = (item: ProgramListItem) => {
    if (hasUnsavedWork(draft) && draft.linked?.id !== item.id) {
      setPending(item);
      return;
    }
    void open(item);
  };

  const deleteProgram = async (id: number) => {
    try {
      await remove.mutateAsync(id);
      if (draft.linked?.id === id) {
        onDraftChange({ source: draft.source, linked: null });
      }
      toast.success(hu.programs.removed);
    } catch (error) {
      toast.error(errorMessage(error, hu.app.unexpected));
    }
  };

  const submitSaveAs = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (await persist(null, title.trim())) {
      setOpen(false);
    }
  };

  const linked = draft.linked;

  return (
    <>
      <Button
        size="sm"
        icon="save"
        isDisabled={isLocked}
        isPending={save.isPending}
        onPress={() => (linked ? void persist(linked.id, linked.title) : setOpen(true))}
      >
        {hu.programs.save}
      </Button>
      <Button size="sm" icon="folder" onPress={() => setOpen(true)}>
        {hu.programs.library}
      </Button>
      <ModalShell title={hu.programs.libraryTitle} isOpen={isOpen} onOpenChange={setOpen}>
        {() => (
          <>
            <p className="play-muted">{hu.programs.libraryLead}</p>
            <Form className="play-save-as" onSubmit={(event) => void submitSaveAs(event)}>
              <TextField
                label={hu.programs.titleField}
                value={title}
                onChange={setTitle}
                isRequired
                maxLength={TITLE_MAX}
              />
              <Button type="submit" variant="primary" icon="save" isDisabled={isLocked}>
                {hu.programs.saveAs}
              </Button>
            </Form>
            {pending ? (
              <Notice
                tone="warning"
                title={hu.programs.replaceTitle}
                live="alert"
                actions={
                  <>
                    <Button size="sm" onPress={() => setPending(null)}>
                      {hu.common.cancel}
                    </Button>
                    <Button size="sm" variant="primary" onPress={() => void open(pending)}>
                      {hu.programs.replaceConfirm}
                    </Button>
                  </>
                }
              >
                {hu.programs.replaceBody}
              </Notice>
            ) : null}
            {programs.error ? (
              <Notice tone="error" title={errorMessage(programs.error, hu.programs.loadFailed)} />
            ) : null}
            {programs.isPending ? <Loading /> : null}
            {programs.data?.programs.length === 0 ? (
              <p className="play-muted">{hu.programs.empty}</p>
            ) : null}
            {programs.data && programs.data.programs.length > 0 ? (
              <ul className="play-program-list">
                {programs.data.programs.map((program) => (
                  <ProgramRow
                    key={program.id}
                    program={program}
                    isCurrent={linked?.id === program.id}
                    onLoad={() => requestOpen(program)}
                    onDelete={() => void deleteProgram(program.id)}
                  />
                ))}
              </ul>
            ) : null}
          </>
        )}
      </ModalShell>
    </>
  );
}
