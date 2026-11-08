import type { MineMap, RobotState } from "@minescript/engine";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Led } from "../components/Led.tsx";
import { Notice } from "../components/Notice.tsx";
import { Button } from "../components/ui/Button.tsx";
import { ModalShell } from "../components/ui/Dialog.tsx";
import { IconButton } from "../components/ui/IconButton.tsx";
import { Link } from "../components/ui/Link.tsx";
import { toast } from "../components/ui/Toast.tsx";
import type { EditorHandle } from "../editor/MineScriptEditor.tsx";
import { useEngine } from "../engine/useEngine.ts";
import { hu } from "../i18n/hu.ts";
import { usePrefersReducedMotion } from "../lib/motion.ts";
import { writeStorage } from "../lib/storage.ts";
import { mapQuery } from "../maps/queries.ts";
import { EMPTY_SKETCH, isDarkMine } from "../play/lamp-mode.ts";
import { PlayScreen } from "../play/PlayScreen.tsx";
import { SPEED_DEFAULT, usePlayback } from "../play/playback-store.ts";
import { draftKey, readDraft } from "../play/program-draft.ts";
import { hasUnsavedWork } from "../play/sheet/useProgramPersistence.ts";
import { Bezel } from "../play/stage/Bezel.tsx";
import { usePlayView } from "../play/usePlayView.ts";
import { useEngineRun } from "../play/useRunSession.ts";
import type { RunDetail } from "./queries.ts";
import { ReplaySheet } from "./ReplaySheet.tsx";

type ReplayPageProps = { detail: RunDetail; map: MineMap };

function useIsOldVersion(mapId: number, mapVersionId: number): boolean {
  const current = useQuery({ ...mapQuery(mapId), retry: false });
  return current.data !== undefined && current.data.version.id !== mapVersionId;
}

function useAutoplay(run: (source: string) => boolean, source: string) {
  const isReduced = usePrefersReducedMotion();
  useEffect(() => {
    usePlayback.getState().setSpeed(SPEED_DEFAULT);
    if (run(source) && isReduced) {
      usePlayback.getState().pause();
      usePlayback.getState().seek(0);
    }
  }, [run, source, isReduced]);
}

function RecordedLine({ gold, steps }: { gold: number; steps: number }) {
  const result = usePlayback((state) => state.result);
  const hasEnded = usePlayback((state) => state.hasEnded);
  const isDrift = hasEnded && result !== null && (result.gold !== gold || result.steps !== steps);
  return (
    <>
      <Led state="ok" label={hu.play.recorded(gold, steps)} isSentenceCase />
      {isDrift ? <Notice tone="warning" title={hu.play.engineDrift} /> : null}
    </>
  );
}

export function ReplayPage({ detail, map }: ReplayPageProps) {
  const { run } = detail;
  const engine = useEngine();
  const navigate = useNavigate();
  const descriptionId = useId();
  const editorRef = useRef<EditorHandle>(null);
  const [isConfirming, setConfirming] = useState(false);
  const start = useMemo<RobotState>(() => ({ pos: map.robot, dir: map.dir }), [map]);
  const info = useMemo(() => engine.mapInfo(map), [engine, map]);
  const engineRun = useEngineRun(detail.map.content, start);
  const view = usePlayView(run.source, engineRun.blocked, map);
  const isOld = useIsOldVersion(run.mapId, run.mapVersionId);
  useAutoplay(engineRun.run, run.source);

  const openInEditor = () => {
    writeStorage(draftKey(run.mapId), JSON.stringify({ source: run.source, linked: null }));
    void navigate({ to: "/play/$mapId", params: { mapId: String(run.mapId) } });
  };

  const requestOpen = () => {
    const draft = readDraft(run.mapId);
    if (hasUnsavedWork(draft) && draft.source !== run.source) {
      setConfirming(true);
      return;
    }
    openInEditor();
  };

  const meta = [hu.share.runBy(run.username), isOld ? hu.replay.oldVersion : null]
    .filter((part) => part !== null)
    .join(" · ");

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success(hu.share.copied);
    } catch {
      toast.error(hu.share.copyFailed);
    }
  };

  const bezel = (
    <Bezel
      name={hu.signs.replay}
      title={run.mapTitle}
      meta={meta}
      isFullLocked={isDarkMine(detail.map.lampMode) && !run.isOwn}
      documentTitle={hu.replay.documentTitle(run.mapTitle)}
      actions={
        <>
          <Button size="sm" icon="pickaxe" onPress={requestOpen}>
            {hu.replay.openInEditor}
          </Button>
          <IconButton icon="copy" label={hu.share.copy} size="sm" onPress={() => void copyLink()} />
          <Link
            to="/leaderboard/$mapId"
            params={{ mapId: String(run.mapId) }}
            variant="ghost"
            size="sm"
            icon="trophy"
          >
            {hu.play.toLeaderboard}
          </Link>
        </>
      }
    />
  );

  return (
    <>
      <PlayScreen
        mode="replay"
        map={map}
        start={start}
        facts={{
          title: run.mapTitle,
          goldTotal: info.goldTotal,
          reachableGold: info.reachableGold,
          descriptionId,
        }}
        view={view}
        blocked={engineRun.blocked}
        attempt={engineRun.attempt}
        editorSource={run.source}
        bezel={bezel}
        sheet={
          <ReplaySheet
            source={run.source}
            mapTitle={run.mapTitle}
            editorRef={editorRef}
            execLine={view.execLine}
            runtimeMark={view.runtimeMark}
          />
        }
        lamp={
          isDarkMine(detail.map.lampMode)
            ? { mode: detail.map.lampMode, sketch: EMPTY_SKETCH, canSeeAll: run.isOwn }
            : undefined
        }
        reportFooter={<RecordedLine gold={run.gold} steps={run.steps} />}
        onRun={() => engineRun.run(run.source)}
        revealLine={(line) => editorRef.current?.revealLine(line)}
        focusEditor={() => editorRef.current?.focus()}
        commands={{}}
      />
      <ModalShell
        title={hu.programs.replaceTitle}
        role="alertdialog"
        isOpen={isConfirming}
        onOpenChange={setConfirming}
      >
        {(close) => (
          <>
            <p className="overlay-body">{hu.programs.replaceBody}</p>
            <div className="overlay-actions">
              <Button onPress={close} autoFocus>
                {hu.common.cancel}
              </Button>
              <Button variant="primary" icon="pickaxe" onPress={openInEditor}>
                {hu.replay.openInEditor}
              </Button>
            </div>
          </>
        )}
      </ModalShell>
    </>
  );
}
