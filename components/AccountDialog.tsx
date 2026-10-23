"use client";
import { useEffect, useRef, useState } from "react";
import type { AccountState } from "@/lib/accounts/use-account";
export function AccountDialog({
  account,
  close,
  initialMode = "signup",
}: {
  account: AccountState;
  close: () => void;
  initialMode?: "signup" | "signin";
}) {
  const [mode, setMode] = useState<"signup" | "signin" | "forgot" | "reset">(
      account.recovery ? "reset" : initialMode,
    ),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  useEffect(() => {
    if (account.recovery) setMode("reset");
  }, [account.recovery]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!account.client || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "signup") {
        const { data, error } = await account.client.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) close();
        else {
          setMessage(
            "Check your email to confirm your account, then return here and sign in. If you already have an account, choose Sign in.",
          );
          setPassword("");
        }
      } else if (mode === "signin") {
        const { error } = await account.client.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        close();
      } else if (mode === "forgot") {
        const { error } = await account.client.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: window.location.origin },
        );
        if (error) throw error;
        setMessage(
          "If an account exists for that email, a password reset link is on its way.",
        );
      } else {
        const { error } = await account.client.auth.updateUser({ password });
        if (error) throw error;
        account.setRecovery(false);
        setMessage("Password updated. You can close this window.");
        setPassword("");
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "We could not complete that request. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="account-dialog"
      aria-labelledby="account-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
    >
      <button
        className="dialog-close"
        aria-label="Close account window"
        disabled={busy}
        onClick={close}
      >
        ×
      </button>
      <div className="eyebrow">YOUR PROJECTS, RIGHT WHERE YOU LEFT THEM</div>
      <h2 id="account-title">
        {account.user && !account.recovery
          ? "Your account"
          : mode === "signup"
            ? "Create your Buildly account"
            : mode === "signin"
              ? "Welcome back"
              : mode === "forgot"
                ? "Reset your password"
                : "Choose a new password"}
      </h2>
      {!account.client ? (
        <>
          <p>
            Account services are not connected yet. Your projects are
            automatically saved on this device. Cloud saving will be available
            when account setup is completed.
          </p>
          <button className="primary" onClick={close}>
            Keep on this device
          </button>
        </>
      ) : account.user && !account.recovery ? (
        <>
          <p>
            Signed in as <strong>{account.user.email}</strong>.
          </p>
          <p>
            Projects you create while signed in are automatically saved to your
            account when a cloud save succeeds.
          </p>
          <button
            className="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const { error } = await account.client!.auth.signOut();
              setBusy(false);
              if (error) setError(error.message);
              else close();
            }}
          >
            Sign out
          </button>
        </>
      ) : (
        <>
          <p>
            {mode === "signup"
              ? "Save your projects privately and open them on another device."
              : "Your projects are waiting for you."}
          </p>
          {mode !== "reset" && (
            <div className="account-tabs">
              <button
                aria-pressed={mode === "signup"}
                onClick={() => {
                  setMode("signup");
                  setError("");
                  setMessage("");
                }}
              >
                Create account
              </button>
              <button
                aria-pressed={mode === "signin"}
                onClick={() => {
                  setMode("signin");
                  setError("");
                  setMessage("");
                }}
              >
                Sign in
              </button>
            </div>
          )}
          <form onSubmit={submit}>
            {mode !== "reset" && (
              <label className="field">
                Email address
                <input
                  autoComplete="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            )}
            {mode !== "forgot" && (
              <label className="field">
                Password
                <input
                  type="password"
                  aria-label="Password"
                  aria-describedby="account-password-help"
                  required
                  minLength={8}
                  autoComplete={
                    mode === "signin" ? "current-password" : "new-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <small id="account-password-help">At least 8 characters.</small>
              </label>
            )}
            <button className="primary" disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "signup"
                  ? "Create account"
                  : mode === "signin"
                    ? "Sign in"
                    : mode === "forgot"
                      ? "Send reset link"
                      : "Update password"}
            </button>
          </form>
          {mode === "signin" && (
            <button className="text-button" onClick={() => setMode("forgot")}>
              Forgot your password?
            </button>
          )}
          <button className="text-button" disabled={busy} onClick={close}>
            Keep working on this device
          </button>
        </>
      )}
      {message && (
        <p className="account-message" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="account-error" role="alert">
          {error}
        </p>
      )}
    </dialog>
  );
}
