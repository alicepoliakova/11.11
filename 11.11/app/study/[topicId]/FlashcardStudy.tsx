"use client";

import { useEffect, useRef, useState, type TouchEvent } from "react";
import type { StudyCard } from "@/lib/db/queries";
import { useSound, type AudioField } from "./useSound";

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type AutoMode = "L" | "L+R" | null;

export function FlashcardStudy({ cards }: { cards: StudyCard[] }) {
  const [shuffled, setShuffled] = useState(false);
  const [order, setOrder] = useState<number[]>(() => cards.map((_, i) => i));
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [autoMode, setAutoMode] = useState<AutoMode>(null);
  const touchStartX = useRef<number | null>(null);
  const autoGenRef = useRef(0);
  const { soundOn, setSoundOn, audioError, play, stop, hydrated } = useSound();

  function stopAuto() {
    autoGenRef.current += 1;
    stop();
    setAutoMode(null);
  }

  function setMode(rand: boolean) {
    if (autoMode) stopAuto();
    setShuffled(rand);
    const base = cards.map((_, i) => i);
    setOrder(rand ? shuffle(base) : base);
    setPos(0);
    setFlipped(false);
  }

  function next() {
    if (autoMode) stopAuto();
    setFlipped(false);
    if (pos < order.length - 1) {
      setPos(pos + 1);
    } else {
      if (shuffled) setOrder(shuffle(cards.map((_, i) => i)));
      setPos(0);
    }
  }

  function prev() {
    if (autoMode) stopAuto();
    if (pos > 0) {
      setFlipped(false);
      setPos(pos - 1);
    }
  }

  async function runAuto(mode: "L" | "L+R") {
    const gen = ++autoGenRef.current;
    setAutoMode(mode);
    if (!soundOn) setSoundOn(true);

    let position = pos;
    try {
      while (position < order.length) {
        if (autoGenRef.current !== gen) return;
        setPos(position);
        setFlipped(false);
        const cardId = cards[order[position]].id;

        await play(cardId, "question-lu");
        if (autoGenRef.current !== gen) return;

        if (mode === "L+R") {
          await play(cardId, "question-ru");
          if (autoGenRef.current !== gen) return;
        }

        await sleep(1000);
        if (autoGenRef.current !== gen) return;

        setFlipped(true);
        await play(cardId, "answer-lu");
        if (autoGenRef.current !== gen) return;

        if (mode === "L+R") {
          await play(cardId, "answer-ru");
          if (autoGenRef.current !== gen) return;
        }

        await sleep(1000);
        if (autoGenRef.current !== gen) return;

        position += 1;
      }
    } catch {
      // play() rejected: either stopAuto() interrupted it, or a real
      // playback failure (audioError is already set by useSound in that case).
    }

    if (autoGenRef.current === gen) {
      setAutoMode(null);
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === " ") {
        e.preventDefault();
        if (autoMode) stopAuto();
        setFlipped((f) => !f);
      }
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    return () => {
      autoGenRef.current += 1;
      stop();
    };
  }, [stop]);

  const current = cards[order[pos]];

  // Mirrors `autoMode` into a ref, deliberately excluded from the effect's
  // deps below: the effect should only fire on genuine card/flip/sound
  // changes, not merely because Auto mode just turned on or off — otherwise
  // the instant Auto mode ends, this effect would replay whatever face
  // was just read by the Auto loop a second time.
  const autoModeRef = useRef<AutoMode>(null);
  useEffect(() => {
    autoModeRef.current = autoMode;
  });

  useEffect(() => {
    if (!hydrated || !soundOn || autoModeRef.current) return;
    const field: AudioField = flipped ? "answer-lu" : "question-lu";
    play(current.id, field).catch(() => {});
  }, [current.id, flipped, soundOn, hydrated, play]);

  function onTouchStart(e: TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function onTouchEnd(e: TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 60) {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      dx < 0 ? next() : prev();
    }
    touchStartX.current = null;
  }

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

      <div className="flex items-center justify-between px-4 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundOn(!soundOn)}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold ${
              soundOn ? "bg-[#2E5A87] text-white" : "bg-[#dde5ee] text-[#213f5e]"
            }`}
          >
            {soundOn ? "Sound: On" : "Sound: Off"}
          </button>
          {audioError && (
            <span className="text-[11px] font-semibold text-[#c8702d]">Audio unavailable</span>
          )}
        </div>
        <div className="flex gap-2">
          {autoMode ? (
            <button
              onClick={stopAuto}
              className="rounded-lg bg-[#c8702d] px-3 py-1.5 text-[13px] font-semibold text-white"
            >
              ■ Stop
            </button>
          ) : (
            <>
              <button
                onClick={() => runAuto("L")}
                className="rounded-lg bg-[#dde5ee] px-3 py-1.5 text-[13px] font-semibold text-[#213f5e]"
              >
                ▶ Auto L
              </button>
              <button
                onClick={() => runAuto("L+R")}
                className="rounded-lg bg-[#dde5ee] px-3 py-1.5 text-[13px] font-semibold text-[#213f5e]"
              >
                ▶ Auto L+R
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center px-4 pb-1 pt-2.5">
        <div
          className="flip-card w-full max-w-[520px] flex-1 cursor-pointer"
          onClick={() => {
            if (autoMode) stopAuto();
            setFlipped((f) => !f);
          }}
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
