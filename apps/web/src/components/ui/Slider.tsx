import { clsx } from "clsx";
import { type ReactNode, type RefObject, useLayoutEffect, useRef } from "react";
import {
  Slider as AriaSlider,
  type SliderProps as AriaSliderProps,
  Label,
  SliderOutput,
  SliderThumb,
  SliderTrack,
} from "react-aria-components";
import "./Slider.css";

type SliderProps = Omit<AriaSliderProps<number>, "className" | "children"> & {
  label: string;
  format: (value: number) => string;
  className?: string;
  decor?: ReactNode;
  keyShortcuts?: string;
};

function ValueText({
  inputRef,
  text,
  keyShortcuts,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  text: string;
  keyShortcuts: string | undefined;
}) {
  useLayoutEffect(() => {
    inputRef.current?.setAttribute("aria-valuetext", text);
    if (keyShortcuts) {
      inputRef.current?.setAttribute("aria-keyshortcuts", keyShortcuts);
    }
  });
  return null;
}

export function Slider({ label, format, className, decor, keyShortcuts, ...props }: SliderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <AriaSlider {...props} className={clsx("slider", className)}>
      <div className="slider-header">
        <Label className="slider-label">{label}</Label>
        <SliderOutput className="slider-output">
          {({ state }) => format(state.getThumbValue(0))}
        </SliderOutput>
      </div>
      <SliderTrack className="slider-track">
        {({ state }) => (
          <>
            <span className="slider-rail" />
            <span
              className="slider-fill"
              style={{ inlineSize: `${state.getThumbPercent(0) * 100}%` }}
            />
            {decor}
            <SliderThumb className="slider-thumb" inputRef={inputRef} />
            <ValueText
              inputRef={inputRef}
              text={format(state.getThumbValue(0))}
              keyShortcuts={keyShortcuts}
            />
          </>
        )}
      </SliderTrack>
    </AriaSlider>
  );
}
