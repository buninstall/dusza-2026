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

export const fieldInput =
  "w-full rounded-[10px] border border-line-strong bg-paper-raised px-3 py-2 text-ink placeholder:text-ink-muted outline-none transition-colors data-[hovered]:border-ink data-[focused]:border-ink data-[focus-visible]:outline-3 data-[focus-visible]:outline-offset-1 data-[focus-visible]:outline-lamp data-[invalid]:border-rust";

export type TextFieldProps = AriaTextFieldProps & {
  label: string;
  description?: string;
  errorMessage?: string;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
};

export function TextField({
  label,
  description,
  errorMessage,
  placeholder,
  multiline = false,
  rows = 3,
  className,
  ...props
}: TextFieldProps) {
  return (
    <AriaTextField
      {...props}
      className={clsx("flex flex-col gap-1.5", typeof className === "string" ? className : null)}
    >
      <Label className="text-sm font-semibold text-ink">{label}</Label>
      {multiline ? (
        <TextArea
          rows={rows}
          {...(placeholder === undefined ? {} : { placeholder })}
          className={clsx(fieldInput, "resize-y")}
        />
      ) : (
        <Input {...(placeholder === undefined ? {} : { placeholder })} className={fieldInput} />
      )}
      {description ? (
        <Text slot="description" className="text-xs text-ink-muted">
          {description}
        </Text>
      ) : null}
      <FieldError className="text-sm font-medium text-rust">{errorMessage}</FieldError>
    </AriaTextField>
  );
}
