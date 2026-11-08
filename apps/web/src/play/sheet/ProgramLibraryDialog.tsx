import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Form } from "react-aria-components";
import { Notice } from "../../components/Notice.tsx";
import { Pager } from "../../components/Pager.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { ConfirmDialog, ModalShell } from "../../components/ui/Dialog.tsx";
import { SearchField } from "../../components/ui/SearchField.tsx";
import { Select } from "../../components/ui/Select.tsx";
import { TextField } from "../../components/ui/TextField.tsx";
import { formatTime, hu } from "../../i18n/hu.ts";
import { browse, library } from "../../i18n/hu-browse.ts";
import { errorMessage } from "../../lib/api.ts";
import { hasVisibleText } from "../../lib/text.ts";
import type { ProgramDraft } from "../program-draft.ts";
import {
  PROGRAM_SORTS,
  type ProgramListItem,
  type ProgramPage,
  type ProgramParams,
  type ProgramSort,
  programsQuery,
} from "../programs.ts";
import type { ProgramPersistence } from "./useProgramPersistence.ts";

const SEARCH_MAX = 80;
const SORT_OPTIONS = PROGRAM_SORTS.map((id) => ({ id, label: library.sorts[id] }));

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
        <span className="library-meta">
          {hu.programs.updated(formatTime(program.updatedAt))} · {library.lines(program.lines)}
        </span>
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

function LibraryFooter({
  page,
  onPageChange,
}: {
  page: ProgramPage;
  onPageChange: (page: number) => void;
}) {
  const from = (page.page - 1) * page.pageSize + 1;
  const to = from + page.programs.length - 1;
  return (
    <div className="library-footer">
      <p className="library-meta">
        {library.range(from, to, page.total)} · {library.quota(page.quota.used, page.quota.limit)}
      </p>
      <Pager page={page.page} pageCount={page.pageCount} onChange={onPageChange} />
    </div>
  );
}

function LibraryList({
  draft,
  persistence,
}: Pick<ProgramLibraryDialogProps, "draft" | "persistence">) {
  const [params, setParams] = useState<ProgramParams>({ q: "", sort: "recent", page: 1 });
  const programs = useQuery(programsQuery(params));
  const tools = (
    <div className="library-tools">
      <SearchField
        label={library.searchLabel}
        clearLabel={browse.searchClear}
        placeholder={library.searchPlaceholder}
        maxLength={SEARCH_MAX}
        value={params.q}
        onCommit={(q) => setParams((current) => ({ ...current, q, page: 1 }))}
      />
      <Select
        label={library.sortLabel}
        value={params.sort}
        options={SORT_OPTIONS}
        onChange={(sort: ProgramSort) => setParams((current) => ({ ...current, sort, page: 1 }))}
      />
    </div>
  );
  return (
    <>
      {tools}
      <LibraryBody
        programs={programs}
        params={params}
        draft={draft}
        persistence={persistence}
        onPageChange={(next) => setParams((current) => ({ ...current, page: next }))}
      />
    </>
  );
}

type LibraryBodyProps = Pick<ProgramLibraryDialogProps, "draft" | "persistence"> & {
  programs: UseQueryResult<ProgramPage>;
  params: ProgramParams;
  onPageChange: (page: number) => void;
};

function LibraryBody({ programs, params, draft, persistence, onPageChange }: LibraryBodyProps) {
  if (programs.error) {
    return <Notice tone="error" title={errorMessage(programs.error, hu.programs.loadFailed)} />;
  }
  if (!programs.data) {
    return null;
  }
  const page = programs.data;
  if (page.total === 0) {
    return (
      <p className="library-meta">
        {params.q.length > 0 ? library.noMatch(params.q) : hu.programs.empty}
      </p>
    );
  }
  return (
    <>
      <ul
        className="library-list"
        aria-label={library.listLabel}
        aria-busy={programs.isPlaceholderData}
        data-turning={programs.isPlaceholderData}
      >
        {page.programs.map((program) => (
          <ProgramRow
            key={program.id}
            program={program}
            isCurrent={draft.linked?.id === program.id}
            onLoad={() => persistence.requestOpen(program)}
            onDelete={() => void persistence.deleteProgram(program.id)}
          />
        ))}
      </ul>
      <LibraryFooter page={page} onPageChange={onPageChange} />
    </>
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
