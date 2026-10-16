/** Stroke icons on a 24px grid; size and colour come from className/currentColor. */
function Icon({ d, className = "size-4" }: { d: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

type P = { className?: string };

export const ChevronLeft = (p: P) => <Icon d="m15 5-7 7 7 7" {...p} />;
export const ChevronRight = (p: P) => <Icon d="m9 5 7 7-7 7" {...p} />;
export const ChevronDown = (p: P) => <Icon d="m6 9 6 6 6-6" {...p} />;
export const Plus = (p: P) => <Icon d="M12 5v14M5 12h14" {...p} />;
export const Pencil = (p: P) => <Icon d="M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4" {...p} />;
export const More = (p: P) => (
  <Icon
    d="M4.5 12a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M10.5 12a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M16.5 12a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0"
    {...p}
  />
);
export const Copy = (p: P) => <Icon d="M9 9h10v10H9zM5 15V5h10" {...p} />;
export const Check = (p: P) => <Icon d="m5 12 5 5 9-10" {...p} />;
export const Trash = (p: P) => <Icon d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" {...p} />;
export const Swap = (p: P) => <Icon d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" {...p} />;
export const Transfer = (p: P) => (
  <Icon d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4" {...p} />
);
export const Shirt = (p: P) => <Icon d="M8 3 3 6l2 5 3-1v11h8V10l3 1 2-5-5-3a4 4 0 0 1-8 0Z" {...p} />;
export const Refresh = (p: P) => <Icon d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" {...p} />;
export const Logout = (p: P) => <Icon d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" {...p} />;
export const Share = (p: P) => <Icon d="M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1" {...p} />;
export const Download = (p: P) => <Icon d="M12 4v11M8 11l4 4 4-4M5 20h14" {...p} />;
export const Mail = (p: P) => <Icon d="M3 6h18v12H3zM3 7l9 6 9-6" {...p} />;
export const Help = (p: P) => (
  <Icon
    d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.5 9.3a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.2-2.5 3.8M12 17.2v.01"
    {...p}
  />
);
export const Close = (p: P) => <Icon d="M6 6l12 12M18 6 6 18" {...p} />;
export const Camera = (p: P) => (
  <Icon d="M4 8h3l2-3h6l2 3h3v11H4ZM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" {...p} />
);
