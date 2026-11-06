import { createEngine, type Engine } from "@minescript/engine";
import wasmUrl from "@minescript/engine/wasm?url";
import { Component, createContext, type ReactNode, Suspense, use } from "react";
import { EngineLoading } from "../app/StatusScreens.tsx";
import { Notice } from "../components/Notice.tsx";
import { hu } from "../i18n/hu.ts";
import "./EngineProvider.css";

export const EngineContext = createContext<Engine | null>(null);

let enginePromise: Promise<Engine> | null = null;

export function loadEngine(): Promise<Engine> {
  enginePromise ??= fetch(wasmUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.arrayBuffer();
    })
    .then((buffer) => createEngine(buffer));
  return enginePromise;
}

function EngineGate({ children }: { children: ReactNode }) {
  const engine = use(loadEngine());
  return <EngineContext value={engine}>{children}</EngineContext>;
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
