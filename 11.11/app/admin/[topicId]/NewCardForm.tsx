"use client";

import { useActionState, useRef } from "react";
import { createCard } from "@/lib/actions/cards";

export function NewCardForm({ topicId }: { topicId: string }) {
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
      className="mb-6 grid grid-cols-1 gap-2 rounded-xl border border-[#dbe3ec] bg-white p-4 sm:grid-cols-2"
    >
      <input
        name="questionLu"
        placeholder="Question (LU)"
        className="rounded-lg border border-[#dbe3ec] px-3 py-2 text-sm"
      />
      <input
        name="questionRu"
        placeholder="Question (RU)"
        className="rounded-lg border border-[#dbe3ec] px-3 py-2 text-sm"
      />
      <input
        name="answerLu"
        placeholder="Answer (LU)"
        className="rounded-lg border border-[#dbe3ec] px-3 py-2 text-sm"
      />
      <input
        name="answerRu"
        placeholder="Answer (RU)"
        className="rounded-lg border border-[#dbe3ec] px-3 py-2 text-sm"
      />
      <div className="col-span-full flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[#2E5A87] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add card"}
        </button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      </div>
    </form>
  );
}
