import { useState } from "react";
import { toast } from "../../components/ui/Toast.tsx";
import { hu } from "../../i18n/hu.ts";
import { errorMessage } from "../../lib/api.ts";
import { isModified, type ProgramDraft } from "../program-draft.ts";
import {
  fetchProgram,
  type ProgramListItem,
  useDeleteProgram,
  useSaveProgram,
} from "../programs.ts";

export function hasUnsavedWork(draft: ProgramDraft): boolean {
  if (draft.linked !== null) {
    return isModified(draft);
  }
  const source = draft.source.trim();
  return source.length > 0 && source !== hu.play.starterProgram.trim();
}

export type LibraryPanel = "closed" | "library" | "saveAs";

type PersistenceInput = { draft: ProgramDraft; onDraftChange: (draft: ProgramDraft) => void };

export function useProgramPersistence({ draft, onDraftChange }: PersistenceInput) {
  const [panel, setPanel] = useState<LibraryPanel>("closed");
  const [pending, setPending] = useState<ProgramListItem | null>(null);
  const save = useSaveProgram();
  const remove = useDeleteProgram();

  const persist = async (id: number | null, title: string) => {
    try {
      const { program } = await save.mutateAsync({ id, title, source: draft.source });
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
      setPanel("closed");
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

  const saveCurrent = () => {
    if (draft.linked) {
      void persist(draft.linked.id, draft.linked.title);
      return;
    }
    setPanel("saveAs");
  };

  return {
    panel,
    setPanel,
    pending,
    cancelPending: () => setPending(null),
    confirmPending: () => (pending ? void open(pending) : undefined),
    isSaving: save.isPending,
    persist,
    requestOpen,
    deleteProgram,
    saveCurrent,
  };
}

export type ProgramPersistence = ReturnType<typeof useProgramPersistence>;
