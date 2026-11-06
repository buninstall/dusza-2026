import "./pixel.css";

export function HazardStripe({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={className ? `${"px-hazard"} ${className}` : "px-hazard"} />
  );
}
