"use client";

import type { StudyCard } from "@/lib/db/queries";

export function CardList({
  cards,
  onSelect,
}: {
  cards: StudyCard[];
  onSelect: (index: number) => void;
}) {
  const [first, ...rest] = cards;

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-5">
      <button
        type="button"
        onClick={() => onSelect(0)}
        className="mb-4 flex w-full flex-col items-start gap-2 rounded-[22px] border border-[var(--line)] bg-[var(--surface)] p-6 text-left shadow-lg transition-transform active:scale-[0.98]"
      >
        <span className="text-xs font-bold uppercase tracking-widest text-[var(--accent-text)]">
          Fro · Question
        </span>
        <span className="text-[22px] font-semibold leading-snug text-[var(--ink)]">
          {first.questionLu}
        </span>
      </button>
      <div className="flex flex-col gap-2">
        {rest.map((card, i) => (
          <button
            type="button"
            key={card.id}
            onClick={() => onSelect(i + 1)}
            className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-left transition-transform active:scale-[0.98]"
          >
            <span className="text-xs font-semibold text-[var(--ink-muted)]">{i + 2}</span>
            <span className="text-sm font-medium text-[var(--ink)]">{card.questionLu}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
