import type { FormatResult } from "@minescript/engine";
import { toast } from "../../components/ui/Toast.tsx";
import { hu } from "../../i18n/hu.ts";

export function reportFormat(result: FormatResult | null): void {
  if (result === null) {
    return;
  }
  if (result.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    toast.error(hu.play.formatFailed);
    return;
  }
  toast.success(hu.play.formatted);
}
