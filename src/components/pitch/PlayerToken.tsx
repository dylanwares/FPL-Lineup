"use client";

import { useState } from "react";
import type { Kit as KitColours } from "@/config/kits";
import { Kit } from "../Kit";
import { CaptainBadge, FlagIcon } from "../ui/Badges";
import { FdrPill } from "../ui/FdrPill";

export interface TokenMetric {
  label: string;
  /** FDR for colouring, or null for a neutral pill (e.g. price, form). */
  difficulty: number | null;
}

export interface PlayerTokenProps {
  name: string;
  kit: KitColours;
  goalkeeper?: boolean;
  /** One entry normally, two in a double gameweek, none in a blank (greyed, dash). */
  metrics: TokenMetric[];
  /** No fixture this gameweek: greyed out. Defaults to having no metrics. */
  blank?: boolean;
  /** Photo view: the player's photo in place of the kit (the kit shows if it fails to load). */
  photo?: string;
  captain?: "C" | "V";
  flag?: "doubt" | "injured";
  /** Sub/transfer mode: lifted with a neon ring. */
  selected?: boolean;
  /** Sub mode: not a legal swap target. */
  dimmed?: boolean;
  /** Being dragged: this is the faded spot it was lifted from. */
  lifted?: boolean;
  /** A drag is hovering over this player, a legal place to drop. */
  targeted?: boolean;
  /** FPL player id, exposed as data-id for drag hit-testing. */
  playerId?: number;
  onClick?: () => void;
}

/** A player on the pitch or bench: kit, name pill and metric pill(s). */
export function PlayerToken({
  name,
  kit,
  goalkeeper,
  metrics,
  blank = metrics.length === 0,
  photo,
  captain,
  flag,
  selected,
  dimmed,
  lifted,
  targeted,
  playerId,
  onClick,
}: PlayerTokenProps) {
  const Tag = onClick ? "button" : "div";
  const glow = selected ? "drop-shadow-[0_0_6px_rgb(46_230_166/0.5)]" : "";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      data-player={name}
      data-id={playerId}
      data-selected={selected || undefined}
      data-dimmed={dimmed || undefined}
      aria-pressed={onClick && selected !== undefined ? selected : undefined}
      onContextMenu={onClick ? (e: React.MouseEvent) => e.preventDefault() : undefined}
      className={`relative flex w-[68px] flex-col items-center transition duration-150 select-none [-webkit-touch-callout:none] sm:w-[76px] ${
        selected ? "-translate-y-1.5" : ""
      } ${targeted ? "scale-110" : ""} ${lifted ? "opacity-25" : dimmed || blank ? "opacity-40" : ""} ${blank ? "grayscale" : ""}`}
    >
      <div className="relative">
        {/* contact shadow */}
        <span className="absolute bottom-0 left-1/2 h-2.5 w-11 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(0_0_0/0.65),transparent)]" />
        {photo ? (
          // Keyed by URL so a failed photo's fallback doesn't stick to the next player in this slot.
          <PlayerPhoto key={photo} src={photo} kit={kit} goalkeeper={goalkeeper} className={glow} />
        ) : (
          <Kit kit={kit} goalkeeper={goalkeeper} className={`relative size-11 sm:size-12 ${glow}`} />
        )}
        {captain && <CaptainBadge role={captain} className="absolute top-0 -left-2.5" />}
        {flag && <FlagIcon flag={flag} className="absolute top-0.5 -right-2.5" />}
      </div>
      <span
        className={`relative -mt-0.5 w-full truncate rounded-t-md px-1 text-center text-[11px] leading-[18px] font-semibold ${
          flag ? "bg-doubt text-[#1a1200]" : "bg-[rgb(8_5_16/0.82)] text-white"
        } ${targeted ? "ring-2 ring-cyan" : selected ? "ring-2 ring-mint" : "ring-1 ring-white/10"}`}
      >
        {name}
      </span>
      <span className="flex w-full overflow-hidden rounded-b-md">
        {metrics.length === 0 ? (
          <FdrPill difficulty={null} className="w-full rounded-none">
            —
          </FdrPill>
        ) : (
          metrics.map((m, i) => (
            <FdrPill key={i} difficulty={m.difficulty} className="min-w-0 flex-1 truncate rounded-none">
              {m.label}
            </FdrPill>
          ))
        )}
      </span>
    </Tag>
  );
}

/** The player's photo alone; the kit is only rendered (in its place) if the photo fails to load. */
function PlayerPhoto({
  src,
  kit,
  goalkeeper,
  className,
}: {
  src: string;
  kit: KitColours;
  goalkeeper?: boolean;
  className: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return <Kit kit={kit} goalkeeper={goalkeeper} className={`relative size-11 sm:size-12 ${className}`} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny remote PNGs; the image optimiser would add a server hop
    <img
      src={src}
      alt=""
      width={77}
      height={80}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={`relative block size-11 object-contain object-bottom sm:size-12 ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
