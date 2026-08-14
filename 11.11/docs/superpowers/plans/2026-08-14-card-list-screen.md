# Card List Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Insert a scrollable card-list browse screen between picking a topic and full-screen study mode — tap a topic, see the topic's cards, tap any card to jump straight into full-screen mode starting there, with a way back to the list from full-screen.

**Architecture:** A new client component `StudySession` owns one piece of state (`selectedIndex: number | null`) and swaps between two existing-shape children: a new `CardList` (browse) and the existing `FlashcardStudy` (study), now accepting a starting index and a callback back to the list. No new routes — everything happens client-side within `/study/[topicId]`.

**Tech Stack:** Same as the rest of the app — React 19 client components, Tailwind arbitrary-value classes reading the existing Charcoal Lime CSS tokens. No new dependencies, no schema/DB changes.

## Global Constraints

- No new route/URL — the list and full-screen views are both rendered from `/study/[topicId]`, toggled by client state.
- Tapping any card in the list (including the featured first one) immediately opens full-screen mode at that card — no separate confirm step.
- List rows show the Luxembourgish question only — no Russian gloss, no answer preview.
- The first card renders larger/featured at the top of the scroll (not pinned/sticky — it scrolls with the rest).
- Full-screen mode gains a "‹ Back to cards" control (returns to the list) that is separate from and in addition to the existing "Topics" link in `page.tsx`'s header (unchanged, still jumps straight to `/`).
- All new UI uses the existing tokens (`--bg`, `--surface`, `--ink`, `--ink-muted`, `--line`, `--accent-fill`, `--accent-text`, `--btn-secondary-bg`/`--btn-secondary-ink`) — no new colors.
- `FlashcardStudy`'s existing state/logic (sound, pause, auto mode, the `hydrated` gate, the `autoModeRef`/`pauseOnRef` sync patterns, generation-counter cancellation) must not change in behavior — only its starting position and one new UI control are added.
- This repo has no automated test framework and no browser tool in this environment. Verification is `npm run lint`, `npm run build`, and `curl` against a locally running `npm run dev`. Live click-through/visual confirmation is deferred to the project owner.

---

### Task 1: Card list component

**Files:**
- Create: `app/study/[topicId]/CardList.tsx`

**Interfaces:**
- Produces: `CardList({ cards: StudyCard[], onSelect: (index: number) => void })` — a `"use client"` component. `StudyCard` is the existing type from `lib/db/queries.ts` (`{ id, questionLu, questionRu, answerLu, answerRu }`), already used by `FlashcardStudy`. Calls `onSelect(index)` with the 0-based index into `cards` of whichever row was tapped. Used by Task 2's `StudySession`.

- [ ] **Step 1: Create the component**

Create `app/study/[topicId]/CardList.tsx`:

```tsx
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
```

(`[first, ...rest]` destructuring is safe here — this component is only ever rendered when `topic.cards.length > 0`, guarded by `page.tsx`'s existing empty-state check, same guarantee `FlashcardStudy` already relies on for `cards[0]`.)

- [ ] **Step 2: Verify**

Run: `npm run lint` — expect no new errors/warnings.
Run: `npm run build` — expect success. (Nothing imports `CardList` yet, so this only confirms the file itself is valid TypeScript/JSX — full integration is verified in Task 2.)

- [ ] **Step 3: Commit**

```bash
git add "app/study/[topicId]/CardList.tsx"
git commit -m "feat: add card list component for the study screen"
```

---

### Task 2: Wire the list into the study flow

**Files:**
- Create: `app/study/[topicId]/StudySession.tsx`
- Modify: `app/study/[topicId]/FlashcardStudy.tsx`
- Modify: `app/study/[topicId]/page.tsx`

**Interfaces:**
- Consumes: `CardList` from Task 1; `useSound`, `AudioField` (unchanged) from `./useSound`; `StudyCard` from `lib/db/queries.ts`.
- Produces: `StudySession({ cards: StudyCard[] })` — owns `selectedIndex: number | null`, renders `CardList` when `null`, otherwise `FlashcardStudy` with `startIndex={selectedIndex}` and `onBackToList={() => setSelectedIndex(null)}`. Replaces `FlashcardStudy` as what `page.tsx` renders.
- `FlashcardStudy`'s prop shape changes from `{ cards: StudyCard[] }` to `{ cards: StudyCard[]; startIndex: number; onBackToList: () => void }` — both new props required (there is now only one caller, `StudySession`, and it always supplies both).

- [ ] **Step 1: Add the starting index and back-to-list control to FlashcardStudy**

Replace the full contents of `app/study/[topicId]/FlashcardStudy.tsx` with:

```tsx
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

export function FlashcardStudy({
  cards,
  startIndex,
  onBackToList,
}: {
  cards: StudyCard[];
  startIndex: number;
  onBackToList: () => void;
}) {
  const [shuffled, setShuffled] = useState(false);
  const [order, setOrder] = useState<number[]>(() => cards.map((_, i) => i));
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
        const cardId = cards[order[position]].id;

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
        <button
          onClick={next}
          className="flex-1 rounded-[14px] bg-[var(--accent-fill)] py-4 text-base font-bold text-[var(--accent-ink)]"
        >
          {pos === order.length - 1 ? "Restart ↻" : "Next ›"}
        </button>
      </div>
    </>
  );
}
```

(Changes from the current file: the function signature now destructures `startIndex` and `onBackToList`; `useState(0)` for `pos` became `useState(startIndex)`; a new first row renders the "‹ Back to cards" link, calling `stopAuto()` first if Auto mode is running, then `onBackToList()`; the row directly below it lost its `pt-3` — now `pb-1` only — since the new row above it now carries the top padding. Nothing else changed: `runAuto`, `stopAuto`, every effect, and all other JSX are byte-identical to before.)

- [ ] **Step 2: Create the session wrapper**

Create `app/study/[topicId]/StudySession.tsx`:

```tsx
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
```

- [ ] **Step 3: Wire it into the study page**

In `app/study/[topicId]/page.tsx`, change the import and the render call:

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTopicWithCards } from "@/lib/db/queries";
import { StudySession } from "./StudySession";

export default async function StudyPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const { topicId } = await params;
  const topic = await getTopicWithCards(topicId);
  if (!topic) notFound();

  return (
    <div className="flex flex-1 flex-col bg-[var(--bg)]">
      <header className="flex items-center justify-between bg-[var(--btn-secondary-bg)] px-5 py-4 text-[var(--btn-secondary-ink)] shadow-md">
        <div>
          <div className="text-[17px] font-bold">{topic.name}</div>
          <div className="mt-0.5 text-xs opacity-80">Flashcards · A1–A2</div>
        </div>
        <Link href="/" className="rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold">
          Topics
        </Link>
      </header>
      {topic.cards.length === 0 ? (
        <p className="flex-1 p-6 text-center text-sm text-[var(--ink-muted)]">
          This topic has no cards yet.
        </p>
      ) : (
        <StudySession cards={topic.cards} />
      )}
    </div>
  );
}
```

(Only the import line and the final render call change — `FlashcardStudy` → `StudySession`. The header and empty-state branch are untouched.)

- [ ] **Step 4: Verify**

Run: `npm run lint` — expect no new errors/warnings.
Run: `npm run build` — expect success, no type errors (this is the first point where `FlashcardStudy`'s new required props are actually exercised by a caller — a mismatch here would be a build failure, not just a lint warning).

With `npm run dev` running:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/study/sproochen
```
Expected: `200`.

```bash
curl -s http://localhost:3000/study/sproochen | grep -o "Fro · Question" | head -1
```
Expected: one match (confirms the list view's featured-card eyebrow renders server-side without crashing — the list is the default view now, not full-screen mode).

- [ ] **Step 5: Commit**

```bash
git add "app/study/[topicId]/StudySession.tsx" "app/study/[topicId]/FlashcardStudy.tsx" "app/study/[topicId]/page.tsx"
git commit -m "feat: browse cards in a list before starting full-screen study mode"
```

---

### Task 3: Full verification pass

**Files:** none (verification only)

**Interfaces:** none — re-exercises Tasks 1-2 together.

- [ ] **Step 1: Full lint + build**

Run: `npm run lint` — expect 0 errors (same 4 pre-existing unrelated warnings in `lib/actions/*`).
Run: `npm run build` — expect success, all routes generated.

- [ ] **Step 2: Structural checklist (code reading, since there's no browser tool)**

Confirm each item by reading the final files:
- [ ] `page.tsx` renders `StudySession`, not `FlashcardStudy` directly, when `topic.cards.length > 0`.
- [ ] `StudySession` renders `CardList` when `selectedIndex` is `null`, `FlashcardStudy` otherwise — no third state, no way to render both at once.
- [ ] `FlashcardStudy`'s `pos` state seeds from `startIndex`, not a hardcoded `0`.
- [ ] The "‹ Back to cards" button calls `stopAuto()` before `onBackToList()` when `autoMode` is truthy, matching the same pattern every other interaction point in this file already uses (`next`, `prev`, `setMode`, the flip handler, the space-key handler).
- [ ] `CardList`'s featured first card and compact rows both call `onSelect` with the correct index (`0` for the first, `i + 1` for `rest[i]`).
- [ ] No hardcoded colors introduced anywhere in `CardList.tsx` or the `FlashcardStudy.tsx` diff — only tokens from the existing Charcoal Lime set.

If any box can't be checked, fix it before proceeding — do not check it off speculatively.

- [ ] **Step 3: Live walkthrough checklist for the project owner**

Since there's no browser tool in this environment, hand off this list rather than attempting it:
1. Open a topic from the home page — confirm the list appears first (not full-screen mode), with the first card visibly larger than the rest.
2. Scroll the list, tap a card partway down — confirm full-screen mode opens showing that exact card's question (not card 1).
3. From full-screen mode, tap "‹ Back to cards" — confirm it returns to the list (not the home page), and that any running Auto mode/audio stopped.
4. From the list, tap the featured first card — confirm full-screen mode opens at card 1.
5. From full-screen mode, tap the existing "Topics" link — confirm it still goes straight to the home page (unaffected by this change).
6. Start Auto L or Auto L+R from a card reached via the list (not card 1) — confirm it plays forward from that card and stops at the last card, same as before.

- [ ] **Step 4: Final commit (only if Step 2 required fixes)**

If everything already passed with no changes needed, there's nothing to commit for this task. Otherwise:

```bash
git add -A
git commit -m "fix: address card list spec-coverage findings"
```
