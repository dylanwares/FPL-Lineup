import type { ComponentPropsWithoutRef, ElementType } from "react";

type GlassPanelProps<T extends ElementType> = {
  as?: T;
  /** Denser, more blurred glass for overlays (header, sheets). */
  strong?: boolean;
} & ComponentPropsWithoutRef<T>;

/** A rounded liquid-glass surface. Use for large panels only (backdrop blur has a per-element cost). */
export function GlassPanel<T extends ElementType = "div">({
  as,
  strong = false,
  className = "",
  ...rest
}: GlassPanelProps<T>) {
  const Tag = as ?? "div";
  return <Tag className={`${strong ? "glass-strong" : "glass"} rounded-2xl ${className}`} {...rest} />;
}
