import { clsx } from "clsx";
import { useEffect, useRef, useState } from "react";
import {
  Button as AriaButton,
  SearchField as AriaSearchField,
  Input,
  Label,
} from "react-aria-components";
import { PixelIcon } from "../../pixel/PixelIcon.tsx";
import "./Field.css";
import "./SearchField.css";

const COMMIT_DELAY_MS = 280;

type SearchFieldProps = {
  label: string;
  clearLabel: string;
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string | undefined;
  maxLength?: number | undefined;
  isLabelHidden?: boolean;
  className?: string | undefined;
  delay?: number;
};

export function SearchField({
  label,
  clearLabel,
  value,
  onCommit,
  placeholder,
  maxLength,
  isLabelHidden = false,
  className,
  delay = COMMIT_DELAY_MS,
}: SearchFieldProps) {
  const [draft, setDraft] = useState(value);
  const sent = useRef(value);
  const commit = useRef(onCommit);

  useEffect(() => {
    commit.current = onCommit;
  }, [onCommit]);

  useEffect(() => {
    if (value !== sent.current) {
      sent.current = value;
      setDraft(value);
    }
  }, [value]);

  useEffect(() => {
    const next = draft.trim();
    if (next === sent.current.trim()) {
      return;
    }
    const timer = window.setTimeout(() => {
      sent.current = next;
      commit.current(next);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [draft, delay]);

  const submitNow = (text: string) => {
    const next = text.trim();
    sent.current = next;
    commit.current(next);
  };

  return (
    <AriaSearchField
      value={draft}
      onChange={setDraft}
      onSubmit={submitNow}
      onClear={() => submitNow("")}
      {...(maxLength === undefined ? {} : { maxLength })}
      className={clsx("field", "search-field", className)}
    >
      <Label className={isLabelHidden ? "visually-hidden" : "field-label"}>{label}</Label>
      <div className="search-box">
        <PixelIcon name="search" />
        <Input
          {...(placeholder === undefined ? {} : { placeholder })}
          className="field-input search-input"
        />
        <AriaButton className="search-clear" aria-label={clearLabel}>
          <PixelIcon name="close" />
        </AriaButton>
      </div>
    </AriaSearchField>
  );
}
