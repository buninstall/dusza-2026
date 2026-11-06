import { clsx } from "clsx";
import { Form as AriaForm, type FormProps } from "react-aria-components";

export function Form({ className, ...props }: FormProps) {
  return (
    <AriaForm
      {...props}
      className={clsx("flex flex-col gap-4", typeof className === "string" ? className : null)}
    />
  );
}
