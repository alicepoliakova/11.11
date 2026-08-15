"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import type { StudyCard } from "@/lib/db/queries";
import { reorderCards } from "@/lib/actions/cards";
import { EditableCardRow } from "./EditableCardRow";
import { NewCardRow } from "./NewCardRow";

export function CardList({
  cards,
  topicId,
  onSelect,
  focusIndex,
}: {
  cards: StudyCard[];
  topicId: string;
  onSelect: (index: number) => void;
  focusIndex: number | null;
}) {
  const [editMode, setEditMode] = useState(false);
  const [orderedCards, setOrderedCards] = useState(cards);
  const focusedRef = useRef<HTMLButtonElement | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    setOrderedCards(cards);
  }, [cards]);

  useEffect(() => {
    if (!editMode) focusedRef.current?.scrollIntoView({ block: "center" });
  }, [editMode]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedCards.findIndex((c) => c.id === active.id);
    const newIndex = orderedCards.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const next = arrayMove(orderedCards, oldIndex, newIndex);
    setOrderedCards(next);
    reorderCards(
      topicId,
      next.map((c) => c.id)
    );
  }

  function selectCard(card: StudyCard) {
    const index = cards.findIndex((c) => c.id === card.id);
    if (index !== -1) onSelect(index);
  }

  if (editMode) {
    return (
      <div className="flex-1 overflow-y-auto px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
            Edit cards
          </h2>
          <button
            onClick={() => setEditMode(false)}
            className="rounded-lg bg-[var(--btn-secondary-bg)] px-3 py-1.5 text-[13px] font-semibold text-[var(--btn-secondary-ink)]"
          >
            Done
          </button>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={orderedCards.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-3">
              {orderedCards.map((card) => (
                <EditableCardRow key={card.id} card={card} topicId={topicId} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <div className="mt-3">
          <NewCardRow topicId={topicId} />
        </div>
      </div>
    );
  }

  const [first, ...rest] = orderedCards;
  const focusedCardId = focusIndex !== null ? cards[focusIndex]?.id : undefined;

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-5">
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setEditMode(true)}
          className="rounded-lg bg-[var(--btn-secondary-bg)] px-3 py-1.5 text-[13px] font-semibold text-[var(--btn-secondary-ink)]"
        >
          Edit
        </button>
      </div>
      <button
        type="button"
        ref={first.id === focusedCardId ? focusedRef : undefined}
        onClick={() => selectCard(first)}
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
            ref={card.id === focusedCardId ? focusedRef : undefined}
            onClick={() => selectCard(card)}
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
