"use client";

import { useEffect, useRef, useState, type TouchEvent } from "react";
import type { StudyCard } from "@/lib/db/queries";
import { markCardStatus } from "@/lib/actions/cards";
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

export function FlashcardStudy({
  cards,
  startIndex,
  onBackToList,
  topicId,
}: {
  cards: StudyCard[];
  startIndex: number;
  onBackToList: () => void;
  topicId: string;
}) {
  const [shuffled, setShuffled] = useState(false);
  // Declared before `order` (rather than after `pauseOn`, where the plan's
  // narrative groups the new pass-tracking state) because `order`'s lazy
  // initializer below reads `passCards` — a `const` declared later in
  // source order would be in the temporal dead zone at the moment React
  // invokes that initializer, throwing a ReferenceError on mount.
  const [trackProgress, setTrackProgress] = useState(false);
  const [passCards, setPassCards] = useState(cards);
  const [passKnown, setPassKnown] = useState<Set<number>>(new Set());
  const [passUnknown, setPassUnknown] = useState<Set<number>>(new Set());
  const [summary, setSummary] = useState(false);
  const [order, setOrder] = useState<number[]>(() => passCards.map((_, i) => i));
  // `startIndex` is an index into `cards`; `pos` indexes into `order` (see
  // `current = cards[order[pos]]` below). These coincide here only because
  // `order` is always the identity mapping at mount (shuffled starts
  // false) — if shuffle state is ever made to persist across mounts, seed
  // `pos` from `order.indexOf(startIndex)` instead of `startIndex` directly.
  const [pos, setPos] = useState(startIndex);
  const [flipped, setFlipped] = useState(false);
  const [autoMode, setAutoMode] = useState<AutoMode>(null);
  const [pauseOn, setPauseOn] = useState(true);
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
    const base = passCards.map((_, i) => i);
    setOrder(rand ? shuffle(base) : base);
    setPos(0);
    setFlipped(false);
  }

  function next() {
    if (autoMode) stopAuto();
    setFlipped(false);
    if (pos < order.length - 1) {
      setPos(pos + 1);
    } else if (trackProgress) {
      setSummary(true);
    } else {
      if (shuffled) setOrder(shuffle(passCards.map((_, i) => i)));
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

  function toggleTrackProgress() {
    const turningOn = !trackProgress;
    setTrackProgress(turningOn);
    if (turningOn) {
      if (autoMode) stopAuto();
      setPassCards(cards);
      const base = cards.map((_, i) => i);
      setOrder(shuffled ? shuffle(base) : base);
      setPos(0);
      setFlipped(false);
      setPassKnown(new Set());
      setPassUnknown(new Set());
      setSummary(false);
    }
  }

  function markCurrent(status: "known" | "unknown") {
    if (autoMode) stopAuto();
    const card = passCards[order[pos]];
    markCardStatus(card.id, topicId, status).catch(() => {});

    if (status === "known") {
      setPassKnown((prev) => new Set(prev).add(card.id));
      setPassUnknown((prev) => {
        if (!prev.has(card.id)) return prev;
        const next = new Set(prev);
        next.delete(card.id);
        return next;
      });
    } else {
      setPassUnknown((prev) => new Set(prev).add(card.id));
      setPassKnown((prev) => {
        if (!prev.has(card.id)) return prev;
        const next = new Set(prev);
        next.delete(card.id);
        return next;
      });
    }

    setFlipped(false);
    if (pos < order.length - 1) {
      setPos(pos + 1);
    } else {
      setSummary(true);
    }
  }

  function startRepeatMistakes() {
    const mistakes = passCards.filter((c) => passUnknown.has(c.id));
    setPassCards(mistakes);
    const base = mistakes.map((_, i) => i);
    setOrder(shuffled ? shuffle(base) : base);
    setPos(0);
    setFlipped(false);
    setPassKnown(new Set());
    setPassUnknown(new Set());
    setSummary(false);
  }

  // Mirrors `pauseOn` into a ref (via effect, not a render-time write — see
  // `autoModeRef` below for why) so `runAuto`'s long-lived loop can read the
  // live value at each pause point instead of the value captured when it
  // started, letting the toggle take effect mid-run.
  const pauseOnRef = useRef(true);
  useEffect(() => {
    pauseOnRef.current = pauseOn;
  });

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
        const cardId = passCards[order[position]].id;

        await play(cardId, "question-lu");
        if (autoGenRef.current !== gen) return;

        if (mode === "L+R") {
          await play(cardId, "question-ru");
          if (autoGenRef.current !== gen) return;
        }

        if (pauseOnRef.current) {
          await sleep(1000);
          if (autoGenRef.current !== gen) return;
        }

        setFlipped(true);
        await play(cardId, "answer-lu");
        if (autoGenRef.current !== gen) return;

        if (mode === "L+R") {
          await play(cardId, "answer-ru");
          if (autoGenRef.current !== gen) return;
        }

        if (pauseOnRef.current) {
          await sleep(1000);
          if (autoGenRef.current !== gen) return;
        }

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

  const current = passCards[order[pos]];

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

  if (summary) {
    const knownCount = passKnown.size;
    const totalCount = passCards.length;
    const hasMistakes = passUnknown.size > 0;
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--accent-text)]">
          Pass complete
        </div>
        <div className="text-[32px] font-bold text-[var(--ink)]">
          {knownCount} / {totalCount} known
        </div>
        <div className="flex w-full max-w-[320px] flex-col gap-3">
          {hasMistakes && (
            <button
              onClick={startRepeatMistakes}
              className="rounded-[14px] bg-[var(--accent-fill)] py-4 text-base font-bold text-[var(--accent-ink)]"
            >
              Repeat mistakes ({passUnknown.size})
            </button>
          )}
          <button
            onClick={onBackToList}
            className="rounded-[14px] border border-[var(--line)] bg-[var(--btn-secondary-bg)] py-4 text-base font-bold text-[var(--btn-secondary-ink)]"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

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
      <div className="px-4 pb-1 pt-3">
        <button
          onClick={() => {
            if (autoMode) stopAuto();
            onBackToList();
          }}
          className="text-[13px] font-semibold text-[var(--ink-muted)] underline"
        >
          ‹ Back to cards
        </button>
      </div>

      <div className="flex items-center justify-between px-4 pb-1">
        <div className="flex rounded-[10px] bg-[var(--btn-secondary-bg)] p-[3px]">
          <button
            onClick={() => setMode(false)}
            aria-pressed={!shuffled}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold ${
              !shuffled
                ? "bg-[var(--chip-bg)] text-[var(--ink)] shadow-sm"
                : "text-[var(--btn-secondary-ink)]"
            }`}
          >
            In order
          </button>
          <button
            onClick={() => setMode(true)}
            aria-pressed={shuffled}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold ${
              shuffled
                ? "bg-[var(--chip-bg)] text-[var(--ink)] shadow-sm"
                : "text-[var(--btn-secondary-ink)]"
            }`}
          >
            Shuffle
          </button>
        </div>
        <div className="text-[13px] font-semibold text-[var(--ink-muted)]">
          {pos + 1} / {order.length}
        </div>
      </div>

      <div className="flex items-center justify-between px-4 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (soundOn && autoMode) stopAuto();
              setSoundOn(!soundOn);
            }}
            aria-pressed={soundOn}
            className={`rounded-lg border px-3 py-1.5 text-[13px] font-semibold ${
              soundOn
                ? "border-[var(--accent-on-dark)] bg-[var(--btn-secondary-bg)] text-[var(--accent-on-dark)]"
                : "border-[var(--line)] bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-ink)]"
            }`}
          >
            {soundOn ? "Sound: On" : "Sound: Off"}
          </button>
          <button
            onClick={() => setPauseOn(!pauseOn)}
            aria-pressed={pauseOn}
            className={`rounded-lg border px-3 py-1.5 text-[13px] font-semibold ${
              pauseOn
                ? "border-[var(--accent-on-dark)] bg-[var(--btn-secondary-bg)] text-[var(--accent-on-dark)]"
                : "border-[var(--line)] bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-ink)]"
            }`}
          >
            {pauseOn ? "Pause: On" : "Pause: Off"}
          </button>
          <button
            onClick={toggleTrackProgress}
            aria-pressed={trackProgress}
            className={`rounded-lg border px-3 py-1.5 text-[13px] font-semibold ${
              trackProgress
                ? "border-[var(--accent-on-dark)] bg-[var(--btn-secondary-bg)] text-[var(--accent-on-dark)]"
                : "border-[var(--line)] bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-ink)]"
            }`}
          >
            {trackProgress ? "Track progress: On" : "Track progress: Off"}
          </button>
          {audioError && (
            <span className="text-[11px] font-semibold text-[var(--danger)]">Audio unavailable</span>
          )}
        </div>
        <div className="flex gap-2">
          {autoMode ? (
            <button
              onClick={stopAuto}
              className="rounded-lg border border-[var(--accent-on-dark)] bg-[var(--btn-secondary-bg)] px-3 py-1.5 text-[13px] font-semibold text-[var(--accent-on-dark)]"
            >
              ■ Stop
            </button>
          ) : (
            <>
              <button
                onClick={() => runAuto("L")}
                className="rounded-lg border border-[var(--line)] bg-[var(--btn-secondary-bg)] px-3 py-1.5 text-[13px] font-semibold text-[var(--btn-secondary-ink)]"
              >
                ▶ Auto L
              </button>
              <button
                onClick={() => runAuto("L+R")}
                className="rounded-lg border border-[var(--line)] bg-[var(--btn-secondary-bg)] px-3 py-1.5 text-[13px] font-semibold text-[var(--btn-secondary-ink)]"
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
            <div className="flip-face flex flex-col items-center justify-center rounded-[22px] border border-[var(--line)] bg-[var(--surface)] p-7 text-center shadow-lg">
              <div className="absolute top-4 text-xs font-bold uppercase tracking-widest text-[var(--accent-text)]">
                Fro · Question
              </div>
              <div className="text-[26px] font-semibold leading-snug text-[var(--ink)]">
                {current.questionLu}
              </div>
              <div className="mt-4 text-base italic leading-snug text-[var(--ink-muted)]">
                {current.questionRu}
              </div>
              <div className="absolute bottom-4 text-xs text-[var(--ink-muted)] opacity-70">
                Tap to see the answer
              </div>
            </div>
            <div className="flip-face flip-back flex flex-col items-center justify-center rounded-[22px] border border-[var(--line)] bg-[var(--surface)] p-7 text-center shadow-lg">
              <div className="absolute top-4 text-xs font-bold uppercase tracking-widest text-[var(--ink-muted)]">
                Äntwert · Answer
              </div>
              <div className="text-[26px] font-semibold leading-snug text-[var(--ink)]">
                {current.answerLu}
              </div>
              <div className="mt-4 text-base italic leading-snug text-[var(--ink-muted)]">
                {current.answerRu}
              </div>
              <div className="absolute bottom-4 text-xs text-[var(--ink-muted)] opacity-70">
                Tap to flip back
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3 px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3">
        <button
          onClick={prev}
          disabled={pos === 0}
          className="flex-1 rounded-[14px] border border-[var(--line)] bg-[var(--btn-secondary-bg)] py-4 text-base font-bold text-[var(--btn-secondary-ink)] disabled:opacity-40"
        >
          ‹ Back
        </button>
        {trackProgress ? (
          <>
            <button
              onClick={() => markCurrent("unknown")}
              className="flex-1 rounded-[14px] border border-[var(--danger)] bg-[var(--btn-secondary-bg)] py-4 text-base font-bold text-[var(--danger)]"
            >
              ✕ Don&apos;t know
            </button>
            <button
              onClick={() => markCurrent("known")}
              className="flex-1 rounded-[14px] bg-[var(--accent-fill)] py-4 text-base font-bold text-[var(--accent-ink)]"
            >
              ✓ Know
            </button>
          </>
        ) : (
          <button
            onClick={next}
            className="flex-1 rounded-[14px] bg-[var(--accent-fill)] py-4 text-base font-bold text-[var(--accent-ink)]"
          >
            {pos === order.length - 1 ? "Restart ↻" : "Next ›"}
          </button>
        )}
      </div>
    </>
  );
}
