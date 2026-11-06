import {
  NumberField as AriaNumberField,
  type NumberFieldProps as AriaNumberFieldProps,
  Button,
  Group,
  Input,
  Label,
  Text,
} from "react-aria-components";
import { hu } from "../../i18n/hu.ts";
import { PixelIcon } from "../../pixel/PixelIcon.tsx";
import "./Field.css";

type NumberFieldProps = Omit<AriaNumberFieldProps, "className"> & {
  label: string;
  description?: string | undefined;
};

export function NumberField({ label, description, ...props }: NumberFieldProps) {
  return (
    <AriaNumberField
      decrementAriaLabel={hu.common.stepDown(label)}
      incrementAriaLabel={hu.common.stepUp(label)}
      {...props}
      className="field"
    >
      <Label className="field-label">{label}</Label>
      <Group className="field-stepper">
        <Button slot="decrement" className="field-stepper-button" data-step="down">
          <PixelIcon name="minus" />
        </Button>
        <Input className="field-input" />
        <Button slot="increment" className="field-stepper-button" data-step="up">
          <PixelIcon name="plus" />
        </Button>
      </Group>
      {description ? (
        <Text slot="description" className="field-description">
          {description}
        </Text>
      ) : null}
    </AriaNumberField>
  );
}
