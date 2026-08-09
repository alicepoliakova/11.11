"use client";

import { useActionState } from "react";
import { login } from "@/lib/actions/auth";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, {});

  return (
    <div className="flex flex-1 items-center justify-center bg-[#eef2f6] p-6">
      <form
        action={formAction}
        className="w-full max-w-sm rounded-2xl border border-[#dbe3ec] bg-white p-8 shadow-sm"
      >
        <h1 className="mb-1 text-lg font-bold text-[#213f5e]">Admin login</h1>
        <p className="mb-6 text-sm text-[#6c7a89]">Sproochentest admin</p>
        <input
          type="password"
          name="password"
          placeholder="Password"
          required
          className="mb-3 w-full rounded-lg border border-[#dbe3ec] px-3 py-2 text-sm outline-none focus:border-[#2E5A87]"
        />
        {state.error && <p className="mb-3 text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-[#2E5A87] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Checking…" : "Log in"}
        </button>
      </form>
    </div>
  );
}
