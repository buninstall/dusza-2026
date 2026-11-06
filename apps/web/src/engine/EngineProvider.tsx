import { createEngine, type Engine } from "@minescript/engine";
import wasmUrl from "@minescript/engine/wasm?url";
import { Component, createContext, type ReactNode, Suspense, use } from "react";
import { hu } from "../i18n/hu.ts";

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

type BoundaryState = { failed: boolean };

class EngineErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  override state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  override render() {
    if (this.state.failed) {
      return (
        <div role="alert" className="plate m-8 max-w-xl p-6 text-rust">
          {hu.app.engineFailed}
        </div>
      );
    }
    return this.props.children;
  }
}

function EngineLoading() {
  return (
    <output className="flex min-h-[50dvh] items-center justify-center text-ink-muted">
      {hu.app.engineLoading}
    </output>
  );
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
