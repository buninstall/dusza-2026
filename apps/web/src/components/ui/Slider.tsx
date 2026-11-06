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
};

export function Slider({ label, format, ...props }: SliderProps) {
  return (
    <AriaSlider {...props} className="slider">
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
            <SliderThumb className="slider-thumb" aria-valuetext={format(state.getThumbValue(0))} />
          </>
        )}
      </SliderTrack>
    </AriaSlider>
  );
}
