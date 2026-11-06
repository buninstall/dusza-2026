import {
  Slider as AriaSlider,
  type SliderProps as AriaSliderProps,
  Label,
  SliderOutput,
  SliderThumb,
  SliderTrack,
} from "react-aria-components";

type SliderProps = AriaSliderProps<number> & {
  label: string;
  format: (value: number) => string;
};

export function Slider({ label, format, ...props }: SliderProps) {
  return (
    <AriaSlider {...props} className="flex w-44 flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="eyebrow">{label}</Label>
        <SliderOutput className="font-mono text-xs text-ink">
          {({ state }) => format(state.getThumbValue(0))}
        </SliderOutput>
      </div>
      <SliderTrack className="relative h-6 w-full">
        {({ state }) => (
          <>
            <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-line" />
            <div
              className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-ore"
              style={{ width: `${state.getThumbPercent(0) * 100}%` }}
            />
            <SliderThumb
              aria-label={label}
              className="top-1/2 size-5 rounded-full border-2 border-ink bg-paper-raised shadow outline-none data-[dragging]:bg-ore data-[focus-visible]:outline-3 data-[focus-visible]:outline-lamp"
            />
          </>
        )}
      </SliderTrack>
    </AriaSlider>
  );
}
