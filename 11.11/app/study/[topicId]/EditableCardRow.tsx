"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { updateCard, deleteCard } from "@/lib/actions/cards";
import type { StudyCard } from "@/lib/db/queries";

export function EditableCardRow({ card, topicId }: { card: StudyCard; topicId: string }) {
  const [questionLu, setQuestionLu] = useState(card.questionLu);
  const [questionRu, setQuestionRu] = useState(card.questionRu);
  const [answerLu, setAnswerLu] = useState(card.answerLu);
  const [answerRu, setAnswerRu] = useState(card.answerRu);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4"
    >
      <form
        action={updateCard.bind(null, card.id, topicId)}
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        <div className="col-span-full flex items-center justify-end gap-1">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none rounded-lg px-2 py-1.5 text-[var(--ink-muted)] active:cursor-grabbing"
            aria-label="Drag to reorder"
          >
            ⠿
          </button>
          <button
            type="submit"
            formAction={deleteCard.bind(null, card.id, topicId)}
            onClick={(e) => {
              if (!confirm("Delete this card?")) e.preventDefault();
            }}
            className="rounded-lg px-2 py-1.5 text-sm font-semibold text-[var(--danger)]"
          >
            Delete
          </button>
        </div>
        <input
          name="questionLu"
          value={questionLu}
          onChange={(e) => setQuestionLu(e.target.value)}
          placeholder="Question (LU)"
          className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm placeholder:text-[var(--ink-muted)]"
        />
        <input
          name="questionRu"
          value={questionRu}
          onChange={(e) => setQuestionRu(e.target.value)}
          placeholder="Question (RU)"
          className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm placeholder:text-[var(--ink-muted)]"
        />
        <input
          name="answerLu"
          value={answerLu}
          onChange={(e) => setAnswerLu(e.target.value)}
          placeholder="Answer (LU)"
          className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm placeholder:text-[var(--ink-muted)]"
        />
        <input
          name="answerRu"
          value={answerRu}
          onChange={(e) => setAnswerRu(e.target.value)}
          placeholder="Answer (RU)"
          className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm placeholder:text-[var(--ink-muted)]"
        />
        <button
          type="submit"
          className="col-span-full rounded-lg bg-[var(--accent-fill)] py-2 text-sm font-semibold text-[var(--accent-ink)]"
        >
          Save
        </button>
      </form>
    </div>
  );
}
