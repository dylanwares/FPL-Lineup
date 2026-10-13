/** Captain (solid magenta) or vice-captain (outlined) armband. */
export function CaptainBadge({ role, className = "" }: { role: "C" | "V"; className?: string }) {
  const look =
    role === "C"
      ? "bg-magenta text-white ring-1 ring-white/40"
      : "bg-[rgb(20_10_35/0.9)] text-[#c4b5fd] ring-[1.5px] ring-violet";
  return (
    <span
      aria-label={role === "C" ? "Captain" : "Vice-captain"}
      className={`grid size-5 place-items-center rounded-full font-display text-[9px] font-bold ${look} ${className}`}
    >
      {role}
    </span>
  );
}

/** Availability warning: amber for a doubt, red for injured or suspended. */
export function FlagIcon({ flag, className = "" }: { flag: "doubt" | "injured"; className?: string }) {
  const colour = flag === "doubt" ? "var(--doubt)" : "var(--injured)";
  return (
    <svg
      viewBox="0 0 20 18"
      role="img"
      aria-label={flag === "doubt" ? "Doubtful" : "Injured or suspended"}
      className={`size-4 ${className}`}
    >
      <path d="M10 1.2 19 16.8H1Z" fill={colour} stroke="rgb(0 0 0 / 0.6)" strokeLinejoin="round" />
      <path d="M10 6.5v4.8" stroke="#140a14" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="10" cy="14" r="1.05" fill="#140a14" />
    </svg>
  );
}
