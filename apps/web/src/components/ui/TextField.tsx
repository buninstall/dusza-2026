import { clsx } from "clsx";
import type { Ref } from "react";
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
  inputRef?: Ref<HTMLInputElement> | undefined;
  isLabelHidden?: boolean;
};

const DEFAULT_ROWS = 3;

export function TextField({
  label,
  description,
  placeholder,
  isMultiline = false,
  rows = DEFAULT_ROWS,
  className,
  inputRef,
  isLabelHidden = false,
  ...props
}: TextFieldProps) {
  const inputProps = placeholder === undefined ? {} : { placeholder };
  return (
    <AriaTextField {...props} className={clsx("field", className)}>
      <Label className={isLabelHidden ? "visually-hidden" : "field-label"}>{label}</Label>
      {isMultiline ? (
        <TextArea {...inputProps} rows={rows} className={clsx("field-input", "field-textarea")} />
      ) : (
        <Input {...inputProps} {...(inputRef ? { ref: inputRef } : {})} className="field-input" />
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
