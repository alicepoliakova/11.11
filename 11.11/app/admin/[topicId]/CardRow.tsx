"use client";

import { useState } from "react";
import { updateCard, deleteCard, moveCard } from "@/lib/actions/cards";
import type { AdminCard } from "@/lib/db/queries";

export function CardRow({
  card,
  topicId,
  isFirst,
  isLast,
}: {
  card: AdminCard;
  topicId: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [questionLu, setQuestionLu] = useState(card.questionLu);
  const [questionRu, setQuestionRu] = useState(card.questionRu);
  const [answerLu, setAnswerLu] = useState(card.answerLu);
  const [answerRu, setAnswerRu] = useState(card.answerRu);

  return (
    <div className="rounded-xl border border-[#dbe3ec] bg-white p-4">
      <form
        action={updateCard.bind(null, card.id, topicId)}
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        <input
          name="questionLu"
          value={questionLu}
          onChange={(e) => setQuestionLu(e.target.value)}
          placeholder="Question (LU)"
          className="rounded-lg border border-[#dbe3ec] px-3 py-2 text-sm"
        />
        <input
          name="questionRu"
          value={questionRu}
          onChange={(e) => setQuestionRu(e.target.value)}
          placeholder="Question (RU)"
          className="rounded-lg border border-[#dbe3ec] px-3 py-2 text-sm"
        />
        <input
          name="answerLu"
          value={answerLu}
          onChange={(e) => setAnswerLu(e.target.value)}
          placeholder="Answer (LU)"
          className="rounded-lg border border-[#dbe3ec] px-3 py-2 text-sm"
        />
        <input
          name="answerRu"
          value={answerRu}
          onChange={(e) => setAnswerRu(e.target.value)}
          placeholder="Answer (RU)"
          className="rounded-lg border border-[#dbe3ec] px-3 py-2 text-sm"
        />
        <div className="col-span-full flex items-center justify-between pt-1">
          <div className="flex gap-1">
            <button
              type="submit"
              formAction={moveCard.bind(null, card.id, topicId, "up")}
              disabled={isFirst}
              className="rounded-lg px-2 py-1 text-sm text-[#2E5A87] disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="submit"
              formAction={moveCard.bind(null, card.id, topicId, "down")}
              disabled={isLast}
              className="rounded-lg px-2 py-1 text-sm text-[#2E5A87] disabled:opacity-30"
            >
              ↓
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-lg bg-[#2E5A87] px-3 py-1.5 text-sm font-semibold text-white"
            >
              Save
            </button>
            <button
              type="submit"
              formAction={deleteCard.bind(null, card.id, topicId)}
              onClick={(e) => {
                if (!confirm("Delete this card?")) e.preventDefault();
              }}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-red-600"
            >
              Delete
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
