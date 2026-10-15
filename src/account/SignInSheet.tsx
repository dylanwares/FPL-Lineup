"use client";

import { useEffect, useRef, useState } from "react";
import { Close } from "@/components/ui/Icons";
import { PillButton } from "@/components/ui/PillButton";
import { showToast } from "@/planner/store";
import { AuthError, closeSignIn, sendCode, verifyCode } from "./account";

const CODE_LENGTH = 6;
const RESEND_AFTER_S = 30;

/** Friendlier words for Better Auth's error codes. */
function explain(err: unknown, step: "email" | "code"): string {
  if (!(err instanceof AuthError)) return "Something went wrong. Try again.";
  switch (err.code) {
    case "INVALID_OTP":
      return "That code isn't right. Check the email and try again.";
    case "OTP_EXPIRED":
      return "That code has expired. Send a new one.";
    case "TOO_MANY_ATTEMPTS":
      return "Too many wrong codes. Send a new one.";
    case "NETWORK":
      return err.message;
  }
  if (err.status === 429) return "Too many attempts. Wait a minute and try again.";
  if (step === "email" && err.status === 400) return "That doesn't look like an email address.";
  return err.message;
}

/**
 * Sign in with an emailed code: no passwords, and no links (a link would
 * open the browser, not the installed app). New emails get an account.
 */
export function SignInSheet() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSignIn();
      // The planner's arrow-key shortcuts stay off while this is open.
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") e.preventDefault();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const address = email.trim();
    if (!address || busy) return;
    setBusy(true);
    setError(null);
    try {
      await sendCode(address);
      setEmail(address);
      setCode("");
      setStep("code");
      setResendIn(RESEND_AFTER_S);
      requestAnimationFrame(() => codeInput.current?.focus());
    } catch (err) {
      setError(explain(err, "email"));
    } finally {
      setBusy(false);
    }
  }

  async function verify(value = code) {
    if (value.length !== CODE_LENGTH || busy) return;
    setBusy(true);
    setError(null);
    try {
      await verifyCode(email, value);
      closeSignIn();
      showToast(`Signed in as ${email}`);
    } catch (err) {
      setError(explain(err, "code"));
      setCode("");
      codeInput.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:px-4">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        className="fade-in absolute inset-0 bg-black/60"
        onClick={closeSignIn}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sign-in-title"
        className="glass-strong sheet-in relative flex w-full max-w-md flex-col gap-4 rounded-t-3xl p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 id="sign-in-title" className="font-display text-lg font-bold">
              {step === "email" ? "Sign in" : "Enter your code"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {step === "email" ? (
                "Keep your plans in sync on every device. We’ll email you a code: no password needed."
              ) : (
                <>
                  We sent a {CODE_LENGTH}-digit code to <b className="text-fg">{email}</b>.
                </>
              )}
            </p>
          </div>
          <PillButton size="icon" aria-label="Close" onClick={closeSignIn}>
            <Close className="size-4" />
          </PillButton>
        </header>

        {step === "email" ? (
          <form onSubmit={send} className="flex flex-col gap-3">
            <label className="sr-only" htmlFor="sign-in-email">
              Email
            </label>
            <input
              id="sign-in-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="glass-pill h-12 rounded-xl px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-mint"
            />
            <PillButton
              type="submit"
              variant="neon"
              className="justify-center"
              disabled={busy || !email.trim()}
            >
              {busy ? "Sending…" : "Email me a code"}
            </PillButton>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void verify();
            }}
            className="flex flex-col gap-3"
          >
            <label className="sr-only" htmlFor="sign-in-code">
              Sign-in code
            </label>
            <input
              id="sign-in-code"
              ref={codeInput}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={CODE_LENGTH}
              autoFocus
              value={code}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH);
                setCode(digits);
                // A full code (typed or autofilled from the email) signs in straight away.
                if (digits.length === CODE_LENGTH) void verify(digits);
              }}
              className="glass-pill h-14 rounded-xl px-4 text-center font-display text-2xl tracking-[0.5em] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-mint"
            />
            <PillButton
              type="submit"
              variant="neon"
              className="justify-center"
              disabled={busy || code.length !== CODE_LENGTH}
            >
              {busy ? "Signing in…" : "Sign in"}
            </PillButton>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                className="text-muted hover:text-fg"
                onClick={() => {
                  setStep("email");
                  setError(null);
                }}
              >
                Use a different email
              </button>
              <button
                type="button"
                disabled={resendIn > 0 || busy}
                className="font-semibold text-mint disabled:font-normal disabled:text-muted"
                onClick={() => void send()}
              >
                {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
              </button>
            </div>
          </form>
        )}

        {error && (
          <p role="alert" className="text-sm text-injured">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
