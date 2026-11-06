import { PixelText } from "../pixel/PixelText.tsx";
import "./NumberedHeading.css";

type NumberedHeadingProps = { id: string; number: number; title: string };

export function NumberedHeading({ id, number, title }: NumberedHeadingProps) {
  return (
    <h2 id={id} className="numbered">
      <span aria-hidden="true" className="numbered-no">
        <PixelText text={String(number).padStart(2, "0")} scale={3} />
      </span>
      <span className="numbered-title">{title}</span>
    </h2>
  );
}
