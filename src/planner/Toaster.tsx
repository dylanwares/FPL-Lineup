"use client";

import { useEffect } from "react";
import { dismissToast, usePlanner, type Toast } from "./store";

const LIFETIME_MS = 5000;

/**
 * Confirmations ("Sold X, bought Y" with Undo) and prompts, shown just under
 * the header so they never cover the bench or the mode buttons.
 */
export function Toaster() {
  const toasts = usePlanner((s) => s.toasts);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[4.75rem] z-50 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  useEffect(() => {
    const id = setTimeout(() => dismissToast(toast.id), LIFETIME_MS);
    return () => clearTimeout(id);
  }, [toast.id]);

  return (
    <div
      role="status"
      className="glass-strong toast-in pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl py-2 pr-2 pl-4 text-sm"
    >
      <span className="min-w-0 flex-1">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          className="accent-soft h-8 shrink-0 rounded-lg px-3 text-xs font-semibold"
          onClick={() => {
            toast.action!.run();
            dismissToast(toast.id);
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
