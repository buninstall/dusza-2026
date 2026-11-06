import { createEngine, type Engine } from "@minescript/engine";
import wasmUrl from "@minescript/engine/wasm?url";
import { Component, createContext, type ReactNode, Suspense, use, useEffect } from "react";
import { EngineLoading } from "../app/StatusScreens.tsx";
import { Notice } from "../components/Notice.tsx";
import { toast } from "../components/ui/Toast.tsx";
import { hu } from "../i18n/hu.ts";
import "./EngineProvider.css";
import { freshEngine } from "./fresh-engine.ts";
import { resilientEngine } from "./resilient.ts";

export const EngineContext = createContext<Engine | null>(null);

type LoadedEngine = ReturnType<typeof resilientEngine>;

let enginePromise: Promise<LoadedEngine> | null = null;

async function compile(): Promise<WebAssembly.Module> {
  const response = await fetch(wasmUrl);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return new WebAssembly.Module(await response.arrayBuffer());
}

export function loadEngine(): Promise<LoadedEngine> {
  enginePromise ??= compile().then((module) =>
    resilientEngine(createEngine(module), () => freshEngine(module)),
  );
  return enginePromise;
}

function EngineGate({ children }: { children: ReactNode }) {
  const loaded = use(loadEngine());
  useEffect(() => loaded.onCrash(() => toast.error(hu.app.engineRestarted)), [loaded]);
  return <EngineContext value={loaded.engine}>{children}</EngineContext>;
}

type BoundaryState = { hasFailed: boolean };

class EngineErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  override state: BoundaryState = { hasFailed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { hasFailed: true };
  }

  override render() {
    if (this.state.hasFailed) {
      return (
        <div className="engine-status">
          <Notice tone="error" title={hu.app.engineFailed} live="alert" />
        </div>
      );
    }
    return this.props.children;
  }
}

export function EngineProvider({ children }: { children: ReactNode }) {
  return (
    <EngineErrorBoundary>
      <Suspense fallback={<EngineLoading />}>
        <EngineGate>{children}</EngineGate>
      </Suspense>
    </EngineErrorBoundary>
  );
}
