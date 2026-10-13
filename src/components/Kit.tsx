import type { Kit as KitColours } from "@/config/kits";

// 64×64 shirt. Patterns are drawn inside the body bounds, so no clip paths
// (and no per-instance ids) are needed.
const BODY = "M20 6 26 4Q32 9 38 4L44 6 58 14 52 26 46 23V58H18V23L12 26 6 14Z";
const LEFT_SLEEVE = "M20 6 6 14 12 26 18 23Z";
const RIGHT_SLEEVE = "M44 6 58 14 52 26 46 23Z";
const COLLAR = "M26 4Q32 9 38 4";

export function Kit({
  kit,
  goalkeeper = false,
  className = "size-12",
}: {
  kit: KitColours;
  goalkeeper?: boolean;
  className?: string;
}) {
  const body = goalkeeper ? kit.gk : kit.primary;
  const style = goalkeeper ? "plain" : kit.style;
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path d={BODY} fill={body} />
      {style === "sleeves" && (
        <>
          <path d={LEFT_SLEEVE} fill={kit.secondary} />
          <path d={RIGHT_SLEEVE} fill={kit.secondary} />
        </>
      )}
      {style === "stripes" && (
        <g fill={kit.secondary}>
          <rect x="21" y="9" width="4.5" height="49" />
          <rect x="29.75" y="9" width="4.5" height="49" />
          <rect x="38.5" y="9" width="4.5" height="49" />
        </g>
      )}
      {style === "hoops" && (
        <g fill={kit.secondary}>
          <rect x="18" y="27" width="28" height="6" />
          <rect x="18" y="39" width="28" height="6" />
          <rect x="18" y="51" width="28" height="6" />
        </g>
      )}
      {/* Volume: a soft highlight down the left, shade down the right and under the arms. */}
      <path d="M21 9 27 7 23 58H19V24Z" fill="#fff" opacity="0.14" />
      <path d="M39 7 44 6 46 23V58H40Z" fill="#000" opacity="0.14" />
      <path d="M18 23H46V27H18Z" fill="#000" opacity="0.08" />
      <path d={COLLAR} fill="none" stroke={goalkeeper ? "#111" : kit.secondary} strokeWidth="2" />
      <path d={BODY} fill="none" stroke="rgb(0 0 0 / 0.35)" strokeWidth="1.25" strokeLinejoin="round" />
    </svg>
  );
}
