import {
  NumberField as AriaNumberField,
  type NumberFieldProps as AriaNumberFieldProps,
  Button,
  Group,
  Input,
  Label,
  Text,
} from "react-aria-components";
import { PixelIcon } from "../../pixel/PixelIcon.tsx";
import "./Field.css";

type NumberFieldProps = Omit<AriaNumberFieldProps, "className"> & {
  label: string;
  description?: string | undefined;
};

export function NumberField({ label, description, ...props }: NumberFieldProps) {
  return (
    <AriaNumberField {...props} className="field">
      <Label className="field-label">{label}</Label>
      <Group className="field-stepper">
        <Button slot="decrement" className="field-stepper-button">
          <PixelIcon name="minus" />
        </Button>
        <Input className="field-input" />
        <Button slot="increment" className="field-stepper-button">
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
