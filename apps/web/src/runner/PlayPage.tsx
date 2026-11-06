import type { Diagnostic, MineMap, RunResult } from "@minescript/engine";
import { isRuntimeError } from "@minescript/engine";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Play, Trophy, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileTrigger } from "react-aria-components";
import { Notice } from "../components/Notice.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Link } from "../components/ui/Link.tsx";
import { Switch } from "../components/ui/Switch.tsx";
import { toast } from "../components/ui/Toast.tsx";
import { MineScriptEditor } from "../editor/MineScriptEditor.tsx";
import { useEngine } from "../engine/useEngine.ts";
import { dirNames, hu, runtimeErrors } from "../i18n/hu.ts";
import { api, call, errorMessage } from "../lib/api.ts";
import { downloadText, readFirstFile, safeFilename } from "../lib/files.ts";
import { readStorage, writeStorage } from "../lib/storage.ts";
import { MapGrid } from "../map/MapGrid.tsx";
import type { MapDetail } from "../map/queries.ts";
import { deriveFrame, formatValue } from "./derive.ts";
import { LiveAnnouncer } from "./LiveAnnouncer.tsx";
import { PlaybackControls } from "./PlaybackControls.tsx";
import { usePlayback } from "./playback-store.ts";
import { usePlaybackTimer } from "./usePlaybackTimer.ts";

const STARTER_PROGRAM = "set arany to isThere 2\nprint arany\n";
const HELP_ID = "editor-help";

function programKey(mapId: number): string {
  return `minescript.program.${mapId}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="eyebrow">{label}</dt>
      <dd className="font-mono text-2xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}

function outcomeNotice(result: RunResult, stopped: boolean) {
  if (stopped) {
    return <Notice tone="info" title={hu.play.stopped} />;
  }
  if (isRuntimeError(result.outcome)) {
    const text = runtimeErrors[result.outcome.code];
    return (
      <Notice
        tone="error"
        title={hu.play.runtimeErrorTitle(result.outcome.code, result.outcome.line)}
      >
        <p className="font-semibold">{text.title}</p>
        <p>{text.hint}</p>
      </Notice>
    );
  }
  return <Notice tone="success" title={hu.play.finishedOk} />;
}

export function PlayPage({ detail, map }: { detail: MapDetail; map: MineMap }) {
  const engine = useEngine();
  const queryClient = useQueryClient();
  const mapId = detail.map.id;
  const [source, setSource] = useState(() => readStorage(programKey(mapId)) ?? STARTER_PROGRAM);
  const [syntaxErrors, setSyntaxErrors] = useState<Diagnostic[]>([]);
  const [fog, setFog] = useState(true);
  const submitted = useRef(false);
  const { result, start, index, status } = usePlayback();
  usePlaybackTimer();

  useEffect(() => () => usePlayback.getState().clear(), []);
  useEffect(() => writeStorage(programKey(mapId), source), [mapId, source]);

  const startState = { pos: map.robot, dir: map.dir };
  const frame = useMemo(
    () => (result && start ? deriveFrame(result, start, index) : null),
    [result, start, index],
  );

  const submit = useMutation({
    mutationFn: (program: string) =>
      call(api.runs.$post({ json: { mapVersionId: detail.version.id, source: program } })),
    onSuccess: (response) => {
      toast.success(hu.play.submitted(response.run.gold, response.run.steps));
      void queryClient.invalidateQueries({ queryKey: ["leaderboard", mapId] });
    },
    onError: (error) => toast.error(errorMessage(error, hu.play.submitFailed)),
  });

  useEffect(() => {
    if (status === "finished" && !submitted.current) {
      submitted.current = true;
      submit.mutate(source);
    }
  }, [status, source, submit]);

  const run = () => {
    const outcome = engine.run(source, detail.version.content);
    if (outcome.outcome.kind === "syntaxError") {
      setSyntaxErrors(outcome.outcome.diagnostics);
      usePlayback.getState().clear();
      return;
    }
    setSyntaxErrors([]);
    submitted.current = false;
    usePlayback.getState().load(outcome, startState);
  };

  const importProgram = async (files: FileList | null) => {
    const text = await readFirstFile(files);
    if (text !== null) {
      setSource(text.replace(/^﻿/, "").replaceAll("\r\n", "\n"));
      usePlayback.getState().clear();
    }
  };

  const errorLines = useMemo(() => {
    if (syntaxErrors.length > 0) {
      return [...new Set(syntaxErrors.map((diagnostic) => diagnostic.span.line))];
    }
    if (result && isRuntimeError(result.outcome) && frame?.atEnd) {
      return [result.outcome.line];
    }
    return [];
  }, [syntaxErrors, result, frame?.atEnd]);

  const robot = frame?.robot ?? startState;
  const finished = status === "finished" || status === "stopped";
  const finalMessage =
    result && finished
      ? status === "stopped"
        ? hu.play.stopped
        : isRuntimeError(result.outcome)
          ? hu.play.runtimeErrorTitle(result.outcome.code, result.outcome.line)
          : hu.play.finishedOk
      : undefined;

  return (
    <div className="flex flex-col gap-6 pt-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{hu.maps.version(detail.version.version)}</p>
          <h1 className="text-4xl font-black tracking-tighter">{detail.map.title}</h1>
          <p className="max-w-2xl text-ink-muted">{detail.map.description}</p>
        </div>
        <Link
          to="/leaderboard/$mapId"
          params={{ mapId: String(mapId) }}
          variant="secondary"
          size="sm"
        >
          <Trophy aria-hidden size={16} />
          {hu.maps.leaderboard}
        </Link>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <section
          aria-labelledby="program-heading"
          className="plate flex min-w-0 flex-col overflow-hidden"
        >
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
            <h2 id="program-heading" className="mr-auto text-sm font-bold">
              {hu.play.editorLabel}
            </h2>
            <FileTrigger
              acceptedFileTypes={[".ms", ".txt", "text/plain"]}
              onSelect={(files) => void importProgram(files)}
            >
              <Button size="sm" variant="ghost">
                <Upload aria-hidden size={16} />
                {hu.play.importProgram}
              </Button>
            </FileTrigger>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => downloadText(`${safeFilename(detail.map.title)}.ms`, source)}
            >
              <Download aria-hidden size={16} />
              {hu.play.exportProgram}
            </Button>
            <Button size="sm" variant="primary" onPress={run}>
              <Play aria-hidden size={16} />
              {hu.play.run}
            </Button>
          </div>
          <div className="h-[26rem] min-h-0">
            <MineScriptEditor
              value={source}
              onChange={(next) => {
                setSource(next);
                setSyntaxErrors([]);
              }}
              label={hu.play.editorLabel}
              describedBy={HELP_ID}
              execLine={frame?.line ?? null}
              errorLines={errorLines}
            />
          </div>
          <p id={HELP_ID} className="border-t border-line px-4 py-2 text-xs text-ink-muted">
            {hu.play.editorHelp}
          </p>
          {syntaxErrors.length > 0 ? (
            <div className="border-t border-line p-4">
              <Notice tone="error" title={hu.play.syntaxErrorTitle}>
                <ul className="mt-1 list-disc pl-5">
                  {syntaxErrors.map((diagnostic, position) => (
                    <li key={`${diagnostic.code}-${position.toString()}`}>
                      <span className="font-mono">
                        {hu.play.syntaxErrorLine(diagnostic.span.line)}
                      </span>{" "}
                      <span className="font-mono text-xs">[{diagnostic.code}]</span>{" "}
                      {diagnostic.message}
                    </li>
                  ))}
                </ul>
              </Notice>
            </div>
          ) : null}
        </section>

        <section aria-labelledby="map-heading" className="flex min-w-0 flex-col gap-4">
          <div className="plate flex flex-col gap-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="map-heading" className="text-sm font-bold">
                {hu.play.mapLabel(detail.map.title)}
              </h2>
              <Switch isSelected={fog} onChange={setFog}>
                {fog ? hu.play.fogOn : hu.play.fogOff}
              </Switch>
            </div>
            <MapGrid
              map={map}
              mode={frame && fog ? "fog" : "view"}
              label={hu.play.mapLabel(detail.map.title)}
              robot={robot}
              {...(frame ? { discovered: frame.discovered, mined: frame.mined } : {})}
            />
            <PlaybackControls />
          </div>

          <dl
            aria-label={hu.play.status}
            className="plate grid grid-cols-2 gap-4 p-4 sm:grid-cols-4"
          >
            <Stat
              label={hu.play.gold}
              value={`${frame?.gold ?? 0} / ${detail.info?.goldTotal ?? 0}`}
            />
            <Stat label={hu.play.steps} value={`${frame?.steps ?? 0}`} />
            <Stat label={hu.play.line} value={frame?.line ? `${frame.line}.` : "–"} />
            <Stat
              label={hu.play.position}
              value={`${robot.pos.row + 1}:${robot.pos.col + 1} ${dirNames[robot.dir].slice(0, 1).toUpperCase()}`}
            />
          </dl>

          {result && finished ? outcomeNotice(result, status === "stopped") : null}

          <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
            <section aria-labelledby="console-heading" className="plate p-4">
              <h2 id="console-heading" className="eyebrow">
                {hu.play.console}
              </h2>
              {frame && frame.console.length > 0 ? (
                <ol className="mt-2 max-h-48 overflow-auto font-mono text-sm">
                  {frame.console.map((line, position) => (
                    <li
                      key={`${position.toString()}-${line}`}
                      className="border-b border-line py-1 last:border-0"
                    >
                      {line}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-sm text-ink-muted">{hu.play.consoleEmpty}</p>
              )}
            </section>
            <section aria-labelledby="variables-heading" className="plate p-4">
              <h2 id="variables-heading" className="eyebrow">
                {hu.play.variables}
              </h2>
              {frame && frame.variables.size > 0 ? (
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-sm">
                  {[...frame.variables].map(([name, value]) => (
                    <div key={name} className="contents">
                      <dt className="text-moss">{name}</dt>
                      <dd>{formatValue(value)}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-2 text-sm text-ink-muted">{hu.play.noVariables}</p>
              )}
            </section>
          </div>
        </section>
      </div>
      <LiveAnnouncer frame={frame} {...(finalMessage ? { final: finalMessage } : {})} />
    </div>
  );
}
