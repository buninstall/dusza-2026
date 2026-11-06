import { Minus, Plus } from "lucide-react";
import {
  NumberField as AriaNumberField,
  type NumberFieldProps as AriaNumberFieldProps,
  Button,
  Group,
  Input,
  Label,
} from "react-aria-components";

type NumberFieldProps = AriaNumberFieldProps & { label: string };

const stepper =
  "flex h-full w-9 items-center justify-center text-ink-muted outline-none data-[hovered]:bg-paper-sunken data-[hovered]:text-ink data-[focus-visible]:outline-3 data-[focus-visible]:outline-lamp data-[disabled]:opacity-40";

export function NumberField({ label, ...props }: NumberFieldProps) {
  return (
    <AriaNumberField {...props} className="flex flex-col gap-1.5">
      <Label className="text-sm font-semibold text-ink">{label}</Label>
      <Group className="flex h-10 w-32 overflow-hidden rounded-[10px] border border-line-strong bg-paper-raised data-[focus-within]:border-ink">
        <Button slot="decrement" className={stepper}>
          <Minus aria-hidden size={14} />
        </Button>
        <Input className="w-full min-w-0 bg-transparent text-center font-mono text-ink outline-none" />
        <Button slot="increment" className={stepper}>
          <Plus aria-hidden size={14} />
        </Button>
      </Group>
    </AriaNumberField>
  );
}
