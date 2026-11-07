import {
  Select as AriaSelect,
  type SelectProps as AriaSelectProps,
  Button,
  type Key,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  SelectValue,
} from "react-aria-components";
import { PixelIcon } from "../../pixel/PixelIcon.tsx";
import "./Field.css";

export type SelectOption<K extends string> = { id: K; label: string };

type SelectProps<K extends string> = Omit<
  AriaSelectProps<SelectOption<K>, "single">,
  "children" | "value" | "onChange" | "className"
> & {
  label: string;
  options: readonly SelectOption<K>[];
  value: K;
  onChange: (value: K) => void;
  isLabelHidden?: boolean;
};

export function Select<K extends string>({
  label,
  options,
  value,
  onChange,
  isLabelHidden = false,
  ...props
}: SelectProps<K>) {
  const handleChange = (key: Key | null) => {
    const match = options.find((option) => option.id === key);
    if (match) {
      onChange(match.id);
    }
  };
  return (
    <AriaSelect {...props} value={value} onChange={handleChange} className="field">
      <Label className={isLabelHidden ? "visually-hidden" : "field-label"}>{label}</Label>
      <Button className="field-select-button">
        <SelectValue />
        <PixelIcon name="chevronDown" />
      </Button>
      <Popover className="field-popover" isNonModal>
        <ListBox items={options} className="field-list-box">
          {(option) => (
            <ListBoxItem id={option.id} textValue={option.label} className="field-option">
              {({ isSelected }) => (
                <>
                  <span className="field-option-mark">
                    {isSelected ? <PixelIcon name="check" size="sm" /> : null}
                  </span>
                  {option.label}
                </>
              )}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </AriaSelect>
  );
}
