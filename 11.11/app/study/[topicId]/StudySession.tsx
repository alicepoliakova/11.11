"use client";

import { useState } from "react";
import type { StudyCard } from "@/lib/db/queries";
import { CardList } from "./CardList";
import { FlashcardStudy } from "./FlashcardStudy";

export function StudySession({ cards, topicId }: { cards: StudyCard[]; topicId: string }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  // Persists across the selectedIndex null/non-null cycles (StudySession
  // itself never unmounts) so CardList can restore scroll position after
  // "Back to cards". State, not a ref, because CardList reads it during
  // render (as `focusIndex`) and refs can't be read at render time.
  const [lastSelected, setLastSelected] = useState<number | null>(null);

  function select(index: number) {
    setLastSelected(index);
    setSelectedIndex(index);
  }

  if (selectedIndex === null) {
    return (
      <CardList cards={cards} topicId={topicId} onSelect={select} focusIndex={lastSelected} />
    );
  }

  return (
    <FlashcardStudy
      cards={cards}
      startIndex={selectedIndex}
      onBackToList={() => setSelectedIndex(null)}
    />
  );
}
