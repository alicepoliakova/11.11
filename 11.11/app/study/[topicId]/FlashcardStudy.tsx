"use client";

import { useEffect, useRef, useState, type TouchEvent } from "react";
import type { StudyCard } from "@/lib/db/queries";

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function FlashcardStudy({ cards }: { cards: StudyCard[] }) {
  const [shuffled, setShuffled] = useState(false);
  const [order, setOrder] = useState<number[]>(() => cards.map((_, i) => i));
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const touchStartX = useRef<number | null>(null);

  function setMode(rand: boolean) {
    setShuffled(rand);
    const base = cards.map((_, i) => i);
    setOrder(rand ? shuffle(base) : base);
    setPos(0);
    setFlipped(false);
  }

  function next() {
    setFlipped(false);
    if (pos < order.length - 1) {
      setPos(pos + 1);
    } else {
      if (shuffled) setOrder(shuffle(cards.map((_, i) => i)));
      setPos(0);
    }
  }

  function prev() {
    if (pos > 0) {
      setFlipped(false);
      setPos(pos - 1);
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
      }
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  function onTouchStart(e: TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function onTouchEnd(e: TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 60) {
      dx < 0 ? next() : prev();
    }
    touchStartX.current = null;
  }

  const current = cards[order[pos]];

  return (
    <>
      <div className="flex items-center justify-between px-4 pb-1 pt-3">
        <div className="flex rounded-[10px] bg-[#dde5ee] p-[3px]">
          <button
            onClick={() => setMode(false)}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold text-[#213f5e] ${
              !shuffled ? "bg-white shadow-sm" : ""
            }`}
          >
            In order
          </button>
          <button
            onClick={() => setMode(true)}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold text-[#213f5e] ${
              shuffled ? "bg-white shadow-sm" : ""
            }`}
          >
            Shuffle
          </button>
        </div>
        <div className="text-[13px] font-semibold text-[#6c7a89]">
          {pos + 1} / {order.length}
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center px-4 pb-1 pt-2.5">
        <div
          className="flip-card w-full max-w-[520px] flex-1 cursor-pointer"
          onClick={() => setFlipped((f) => !f)}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className={`flip-inner ${flipped ? "flip-flipped" : ""}`}>
            <div className="flip-face flex flex-col items-center justify-center rounded-[22px] border border-[#dbe3ec] bg-white p-7 text-center shadow-lg">
              <div className="absolute top-4 text-xs font-bold uppercase tracking-widest text-[#2E5A87]">
                Fro · Question
              </div>
              <div className="text-[26px] font-semibold leading-snug text-[#1a1a1a]">
                {current.questionLu}
              </div>
              <div className="mt-4 text-base italic leading-snug text-[#6c7a89]">
                {current.questionRu}
              </div>
              <div className="absolute bottom-4 text-xs text-[#a9b4c0]">Tap to see the answer</div>
            </div>
            <div className="flip-face flip-back flex flex-col items-center justify-center rounded-[22px] border border-[#dbe3ec] bg-white p-7 text-center shadow-lg">
              <div className="absolute top-4 text-xs font-bold uppercase tracking-widest text-[#c8702d]">
                Äntwert · Answer
              </div>
              <div className="text-[26px] font-semibold leading-snug text-[#213f5e]">
                {current.answerLu}
              </div>
              <div className="mt-4 text-base italic leading-snug text-[#6c7a89]">
                {current.answerRu}
              </div>
              <div className="absolute bottom-4 text-xs text-[#a9b4c0]">Tap to flip back</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3 px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3">
        <button
          onClick={prev}
          disabled={pos === 0}
          className="flex-1 rounded-[14px] bg-[#dde5ee] py-4 text-base font-bold text-[#213f5e] disabled:opacity-40"
        >
          ‹ Back
        </button>
        <button
          onClick={next}
          className="flex-1 rounded-[14px] bg-[#2E5A87] py-4 text-base font-bold text-white"
        >
          {pos === order.length - 1 ? "Restart ↻" : "Next ›"}
        </button>
      </div>
    </>
  );
}
