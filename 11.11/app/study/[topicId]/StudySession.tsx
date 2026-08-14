"use client";

import { useState } from "react";
import type { StudyCard } from "@/lib/db/queries";
import { CardList } from "./CardList";
import { FlashcardStudy } from "./FlashcardStudy";

export function StudySession({ cards }: { cards: StudyCard[] }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (selectedIndex === null) {
    return <CardList cards={cards} onSelect={setSelectedIndex} />;
  }

  return (
    <FlashcardStudy
      cards={cards}
      startIndex={selectedIndex}
      onBackToList={() => setSelectedIndex(null)}
    />
  );
}
