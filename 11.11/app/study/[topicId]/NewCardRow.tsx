"use client";

import { useActionState, useRef } from "react";
import { createCard } from "@/lib/actions/cards";

export function NewCardRow({ topicId }: { topicId: string }) {
  const boundAction = createCard.bind(null, topicId);
  const [state, formAction, pending] = useActionState(boundAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData: FormData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="grid grid-cols-1 gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:grid-cols-2"
    >
      <input
        name="questionLu"
        placeholder="Question (LU)"
        className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm placeholder:text-[var(--ink-muted)]"
      />
      <input
        name="questionRu"
        placeholder="Question (RU)"
        className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm placeholder:text-[var(--ink-muted)]"
      />
      <input
        name="answerLu"
        placeholder="Answer (LU)"
        className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm placeholder:text-[var(--ink-muted)]"
      />
      <input
        name="answerRu"
        placeholder="Answer (RU)"
        className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm placeholder:text-[var(--ink-muted)]"
      />
      <div className="col-span-full flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[var(--accent-fill)] px-4 py-2 text-sm font-semibold text-[var(--accent-ink)] disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add card"}
        </button>
        {state.error && <p className="text-sm text-[var(--danger)]">{state.error}</p>}
      </div>
    </form>
  );
}
