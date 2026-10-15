import type { Kit as KitColours } from "@/config/kits";

// 64×64 shirt. Patterns are drawn inside the body bounds, so no clip paths
// (and no per-instance ids) are needed. The shapes are shared with the share
// image, which draws the same shirt on a canvas.
export const KIT_SHAPES = {
  body: "M20 6 26 4Q32 9 38 4L44 6 58 14 52 26 46 23V58H18V23L12 26 6 14Z",
  sleeves: ["M20 6 6 14 12 26 18 23Z", "M44 6 58 14 52 26 46 23Z"],
  collar: "M26 4Q32 9 38 4",
  /** [x, y, width, height] */
  stripes: [
    [21, 9, 4.5, 49],
    [29.75, 9, 4.5, 49],
    [38.5, 9, 4.5, 49],
  ],
  hoops: [
    [18, 27, 28, 6],
    [18, 39, 28, 6],
    [18, 51, 28, 6],
  ],
  /** [path, fill, opacity]: a soft highlight down the left, shade down the right and under the arms. */
  shading: [
    ["M21 9 27 7 23 58H19V24Z", "#fff", 0.14],
    ["M39 7 44 6 46 23V58H40Z", "#000", 0.14],
    ["M18 23H46V27H18Z", "#000", 0.08],
  ],
} as const;

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
      <path d={KIT_SHAPES.body} fill={body} />
      {style === "sleeves" && KIT_SHAPES.sleeves.map((d) => <path key={d} d={d} fill={kit.secondary} />)}
      {(style === "stripes" || style === "hoops") && (
        <g fill={kit.secondary}>
          {KIT_SHAPES[style].map(([x, y, width, height]) => (
            <rect key={`${x},${y}`} x={x} y={y} width={width} height={height} />
          ))}
        </g>
      )}
      {KIT_SHAPES.shading.map(([d, fill, opacity]) => (
        <path key={d} d={d} fill={fill} opacity={opacity} />
      ))}
      <path d={KIT_SHAPES.collar} fill="none" stroke={goalkeeper ? "#111" : kit.secondary} strokeWidth="2" />
      <path
        d={KIT_SHAPES.body}
        fill="none"
        stroke="rgb(0 0 0 / 0.35)"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  );
}
