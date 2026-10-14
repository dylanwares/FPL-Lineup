import type { ComponentProps } from "react";

type Variant = "glass" | "neon" | "hot" | "soft";

const VARIANTS: Record<Variant, string> = {
  glass: "glass-pill text-fg",
  neon: "neon-pill",
  hot: "neon-pill hot",
  soft: "accent-soft",
};

const SIZES = {
  sm: "h-9 px-3.5 text-[13px] gap-1.5",
  md: "h-11 px-5 text-sm gap-2",
  icon: "size-10 justify-center",
};

export interface PillButtonProps extends ComponentProps<"button"> {
  variant?: Variant;
  size?: keyof typeof SIZES;
  /** Toggle buttons: switch to the tinted accent style while pressed. */
  pressed?: boolean;
}

export function PillButton({
  variant = "glass",
  size = "md",
  pressed,
  className = "",
  type = "button",
  ...rest
}: PillButtonProps) {
  const look = pressed ? VARIANTS.soft : VARIANTS[variant];
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={`${look} ${SIZES[size]} inline-flex shrink-0 items-center rounded-xl font-semibold whitespace-nowrap disabled:pointer-events-none disabled:opacity-40 ${className}`}
      {...rest}
    />
  );
}
