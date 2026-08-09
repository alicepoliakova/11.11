"use client";

import { useActionState } from "react";
import { createTopic } from "@/lib/actions/topics";

export function NewTopicForm() {
  const [state, formAction, pending] = useActionState(createTopic, {});

  return (
    <form
      action={formAction}
      className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-[#dbe3ec] bg-white p-4"
    >
      <div className="flex-1">
        <label className="mb-1 block text-xs font-semibold uppercase text-[#6c7a89]">
          New topic name
        </label>
        <input
          name="name"
          required
          placeholder="e.g. Wunnen"
          className="w-full rounded-lg border border-[#dbe3ec] px-3 py-2 text-sm outline-none focus:border-[#2E5A87]"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[#2E5A87] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add topic"}
      </button>
      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
