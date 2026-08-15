# Card List Edit Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-CRUD, drag-reorderable edit mode to the card list screen (`/study/[topicId]`), reachable via an "Edit" button — add/edit/delete/reorder cards without leaving the study flow or logging in.

**Architecture:** `CardList` gains an `editMode` toggle. Edit mode renders a new `EditableCardRow` per card (the same four-field inline-edit pattern `/admin` already uses, now wrapped in a `dnd-kit` sortable handle) plus a `NewCardRow` add-form at the bottom. A new `reorderCards` server action persists drag results in one batch. The existing `createCard`/`updateCard`/`deleteCard` actions lose their admin-session check so they work from this public screen too.

**Tech Stack:** `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` (new dependency — nothing like this exists in the project yet) for touch-friendly drag reordering. Everything else is the existing stack (Server Actions, Drizzle, Charcoal Lime CSS tokens).

## Global Constraints

- **Card-level mutations become fully public, no login required** — this was explicitly discussed with the project owner, including the specific implication that anyone with the live URL can add/edit/delete/reorder cards with no authentication at all, and confirmed as the intended behavior for this personal app. `createCard`, `updateCard`, `deleteCard` (in `lib/actions/cards.ts`) lose their `requireAdminSession()` check. The new `reorderCards` action never had one.
- **`moveCard` is untouched** — it isn't used by this feature (the new `reorderCards` replaces it for drag reordering) and `/admin`'s existing up/down arrows keep working exactly as today, since `/admin` itself stays behind its own login.
- **Topic-level actions (`lib/actions/topics.ts`: `createTopic`, `deleteTopic`) and the `/admin` login/session mechanism are completely out of scope** — not touched by this plan at all.
- **`reorderCards` must scope its updates to the given `topicId`** — it accepts a caller-supplied array of card IDs with no other validation (this is now a public, unauthenticated action), so each position update's `WHERE` clause must require `AND cards.topic_id = topicId`, not just `cards.id = cardId`. Without this, a malformed or malicious call could rewrite position numbers for cards in a *different* topic, since position values aren't globally unique — they're only meaningful within one topic.
- **React Rules of Hooks**: `CardList` renders either browse-mode or edit-mode JSX from one component, but every hook (`useState`, `useEffect`, `useRef`, `useSensors`) must be called unconditionally, before any `if (editMode) return (...)` branch — never inside a conditional branch. Getting this wrong produces a real runtime crash ("Rendered fewer hooks than expected") the moment the user toggles Edit/Done, not a type error.
- **Card selection must resolve against the stable `cards` prop, never the locally-reordered `orderedCards` state** — `CardList` keeps its own `orderedCards` state so a drag shows its result immediately, without waiting for the server round-trip. But `StudySession`/`FlashcardStudy` (unchanged by this plan) index into the original `cards` prop passed down from `page.tsx`. If browse mode resolved "which card was tapped" into a raw positional index computed from `orderedCards`, a reorder followed quickly by tapping a row could open the *wrong* card. Resolve by card identity (`cards.findIndex(c => c.id === tappedCard.id)`) instead of by position.
- **Scroll-restore focus matching must also work by card ID**, not raw index, for the same reason — the previously-selected card's position in `cards` (used to compute `focusIndex`) may differ from its current visual position in `orderedCards` after a reorder.
- This repo has no automated test framework and no browser tool in this environment. Verification is `npm run lint`, `npm run build`, and `curl` against a locally running `npm run dev`. Live click-through and drag-gesture confirmation is deferred to the project owner.

---

### Task 1: Server actions — public card CRUD + reorderCards

**Files:**
- Modify: `lib/actions/cards.ts`

**Interfaces:**
- Produces: `createCard`, `updateCard`, `deleteCard` keep their exact existing signatures, just without the auth gate. New: `reorderCards(topicId: string, orderedCardIds: number[]): Promise<void>`. Used by Task 3's `CardList`.

- [ ] **Step 1: Remove the admin-session checks from the three card mutations**

In `lib/actions/cards.ts`, remove these three lines (one per function — do not touch `moveCard`, which keeps its check):

In `createCard`: remove `if (!(await requireAdminSession())) return { error: "Unauthorized" };`
In `updateCard`: remove `if (!(await requireAdminSession())) return;`
In `deleteCard`: remove `if (!(await requireAdminSession())) return;`

The `requireAdminSession` import stays (still used by `moveCard`).

- [ ] **Step 2: Add the reorderCards action**

Add this new function to `lib/actions/cards.ts` (and update the import line to add `and` alongside the existing `eq, max`):

```ts
import { and, eq, max } from "drizzle-orm";
```

```ts
export async function reorderCards(topicId: string, orderedCardIds: number[]): Promise<void> {
  await Promise.all(
    orderedCardIds.map((cardId, index) =>
      db
        .update(cards)
        .set({ position: index })
        .where(and(eq(cards.id, cardId), eq(cards.topicId, topicId)))
    )
  );

  revalidatePath(`/admin/${topicId}`);
  revalidatePath(`/study/${topicId}`);
}
```

(No `requireAdminSession()` check — this action is public per the Global Constraints. The `and(...)` in the `WHERE` clause is the cross-topic safety guard — a card ID that doesn't belong to `topicId` simply won't match and won't be updated, rather than silently rewriting some other topic's position numbers.)

- [ ] **Step 3: Verify**

Run: `npm run lint` — expect no new errors/warnings.
Run: `npm run build` — expect success, no type errors.

Server Actions can't be meaningfully invoked via plain `curl` (confirmed in earlier work on this project — they need the Next.js client runtime's action-encoding, not a simple POST), so this task's verification is architectural: confirm by reading the final file that all three `requireAdminSession()` checks are gone from `createCard`/`updateCard`/`deleteCard`, `moveCard`'s check is still there, and `reorderCards` compiles with the `and(...)` guard in place. Full functional confirmation (does removing the check actually let an unauthenticated request succeed, does `reorderCards` actually reorder) happens in Task 4's live walkthrough, once Task 3 wires this up to real UI.

- [ ] **Step 4: Commit**

```bash
git add lib/actions/cards.ts
git commit -m "feat: make card CRUD public, add reorderCards action"
```

---

### Task 2: New card-editing components

**Files:**
- Create: `app/study/[topicId]/EditableCardRow.tsx`
- Create: `app/study/[topicId]/NewCardRow.tsx`
- Modify: `package.json` (via `npm install`, not hand-editing)

**Interfaces:**
- Consumes: `updateCard`, `deleteCard`, `createCard` from `lib/actions/cards.ts` (Task 1); `StudyCard` from `lib/db/queries.ts`.
- Produces: `EditableCardRow({ card: StudyCard, topicId: string })` — a draggable (via `dnd-kit`'s `useSortable`, keyed by `card.id`), inline-editable row with Save/Delete. `NewCardRow({ topicId: string })` — an always-visible add-card form. Neither is wired into anything yet — that happens in Task 3.

- [ ] **Step 1: Install dnd-kit**

Run:
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Expected: `package.json`'s `dependencies` gains all three packages; `npm run build` still succeeds afterward (verified in Step 4).

- [ ] **Step 2: Create the editable, draggable row**

Create `app/study/[topicId]/EditableCardRow.tsx`:

```tsx
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
```

(`{...attributes} {...listeners}` are spread ONLY on the small drag-handle button, not the whole row — this is the standard `dnd-kit` "dedicated handle" pattern, so dragging never conflicts with tapping into the text inputs or the Save/Delete buttons elsewhere in the same row. `type="button"` on the handle keeps it from submitting the form.)

- [ ] **Step 3: Create the add-card row**

Create `app/study/[topicId]/NewCardRow.tsx`:

```tsx
"use client";

import { useActionState, useRef } from "react";
import { createCard } from "@/lib/actions/cards";

export function NewCardRow({ topicId }: { topicId: string }) {
  const boundAction = createCard.bind(null, topicId);
  const [state, formAction, pending] = useActionState(boundAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData: FormData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="grid grid-cols-1 gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:grid-cols-2"
    >
      <input
        name="questionLu"
        placeholder="Question (LU)"
        className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm placeholder:text-[var(--ink-muted)]"
      />
      <input
        name="questionRu"
        placeholder="Question (RU)"
        className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm placeholder:text-[var(--ink-muted)]"
      />
      <input
        name="answerLu"
        placeholder="Answer (LU)"
        className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm placeholder:text-[var(--ink-muted)]"
      />
      <input
        name="answerRu"
        placeholder="Answer (RU)"
        className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm placeholder:text-[var(--ink-muted)]"
      />
      <div className="col-span-full flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[var(--accent-fill)] px-4 py-2 text-sm font-semibold text-[var(--accent-ink)] disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add card"}
        </button>
        {state.error && <p className="text-sm text-[var(--danger)]">{state.error}</p>}
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npm run lint` — expect no new errors/warnings.
Run: `npm run build` — expect success, no type errors. (Nothing imports either new component yet, so this only confirms both files are individually valid — full integration is verified in Task 3.)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json "app/study/[topicId]/EditableCardRow.tsx" "app/study/[topicId]/NewCardRow.tsx"
git commit -m "feat: add editable/draggable card row and add-card row components"
```

---

### Task 3: Wire edit mode into CardList

**Files:**
- Modify: `app/study/[topicId]/CardList.tsx`
- Modify: `app/study/[topicId]/StudySession.tsx`
- Modify: `app/study/[topicId]/page.tsx`

**Interfaces:**
- Consumes: `EditableCardRow`, `NewCardRow` (Task 2); `reorderCards` (Task 1); `DndContext`/`closestCenter`/`PointerSensor`/`useSensor`/`useSensors`/`DragEndEvent` from `@dnd-kit/core`; `SortableContext`/`verticalListSortingStrategy`/`arrayMove` from `@dnd-kit/sortable`.
- `CardList`'s props gain `topicId: string` (needed to bind the mutation actions). `StudySession` and `page.tsx` need one-line changes to thread `topicId` down to `CardList` (it's already available in both — `page.tsx` already has it from `params`, `StudySession` just needs to accept and forward it).

- [ ] **Step 1: Thread `topicId` down to StudySession**

In `app/study/[topicId]/StudySession.tsx`, add a `topicId` prop and forward it to `CardList`:

```tsx
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
```

(Only the `topicId` prop and its pass-through to `CardList` are new — everything else, including the explanatory comment, is the file's existing content unchanged.)

- [ ] **Step 2: Pass `topicId` from the page**

In `app/study/[topicId]/page.tsx`, change the `StudySession` render call to pass `topicId`:

```tsx
<StudySession cards={topic.cards} topicId={topicId} />
```

(This is the only change to this file — `topicId` is already destructured from `params` earlier in the function.)

- [ ] **Step 3: Add edit mode to CardList**

Replace the full contents of `app/study/[topicId]/CardList.tsx` with:

```tsx
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
    // Justified sync-from-prop pattern, same as useSound.ts's mount effect
    // and ThemeToggle's mount effect elsewhere in this project: `cards`
    // only changes when the server actually revalidates fresh data (a
    // rare, deliberate event here, not a hot path), so the one-extra-
    // render cost this rule warns about is negligible.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
```

**Read this carefully before transcribing — the hook-ordering and index-resolution properties are the load-bearing part of this task:**
- Every hook (`useState` ×2, `useRef`, `useSensors`, `useEffect` ×2) is called before the `if (editMode)` branch — never move a hook call after that branch, even if it looks like it "belongs" only to browse mode. This is what the Global Constraints section calls out as a real crash risk, not a style nitpick.
- `selectCard(card)` resolves the tapped card's index against the original `cards` prop, not `orderedCards` — this is what keeps card selection correct even if a drag reorder is still propagating to the server.
- `focusedCardId` is resolved once, by looking up `cards[focusIndex]?.id` — then matched against whichever card is being rendered in `orderedCards`'s current (possibly reordered) visual position, via `card.id === focusedCardId`.

- [ ] **Step 4: Verify**

Run: `npm run lint` — expect no new errors/warnings.
Run: `npm run build` — expect success, no type errors (this is the first point where a hooks-ordering mistake, if any, would surface as an ESLint `react-hooks/rules-of-hooks` error, not just a runtime issue).

With `npm run dev` running:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/study/sproochen
```
Expected: `200`.

```bash
curl -s http://localhost:3000/study/sproochen | grep -o "Edit" | head -1
```
Expected: one match (confirms the new "Edit" button renders server-side without crashing).

- [ ] **Step 5: Commit**

```bash
git add "app/study/[topicId]/CardList.tsx" "app/study/[topicId]/StudySession.tsx" "app/study/[topicId]/page.tsx"
git commit -m "feat: add edit mode (add/edit/delete/drag-reorder) to the card list"
```

---

### Task 4: Full verification pass

**Files:** none (verification only)

**Interfaces:** none — re-exercises Tasks 1-3 together.

- [ ] **Step 1: Full lint + build**

Run: `npm run lint` — expect 0 errors (same 4 pre-existing unrelated warnings in `lib/actions/*`).
Run: `npm run build` — expect success, all routes generated.

- [ ] **Step 2: Structural checklist (code reading, since there's no browser tool)**

Confirm each item by reading the final files:
- [ ] `createCard`/`updateCard`/`deleteCard` in `lib/actions/cards.ts` have no `requireAdminSession()` check; `moveCard` still does.
- [ ] `reorderCards`'s `WHERE` clause includes both `cards.id` and `cards.topicId` — confirm with `grep -n "reorderCards" -A 12 lib/actions/cards.ts` that the `and(...)` is present.
- [ ] `CardList.tsx`: every hook call sits before the `if (editMode)` branch — list them out and confirm none are inside either JSX branch.
- [ ] `CardList.tsx`: `selectCard` and the `focusedCardId` lookup both index into `cards` (the prop), not `orderedCards`.
- [ ] `EditableCardRow.tsx`: `{...attributes}` and `{...listeners}` are only on the drag-handle button, not on the row's outer `<div>` or on any `<input>`.
- [ ] No hardcoded colors introduced anywhere in the three new/changed component files — only existing Charcoal Lime tokens.

If any box can't be checked, fix it before proceeding — do not check it off speculatively.

- [ ] **Step 3: Live walkthrough checklist for the project owner**

Since there's no browser tool in this environment, hand off this list rather than attempting it:
1. Open a topic's card list, tap "Edit" — confirm every card becomes an editable 4-field row with a drag handle and Delete, and the featured-first-card styling disappears.
2. Edit a field on one card and tap Save — confirm it persists (reload the page, edit mode, check the value stuck).
3. Add a new card via the bottom form — confirm it appears in the list (both edit mode and after tapping Done, in browse mode).
4. Delete a card (confirm the browser `confirm()` dialog appears) — confirm it's gone from the list.
5. Drag a card to a new position — confirm the list visually reorders immediately, and after a reload, the new order persisted.
6. Tap "Done" — confirm it returns to browse mode with the featured-first-card treatment restored, reflecting any edits/reorders just made.
7. **In a private/incognito window (no admin login at all)**, repeat steps 1-5 — confirm every one of them works exactly the same, with no login prompt anywhere. This is the core confirmation of the "fully public" design decision.
8. Separately, confirm `/admin/[topicId]` still requires login as before, and its own up/down arrows and Save/Delete still work once logged in (confirms `moveCard` and the admin page's behavior are unaffected).

- [ ] **Step 4: Final commit (only if Step 2 required fixes)**

If everything already passed with no changes needed, there's nothing to commit for this task. Otherwise:

```bash
git add -A
git commit -m "fix: address edit mode spec-coverage findings"
```
