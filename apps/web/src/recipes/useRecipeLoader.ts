import { useEffect, useRef, useState } from "react";
import { toast } from "../components/ui/Toast.tsx";
import { hu } from "../i18n/hu.ts";
import { writeStorage } from "../lib/storage.ts";
import { usePlayUi } from "../play/play-ui-store.ts";
import { draftKey, type ProgramDraft, readDraft } from "../play/program-draft.ts";
import { hasUnsavedWork } from "../play/sheet/useProgramPersistence.ts";
import { findRecipe, type ProgramRecipe, recipeText } from "./catalog.ts";

export type LoadedRecipe = { draft: ProgramDraft; nonce: number };

function needsConfirm(mapId: number, source: string): boolean {
  const draft = readDraft(mapId);
  return (
    hasUnsavedWork(draft) && draft.source !== hu.play.starterProgram && draft.source !== source
  );
}

export function useRecipeLoader(mapId: number, slug: string | undefined, clearSlug: () => void) {
  const [pending, setPending] = useState<ProgramRecipe | null>(null);
  const [loaded, setLoaded] = useState<LoadedRecipe | null>(null);

  const apply = (recipe: ProgramRecipe) => {
    const draft: ProgramDraft = { source: recipeText(recipe.file), linked: null };
    writeStorage(draftKey(mapId), JSON.stringify(draft));
    setPending(null);
    setLoaded({ draft, nonce: Date.now() });
    usePlayUi.getState().setPane("sheet");
    toast.success(hu.recipes.loaded(recipe.title));
    clearSlug();
  };

  const cancel = () => {
    setPending(null);
    clearSlug();
  };

  const latest = useRef({ apply, clearSlug });
  latest.current = { apply, clearSlug };
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (slug === undefined) {
      handled.current = null;
      return;
    }
    if (handled.current === slug) {
      return;
    }
    handled.current = slug;
    const recipe = findRecipe(slug);
    if (!recipe) {
      latest.current.clearSlug();
    } else if (needsConfirm(mapId, recipeText(recipe.file))) {
      setPending(recipe);
    } else {
      latest.current.apply(recipe);
    }
  }, [slug, mapId]);

  return { pending, loaded, confirm: () => pending && apply(pending), cancel };
}
