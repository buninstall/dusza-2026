import { Button } from "../../components/ui/Button.tsx";
import { IconButton } from "../../components/ui/IconButton.tsx";
import { hu } from "../../i18n/hu.ts";
import { PixelIcon } from "../../pixel/PixelIcon.tsx";
import type { Tip, TipAction } from "./tips.ts";

type ForemanTipProps = {
  tip: Tip;
  onAction: (action: TipAction) => void;
  onDismiss: () => void;
};

export function ForemanTip({ tip, onAction, onDismiss }: ForemanTipProps) {
  return (
    <aside aria-label={hu.tips.label} className="tip">
      <PixelIcon name="helmet" />
      <span className="tip-label" aria-hidden="true">
        {hu.tips.label}
      </span>
      <p className="tip-text">{tip.text}</p>
      {tip.action && tip.actionLabel ? (
        <Button
          size="sm"
          variant="ghost"
          onPress={() => (tip.action ? onAction(tip.action) : undefined)}
        >
          {tip.actionLabel}
        </Button>
      ) : null}
      <IconButton
        icon="close"
        size="sm"
        variant="ghost"
        label={hu.tips.dismiss}
        onPress={onDismiss}
      />
    </aside>
  );
}
