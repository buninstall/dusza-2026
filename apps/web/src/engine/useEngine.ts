import type { Engine } from "@minescript/engine";
import { useContext } from "react";
import { EngineContext } from "./EngineProvider.tsx";

export function useEngine(): Engine {
  const engine = useContext(EngineContext);
  if (!engine) {
    throw new Error("A useEngine csak EngineProvider-en belül használható.");
  }
  return engine;
}
