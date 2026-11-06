import { ChevronDown } from "lucide-react";
import {
  Select as AriaSelect,
  type SelectProps as AriaSelectProps,
  Button,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  SelectValue,
} from "react-aria-components";

export type SelectOption<K extends string> = { id: K; label: string };

type SelectProps<K extends string> = Omit<
  AriaSelectProps<SelectOption<K>, "single">,
  "children" | "value" | "onChange"
> & {
  label: string;
  options: readonly SelectOption<K>[];
  value: K;
  onChange: (value: K) => void;
};

export function Select<K extends string>({
  label,
  options,
  value,
  onChange,
  ...props
}: SelectProps<K>) {
  return (
    <AriaSelect
      {...props}
      value={value}
      onChange={(key) => {
        const match = options.find((option) => option.id === key);
        if (match) {
          onChange(match.id);
        }
      }}
      className="flex flex-col gap-1.5"
    >
      <Label className="text-sm font-semibold text-ink">{label}</Label>
      <Button className="flex h-10 items-center justify-between gap-2 rounded-[10px] border border-line-strong bg-paper-raised px-3 text-left text-ink outline-none data-[hovered]:border-ink data-[focus-visible]:outline-3 data-[focus-visible]:outline-lamp">
        <SelectValue />
        <ChevronDown aria-hidden size={16} />
      </Button>
      <Popover className="plate min-w-[var(--trigger-width)] p-1 outline-none">
        <ListBox items={options} className="outline-none">
          {(option) => (
            <ListBoxItem
              id={option.id}
              textValue={option.label}
              className="cursor-default rounded-[8px] px-3 py-2 text-sm outline-none data-[focused]:bg-paper-sunken data-[selected]:font-semibold"
            >
              {option.label}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </AriaSelect>
  );
}
