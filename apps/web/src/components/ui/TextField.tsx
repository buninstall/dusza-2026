import { clsx } from "clsx";
import {
  TextField as AriaTextField,
  type TextFieldProps as AriaTextFieldProps,
  FieldError,
  Input,
  Label,
  Text,
  TextArea,
} from "react-aria-components";
import "./Field.css";

type TextFieldProps = Omit<AriaTextFieldProps, "className"> & {
  label: string;
  description?: string | undefined;
  placeholder?: string | undefined;
  isMultiline?: boolean;
  rows?: number;
  className?: string | undefined;
};

const DEFAULT_ROWS = 3;

export function TextField({
  label,
  description,
  placeholder,
  isMultiline = false,
  rows = DEFAULT_ROWS,
  className,
  ...props
}: TextFieldProps) {
  const inputProps = placeholder === undefined ? {} : { placeholder };
  return (
    <AriaTextField {...props} className={clsx("field", className)}>
      <Label className="field-label">{label}</Label>
      {isMultiline ? (
        <TextArea {...inputProps} rows={rows} className={clsx("field-input", "field-textarea")} />
      ) : (
        <Input {...inputProps} className="field-input" />
      )}
      {description ? (
        <Text slot="description" className="field-description">
          {description}
        </Text>
      ) : null}
      <FieldError className="field-error" />
    </AriaTextField>
  );
}
