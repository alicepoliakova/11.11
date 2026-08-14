"use client";

import { useActionState } from "react";
import { login } from "@/lib/actions/auth";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, {});

  return (
    <div className="flex flex-1 items-center justify-center bg-[var(--bg)] p-6">
      <form
        action={formAction}
        className="w-full max-w-sm rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-8 shadow-sm"
      >
        <h1 className="mb-1 text-lg font-bold text-[var(--ink)]">Admin login</h1>
        <p className="mb-6 text-sm text-[var(--ink-muted)]">Sproochentest admin</p>
        <input
          type="password"
          name="password"
          placeholder="Password"
          required
          className="mb-3 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm outline-none placeholder:text-[var(--ink-muted)] focus:border-[var(--accent-text)]"
        />
        {state.error && <p className="mb-3 text-sm text-[var(--danger)]">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-[var(--accent-fill)] px-3 py-2 text-sm font-semibold text-[var(--accent-ink)] disabled:opacity-60"
        >
          {pending ? "Checking…" : "Log in"}
        </button>
      </form>
    </div>
  );
}
