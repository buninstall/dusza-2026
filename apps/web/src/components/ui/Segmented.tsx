import { Label, Radio, RadioGroup, Text } from "react-aria-components";
import type { IconName } from "../../pixel/icons.ts";
import { PixelIcon } from "../../pixel/PixelIcon.tsx";
import "./Segmented.css";

export type SegmentOption<K extends string> = {
  id: K;
  label: string;
  icon?: IconName;
  hint?: string;
};

type SegmentedProps<K extends string> = {
  label: string;
  isLabelHidden?: boolean;
  description?: string;
  value: K;
  options: readonly SegmentOption<K>[];
  onChange: (value: K) => void;
  orientation?: "horizontal" | "vertical";
  isDisabled?: boolean;
};

export function Segmented<K extends string>({
  label,
  isLabelHidden = false,
  description,
  value,
  options,
  onChange,
  orientation = "horizontal",
  isDisabled = false,
}: SegmentedProps<K>) {
  const handleChange = (next: string) => {
    const match = options.find((option) => option.id === next);
    if (match) {
      onChange(match.id);
    }
  };
  return (
    <RadioGroup
      value={value}
      onChange={handleChange}
      orientation={orientation}
      isDisabled={isDisabled}
      className="seg"
      data-orientation={orientation}
    >
      <Label className={isLabelHidden ? "visually-hidden" : "seg-label"}>{label}</Label>
      <div className="seg-track">
        {options.map((option) => (
          <Radio key={option.id} value={option.id} className="seg-segment">
            {option.icon ? <PixelIcon name={option.icon} /> : null}
            <span className="seg-segment-label">{option.label}</span>
            {option.hint ? <kbd className="seg-hint">{option.hint}</kbd> : null}
          </Radio>
        ))}
      </div>
      {description ? (
        <Text slot="description" className="seg-description">
          {description}
        </Text>
      ) : null}
    </RadioGroup>
  );
}
