import { createEngine, type Engine } from "@minescript/engine";
import wasmUrl from "@minescript/engine/wasm?url";
import {
  Component,
  type ComponentType,
  createContext,
  type ReactNode,
  Suspense,
  use,
  useEffect,
  useLayoutEffect,
} from "react";
import { holdReady } from "../app/readiness.ts";
import { Notice } from "../components/Notice.tsx";
import { toast } from "../components/ui/Toast.tsx";
import { hu } from "../i18n/hu.ts";
import "./EngineProvider.css";
import { freshEngine } from "./fresh-engine.ts";
import { resilientEngine } from "./resilient.ts";

export const EngineContext = createContext<Engine | null>(null);

type LoadedEngine = ReturnType<typeof resilientEngine>;

let enginePromise: Promise<LoadedEngine> | null = null;
let isEngineReady = false;

async function compileBuffer(response: Response): Promise<WebAssembly.Module> {
  return WebAssembly.compile(await response.arrayBuffer());
}

async function compile(): Promise<WebAssembly.Module> {
  const response = await fetch(wasmUrl);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const isStreamable =
    typeof WebAssembly.compileStreaming === "function" &&
    response.headers.get("content-type")?.split(";")[0]?.trim() === "application/wasm";
  if (!isStreamable) {
    return compileBuffer(response);
  }
  const fallback = response.clone();
  try {
    return await WebAssembly.compileStreaming(response);
  } catch {
    return compileBuffer(fallback);
  }
}

export function loadEngine(): Promise<LoadedEngine> {
  enginePromise ??= compile().then((module) => {
    const loaded = resilientEngine(createEngine(module), () => freshEngine(module));
    isEngineReady = true;
    return loaded;
  });
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

export function preloadEngine(): void {
  loadEngine().catch(() => undefined);
}

export function EngineProvider({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    if (isEngineReady) return;
    const release = holdReady();
    loadEngine().then(release, release);
    return release;
  }, []);
  return (
    <EngineErrorBoundary>
      <Suspense fallback={null}>
        <EngineGate>{children}</EngineGate>
      </Suspense>
    </EngineErrorBoundary>
  );
}

export function withEngine<P extends object>(Page: ComponentType<P>): (props: P) => ReactNode {
  function EnginePage(props: P) {
    return (
      <EngineProvider>
        <Page {...props} />
      </EngineProvider>
    );
  }
  return EnginePage;
}
