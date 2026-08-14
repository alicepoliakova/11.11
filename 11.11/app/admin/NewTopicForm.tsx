"use client";

import { useActionState } from "react";
import { createTopic } from "@/lib/actions/topics";

export function NewTopicForm() {
  const [state, formAction, pending] = useActionState(createTopic, {});

  return (
    <form
      action={formAction}
      className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4"
    >
      <div className="flex-1">
        <label className="mb-1 block text-xs font-semibold uppercase text-[var(--ink-muted)]">
          New topic name
        </label>
        <input
          name="name"
          required
          placeholder="e.g. Wunnen"
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm outline-none placeholder:text-[var(--ink-muted)] focus:border-[var(--accent-text)]"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[var(--accent-fill)] px-4 py-2 text-sm font-semibold text-[var(--accent-ink)] disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add topic"}
      </button>
      {state.error && <p className="w-full text-sm text-[var(--danger)]">{state.error}</p>}
    </form>
  );
}
