import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 18, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const Shaft = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 3h16M6 3v18M18 3v18M6 8h12M6 13h12M6 18h12" />
  </Icon>
);
export const Pick = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 9c4-5 12-6 18-3M12 7 5 21M21 6c-2 3-5 4-9 4" />
  </Icon>
);
export const Lamp = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9 3h6l2 6H7zM12 9v4M8 21h8M10 13h4l1 8H9z" />
  </Icon>
);
export const Cart = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 7h18l-2 9H5zM7 20a1 1 0 1 0 0-.01M17 20a1 1 0 1 0 0-.01" />
  </Icon>
);
export const Nugget = (props: IconProps) => (
  <Icon {...props}>
    <path d="m7 5 6-2 6 5-1 8-7 5-6-4-2-7z" />
    <path d="m9 9 3 2 4-2" />
  </Icon>
);
export const Gauge = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 18a8 8 0 1 1 16 0M12 18l4-6M4 18h16" />
  </Icon>
);
export const Split = (props: IconProps) => (
  <Icon {...props}>
    <path d="M7 3v18M17 3v18M3 8h8M13 16h8M9 6l2 2-2 2M15 14l-2 2 2 2" />
  </Icon>
);
export const Cog = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
  </Icon>
);
export const Play = (props: IconProps) => (
  <Icon {...props}>
    <path d="M7 4v16l13-8z" />
  </Icon>
);
export const Stop = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 6h12v12H6z" />
  </Icon>
);
export const Repeat = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 12V9a3 3 0 0 1 3-3h12l-3-3M20 12v3a3 3 0 0 1-3 3H5l3 3" />
  </Icon>
);
export const Check = (props: IconProps) => (
  <Icon {...props}>
    <path d="m4 12 5 5L20 6" />
  </Icon>
);
export const Cross = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 5l14 14M19 5 5 19" />
  </Icon>
);
export const Warn = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3 2 21h20zM12 10v5M12 18v.01" />
  </Icon>
);
export const Clock = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 3" />
  </Icon>
);
export const Square = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 5h14v14H5z" />
  </Icon>
);
export const Search = (props: IconProps) => (
  <Icon {...props}>
    <path d="M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM15 15l6 6" />
  </Icon>
);
export const Download = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3v12M7 10l5 5 5-5M4 20h16" />
  </Icon>
);
export const Copy = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 8h12v12H8zM4 16V4h12" />
  </Icon>
);
export const Exit = (props: IconProps) => (
  <Icon {...props}>
    <path d="M10 4H4v16h6M14 8l4 4-4 4M8 12h10" />
  </Icon>
);
export const Bolt = (props: IconProps) => (
  <Icon {...props}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
  </Icon>
);
export const Wave = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2 12h3l3-7 4 14 3-9 2 2h5" />
  </Icon>
);
