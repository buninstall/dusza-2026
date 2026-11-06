import type { MineMap } from "@minescript/engine";
import { useEffect, useState } from "react";
import { Button } from "../components/ui/Button.tsx";
import { ModalShell } from "../components/ui/Dialog.tsx";
import { NumberField } from "../components/ui/NumberField.tsx";
import { Segmented } from "../components/ui/Segmented.tsx";
import { toast } from "../components/ui/Toast.tsx";
import { useEngine } from "../engine/useEngine.ts";
import { hu } from "../i18n/hu.ts";
import { api, call, errorMessage } from "../lib/api.ts";

export const GENERATOR_MIN = 5;
export const GENERATOR_MAX = 15;

type Difficulty = "easy" | "medium" | "hard";

const DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard"];

type GeneratorDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  rows: number;
  cols: number;
  onGenerated: (map: MineMap, parSteps: number | null) => void;
};

function clampGenerator(value: number): number {
  const whole = Number.isFinite(value) ? Math.round(value) : GENERATOR_MIN;
  return Math.min(Math.max(whole, GENERATOR_MIN), GENERATOR_MAX);
}

export function GeneratorDialog({
  isOpen,
  onOpenChange,
  rows,
  cols,
  onGenerated,
}: GeneratorDialogProps) {
  const engine = useEngine();
  const [size, setSize] = useState({ rows: clampGenerator(rows), cols: clampGenerator(cols) });
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [isBusy, setBusy] = useState(false);

  const generate = async (close: () => void) => {
    setBusy(true);
    try {
      const generated = await call(
        api.maps.generate.$post({ json: { rows: size.rows, cols: size.cols, difficulty } }),
      );
      const parsed = engine.parseMap(generated.content).map;
      if (!parsed) {
        toast.error(hu.generator.failed);
        return;
      }
      onGenerated(parsed, generated.parSteps);
      toast.success(hu.generator.done(generated.parSteps));
      close();
    } catch (error) {
      toast.error(errorMessage(error, hu.generator.failed));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSize({ rows: clampGenerator(rows), cols: clampGenerator(cols) });
    }
  }, [isOpen, rows, cols]);

  return (
    <ModalShell title={hu.generator.title} isOpen={isOpen} onOpenChange={onOpenChange}>
      {(close) => (
        <>
          <p className="overlay-body">{hu.generator.body}</p>
          <div className="ed-generator-sizes">
            <NumberField
              label={hu.generator.rows}
              minValue={GENERATOR_MIN}
              maxValue={GENERATOR_MAX}
              value={size.rows}
              onChange={(value) => setSize({ ...size, rows: clampGenerator(value) })}
            />
            <NumberField
              label={hu.generator.cols}
              minValue={GENERATOR_MIN}
              maxValue={GENERATOR_MAX}
              value={size.cols}
              onChange={(value) => setSize({ ...size, cols: clampGenerator(value) })}
            />
          </div>
          <Segmented
            label={hu.generator.difficulty}
            value={difficulty}
            onChange={setDifficulty}
            options={DIFFICULTIES.map((id) => ({ id, label: hu.generator.difficulties[id] }))}
          />
          <div className="overlay-actions">
            <Button onPress={close}>{hu.common.cancel}</Button>
            <Button
              variant="primary"
              icon="dice"
              isDisabled={isBusy}
              onPress={() => void generate(close)}
            >
              {isBusy ? hu.generator.generating : hu.generator.submit}
            </Button>
          </div>
        </>
      )}
    </ModalShell>
  );
}
