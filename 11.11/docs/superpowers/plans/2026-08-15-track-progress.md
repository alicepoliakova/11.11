# Track Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Track progress" toggle to the flashcard study view (`/study/[topicId]`) that lets the user mark each card known (✓) / don't-know (✕), persists that per card, offers to immediately repeat the ✕ cards at the end of a pass, and shows a "known / total" count per topic on the home page and the topic's card list.

**Architecture:** One new nullable column (`cards.knownStatus`) plus one new public server action (`markCardStatus`) carry the persistence. All the interaction logic — the toggle, the ✕/✓ buttons, the end-of-pass summary, the "repeat mistakes" chaining — lives entirely inside the existing `FlashcardStudy` component; no new route or top-level component. Two read paths (`getTopicWithCards`, `getTopicsWithCounts`) gain the extra field/aggregate the stats badges need.

**Tech Stack:** Existing stack only (Server Actions, Drizzle, `@libsql/client`, Charcoal Lime CSS tokens) — no new dependencies.

## Global Constraints

- **`markCardStatus` is public, no login required** — same trust model as `createCard`/`updateCard`/`deleteCard`/`reorderCards` in `lib/actions/cards.ts` (all already unauthenticated per the card-list-edit-mode feature). Do not add a `requireAdminSession()` check.
- **Every mutation's `WHERE` clause must include `AND cards.topic_id = topicId`**, not just `cards.id = cardId` — the established cross-topic safety guard on this file's other public actions (see `reorderCards`, `updateCard`, `deleteCard`).
- **`knownStatus` has no history and no per-user scoping** — it's a single nullable enum column (`null | "known" | "unknown"`), last-write-wins, matching this app's single-implicit-user model.
- **The `trackProgress` toggle is session-only React state** — never persisted, never read from a prop or the DB. It always starts `false` when `FlashcardStudy` mounts.
- **React Rules of Hooks**: `FlashcardStudy` will gain a `summary`-screen early return (`if (summary) return (...)`), following the exact pattern already used by `CardList`'s `if (editMode) return (...)` — every hook must be called before that branch, never inside it.
- **No hardcoded colors** — reuse existing Charcoal Lime CSS custom properties (`var(--accent-fill)`, `var(--accent-ink)`, `var(--danger)`, `var(--btn-secondary-bg)`, `var(--btn-secondary-ink)`, `var(--line)`, `var(--ink-muted)`, `var(--accent-on-dark)`), the same tokens already used elsewhere in this file and in `EditableCardRow.tsx`/`NewCardRow.tsx`.
- This repo has no automated test framework and no browser tool in this environment. Verification is `npm run lint`, `npm run build`, and `curl` against a locally running `npm run dev`. Live click-through is deferred to the project owner (checklist at the end of this plan).

---

### Task 1: Schema + migration

**Files:**
- Modify: `lib/db/schema.ts`
- Create: `drizzle/0002_*.sql` (generated, not hand-written)
- Modify: `README.md`

**Interfaces:**
- Produces: `cards.knownStatus: "known" | "unknown" | null` column. Used by Task 2's queries/action and Task 3's UI.

- [ ] **Step 1: Add the column to the schema**

In `lib/db/schema.ts`, add one field to the `cards` table definition, right after `position`:

```ts
export const cards = sqliteTable("cards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  topicId: text("topic_id")
    .notNull()
    .references(() => topics.id, { onDelete: "cascade" }),
  questionLu: text("question_lu").notNull(),
  questionRu: text("question_ru").notNull(),
  answerLu: text("answer_lu").notNull(),
  answerRu: text("answer_ru").notNull(),
  questionLuAudio: blob("question_lu_audio", { mode: "buffer" }),
  questionRuAudio: blob("question_ru_audio", { mode: "buffer" }),
  answerLuAudio: blob("answer_lu_audio", { mode: "buffer" }),
  answerRuAudio: blob("answer_ru_audio", { mode: "buffer" }),
  position: integer("position").notNull(),
  createdAt: integer("created_at").notNull(),
  knownStatus: text("known_status", { enum: ["known", "unknown"] }),
});
```

(No `.notNull()` — omitted entirely means `null`, which is the "never marked" state.)

- [ ] **Step 2: Generate the migration**

Run:
```bash
npm run db:generate
```

Expected: a new file appears at `drizzle/0002_<generated-name>.sql` containing a single `ALTER TABLE `cards` ADD `known_status` text;` statement (matching the style of `drizzle/0001_equal_cobalt_man.sql`), and `drizzle/meta/` gains a corresponding new snapshot.

- [ ] **Step 3: Apply the migration to the local database**

Run:
```bash
npm run db:migrate
```

Expected: `Migrations applied.` printed, no errors. This updates `local.db` so Task 5's dev-server `curl` checks (which read `knownStatus` via `getTopicWithCards`) don't hit a missing-column error.

- [ ] **Step 4: Document the migration for existing deployments**

In `README.md`, add a new subsection after "## Text-to-speech (ElevenLabs)" and before "## Deploy on Vercel":

```markdown
## Progress tracking

While studying, "Track progress" lets you mark each card known (✓) or
don't-know (✕); the app remembers the last mark per card and shows a
known/total count per topic. Like the rest of `/study/**`, marking a card
requires no login — this is a personal app and that's a deliberate choice,
not an oversight.

**Existing deployments:** this feature adds a new migration
(`drizzle/0002_...`) for the `known_status` column. If you're deploying this
on top of an already-live database, run `npm run db:migrate` against the
production `DATABASE_URL`/`DATABASE_AUTH_TOKEN` (see the Database section
above) *before* deploying — otherwise the study page will fail to load,
since it selects the new column.
```

- [ ] **Step 5: Verify**

Run: `npm run lint` — expect no new errors/warnings.
Run: `npm run build` — expect success, no type errors.

- [ ] **Step 6: Commit**

```bash
git add lib/db/schema.ts drizzle/ README.md
git commit -m "feat: add knownStatus column for card progress tracking"
```

---

### Task 2: Server action + query updates

**Files:**
- Modify: `lib/actions/cards.ts`
- Modify: `lib/db/queries.ts`

**Interfaces:**
- Consumes: `cards.knownStatus` (Task 1).
- Produces: `markCardStatus(cardId: number, topicId: string, status: "known" | "unknown"): Promise<void>` — used by Task 3. `StudyCard` gains `knownStatus: "known" | "unknown" | null` — used by Task 3 and Task 4. `TopicSummary` gains `knownCount: number` — used by Task 4.

- [ ] **Step 1: Add `markCardStatus`**

In `lib/actions/cards.ts`, add this function after `reorderCards` (before `moveCard`):

```ts
export async function markCardStatus(
  cardId: number,
  topicId: string,
  status: "known" | "unknown"
): Promise<void> {
  await db
    .update(cards)
    .set({ knownStatus: status })
    .where(and(eq(cards.id, cardId), eq(cards.topicId, topicId)));

  revalidatePath(`/study/${topicId}`);
  revalidatePath("/");
}
```

(No `requireAdminSession()` — public per the Global Constraints. No `revalidatePath` for `/admin/${topicId}` since `/admin` doesn't display or use `knownStatus`.)

- [ ] **Step 2: Add `knownStatus` to `StudyCard` and `getTopicWithCards`**

In `lib/db/queries.ts`, update the `StudyCard` type and the `getTopicWithCards` select:

```ts
export type StudyCard = {
  id: number;
  questionLu: string;
  questionRu: string;
  answerLu: string;
  answerRu: string;
  knownStatus: "known" | "unknown" | null;
};

export async function getTopicWithCards(
  topicId: string
): Promise<{ id: string; name: string; cards: StudyCard[] } | null> {
  const [topic] = await db.select().from(topics).where(eq(topics.id, topicId));
  if (!topic) return null;

  const topicCards = await db
    .select({
      id: cards.id,
      questionLu: cards.questionLu,
      questionRu: cards.questionRu,
      answerLu: cards.answerLu,
      answerRu: cards.answerRu,
      knownStatus: cards.knownStatus,
    })
    .from(cards)
    .where(eq(cards.topicId, topicId))
    .orderBy(asc(cards.position));

  return { id: topic.id, name: topic.name, cards: topicCards };
}
```

- [ ] **Step 3: Add `knownCount` to `TopicSummary` and `getTopicsWithCounts`**

In `lib/db/queries.ts`, update the top import line and `getTopicsWithCounts`:

```ts
import { asc, count, eq, sql } from "drizzle-orm";
```

```ts
export type TopicSummary = {
  id: string;
  name: string;
  cardCount: number;
  knownCount: number;
};

export async function getTopicsWithCounts(): Promise<TopicSummary[]> {
  return db
    .select({
      id: topics.id,
      name: topics.name,
      cardCount: count(cards.id),
      knownCount: sql<number>`coalesce(sum(case when ${cards.knownStatus} = 'known' then 1 else 0 end), 0)`,
    })
    .from(topics)
    .leftJoin(cards, eq(cards.topicId, topics.id))
    .groupBy(topics.id)
    .orderBy(asc(topics.position));
}
```

(The `sql<number>` cast tells TypeScript the aggregate's shape; `coalesce(..., 0)` keeps a topic with zero cards or zero known cards at `0`, not `null`.)

- [ ] **Step 4: Verify**

Run: `npm run lint` — expect no new errors/warnings.
Run: `npm run build` — expect success, no type errors.

Server Actions can't be meaningfully invoked via plain `curl` (established in earlier work on this project). This task's verification is architectural: confirm by reading the final files that `markCardStatus` has the `and(...)` topic guard and no auth check, and that both query functions' return types include the new fields. Full functional confirmation happens in Task 3 and Task 5.

- [ ] **Step 5: Commit**

```bash
git add lib/actions/cards.ts lib/db/queries.ts
git commit -m "feat: add markCardStatus action and knownStatus/knownCount reads"
```

---

### Task 3: Wire progress tracking into FlashcardStudy

**Files:**
- Modify: `app/study/[topicId]/StudySession.tsx`
- Modify: `app/study/[topicId]/FlashcardStudy.tsx`

**Interfaces:**
- Consumes: `markCardStatus` (Task 2); `StudyCard.knownStatus` (Task 2).
- Produces: `FlashcardStudy` gains a required `topicId: string` prop. No new exports — everything else is internal state.

- [ ] **Step 1: Thread `topicId` into FlashcardStudy**

In `app/study/[topicId]/StudySession.tsx`, add `topicId` to the `<FlashcardStudy>` call (the component already receives `topicId` as its own prop from `page.tsx`, per the card-list-edit-mode feature):

```tsx
  return (
    <FlashcardStudy
      cards={cards}
      startIndex={selectedIndex}
      onBackToList={() => setSelectedIndex(null)}
      topicId={topicId}
    />
  );
```

(This is the only change to this file.)

- [ ] **Step 2: Add state, imports, and the topicId prop**

In `app/study/[topicId]/FlashcardStudy.tsx`, update the import block and the component signature:

```tsx
import { useEffect, useRef, useState, type TouchEvent } from "react";
import type { StudyCard } from "@/lib/db/queries";
import { markCardStatus } from "@/lib/actions/cards";
import { useSound, type AudioField } from "./useSound";
```

```tsx
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
```

Then add these state declarations right after the existing `pauseOn` state (before `touchStartX`):

```tsx
  const [trackProgress, setTrackProgress] = useState(false);
  const [passCards, setPassCards] = useState(cards);
  const [passKnown, setPassKnown] = useState<Set<number>>(new Set());
  const [passUnknown, setPassUnknown] = useState<Set<number>>(new Set());
  const [summary, setSummary] = useState(false);
```

- [ ] **Step 3: Switch the existing iteration logic from `cards` to `passCards`**

Still in `FlashcardStudy.tsx`, make these four targeted replacements (every other use of `cards` in the file — the prop type, the destructured parameter — stays as-is):

In the `order` initial state:
```tsx
  const [order, setOrder] = useState<number[]>(() => passCards.map((_, i) => i));
```

In `setMode`:
```tsx
  function setMode(rand: boolean) {
    if (autoMode) stopAuto();
    setShuffled(rand);
    const base = passCards.map((_, i) => i);
    setOrder(rand ? shuffle(base) : base);
    setPos(0);
    setFlipped(false);
  }
```

In `runAuto`, both occurrences:
```tsx
      while (position < order.length) {
        if (autoGenRef.current !== gen) return;
        setPos(position);
        setFlipped(false);
        const cardId = passCards[order[position]].id;
```

And the `current` line:
```tsx
  const current = passCards[order[pos]];
```

- [ ] **Step 4: Add the end-of-pass summary branch to `next()`**

Replace `next()`'s body so that reaching the end of the pass while tracking progress shows the summary instead of silently wrapping (this also covers the `ArrowRight` keyboard shortcut, which calls `next()` directly):

```tsx
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
```

- [ ] **Step 5: Add `toggleTrackProgress`, `markCurrent`, and `startRepeatMistakes`**

Add these three functions right after `next()`/`prev()` (before the `pauseOnRef` block):

```tsx
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
```

(`markCardStatus(...).catch(() => {})`: the write is fire-and-forget from the UI's perspective — client-side pass bookkeeping already reflects the mark immediately, and a transient network failure here has no optimistic state to roll back, unlike `CardList`'s drag-reorder.)

- [ ] **Step 6: Add the summary screen early return**

The full hook list in this file, in order, is: `useState` ×11 (`shuffled`, `order`, `pos`, `flipped`, `autoMode`, `pauseOn`, `trackProgress`, `passCards`, `passKnown`, `passUnknown`, `summary`), `useRef` ×2 (`touchStartX`, `autoGenRef`), `useSound()`, `useRef` (`pauseOnRef`), `useEffect` (mirrors `pauseOn`), `useEffect` (keydown), `useEffect` (unmount cleanup), `useRef` (`autoModeRef`), `useEffect` (mirrors `autoMode`), `useEffect` (auto-play sound on flip — this last one reads `current`, so `const current = passCards[order[pos]]` stays exactly where it is today, above this last `useEffect`). Add the branch **after that last `useEffect`**, right before the `onTouchStart`/`onTouchEnd` function declarations, since those two functions and everything below them belongs to the rendered view, not hook setup:

```tsx
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
```

This mirrors `CardList`'s `if (editMode) return (...)` pattern: a plain `if` with a `return` sitting after every hook call and after the `current`/derived-value computations, but before the component's main JSX `return`.

- [ ] **Step 7: Add the toggle button**

In the row that currently renders the `Sound: On/Off` and `Pause: On/Off` buttons (the `<div className="flex items-center gap-2">` inside the `px-4 pb-2` row), add a third button after the `Pause` button and before the `audioError` span:

```tsx
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
```

- [ ] **Step 8: Replace the Next button with ✕/✓ when tracking**

Replace the bottom button row (the `<div className="flex gap-3 px-4 ...">` containing `‹ Back` and `Next ›`) with:

```tsx
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
              ✕ Don't know
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
```

- [ ] **Step 9: Verify**

Run: `npm run lint` — expect no new errors/warnings.
Run: `npm run build` — expect success, no type errors (this is the first point a hooks-ordering mistake would surface as `react-hooks/rules-of-hooks`, not just a runtime issue).

With `npm run dev` running:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/study/sproochen
```
Expected: `200`.

```bash
curl -s http://localhost:3000/study/sproochen | grep -o "Track progress" | head -1
```
Expected: no match — `FlashcardStudy` only renders once a card is selected from `CardList`, and `CardList`'s initial browse view doesn't reach it server-side. This confirms the page still renders without crashing; the toggle itself is confirmed by the structural checklist in Task 5 and the live walkthrough.

- [ ] **Step 10: Commit**

```bash
git add "app/study/[topicId]/StudySession.tsx" "app/study/[topicId]/FlashcardStudy.tsx"
git commit -m "feat: add track-progress toggle, marking, and repeat-mistakes flow"
```

---

### Task 4: Stats display

**Files:**
- Modify: `app/study/[topicId]/CardList.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `StudyCard.knownStatus` (Task 2, already in `CardList`'s `cards` prop); `TopicSummary.knownCount` (Task 2, already in `getTopicsWithCounts`'s return value).

- [ ] **Step 1: Add the badge to CardList's browse-mode header**

In `app/study/[topicId]/CardList.tsx`, add a `knownCount` computation right after the `focusedCardId` line (which sits between the `editMode` early return and the empty-state check):

```tsx
  const focusedCardId = focusIndex !== null ? cards[focusIndex]?.id : undefined;
  const knownCount = cards.filter((c) => c.knownStatus === "known").length;
```

Then update both browse-mode header `<div>`s (the one in the empty-state branch and the one in the main return) from:

```tsx
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => setEditMode(true)}
            className="rounded-lg bg-[var(--btn-secondary-bg)] px-3 py-1.5 text-[13px] font-semibold text-[var(--btn-secondary-ink)]"
          >
            Edit
          </button>
        </div>
```

to:

```tsx
        <div className="mb-4 flex items-center justify-between">
          {cards.length > 0 ? (
            <span className="text-[13px] font-semibold text-[var(--ink-muted)]">
              {knownCount} / {cards.length} known
            </span>
          ) : (
            <span />
          )}
          <button
            onClick={() => setEditMode(true)}
            className="rounded-lg bg-[var(--btn-secondary-bg)] px-3 py-1.5 text-[13px] font-semibold text-[var(--btn-secondary-ink)]"
          >
            Edit
          </button>
        </div>
```

(Both occurrences get this same change — the empty-state one always hits the `cards.length > 0 ? ... : <span />` false branch since it only renders when there are zero cards, so it's visually identical to today, just structurally consistent.)

- [ ] **Step 2: Add the badge to the home page**

In `app/page.tsx`, update the topic row's card-count line:

```tsx
                <div>
                  <div className="text-[19px] font-bold text-[var(--ink)]">{topic.name}</div>
                  <div className="mt-0.5 text-[13px] text-[var(--ink-muted)]">
                    {topic.cardCount} cards
                    {topic.cardCount > 0 && ` · ${topic.knownCount} / ${topic.cardCount} known`}
                  </div>
                </div>
```

- [ ] **Step 3: Verify**

Run: `npm run lint` — expect no new errors/warnings.
Run: `npm run build` — expect success, no type errors.

With `npm run dev` running:
```bash
curl -s http://localhost:3000/ | grep -o "known" | head -1
```
Expected: one match if `local.db`'s seeded topic has at least one card (confirms the home page badge renders without crashing).

- [ ] **Step 4: Commit**

```bash
git add "app/study/[topicId]/CardList.tsx" app/page.tsx
git commit -m "feat: show known/total card counts on home page and card list"
```

---

### Task 5: Full verification pass

**Files:** none (verification only)

**Interfaces:** none — re-exercises Tasks 1-4 together.

- [ ] **Step 1: Full lint + build**

Run: `npm run lint` — expect 0 errors.
Run: `npm run build` — expect success, all routes generated.

- [ ] **Step 2: Structural checklist (code reading, since there's no browser tool)**

Confirm each item by reading the final files:
- [ ] `markCardStatus` in `lib/actions/cards.ts` has no `requireAdminSession()` check and its `WHERE` clause includes both `cards.id` and `cards.topicId` (`grep -n "markCardStatus" -A 10 lib/actions/cards.ts`).
- [ ] `FlashcardStudy.tsx`: every hook call (all `useState`, `useRef`, `useSound`, `useEffect` calls) sits before the `if (summary)` branch — list them out and confirm none are inside it or after it.
- [ ] `FlashcardStudy.tsx`: `next()` and `markCurrent()` both check `trackProgress`/end-of-pass before wrapping, and neither silently wraps to card 0 while `trackProgress` is true.
- [ ] `FlashcardStudy.tsx`: `passCards` (not the `cards` prop) is what `order`, `current`, `setMode`, and `runAuto` all index into.
- [ ] No hardcoded colors introduced anywhere in the four changed files — only existing Charcoal Lime tokens (`grep -n "#[0-9a-fA-F]\{3,6\}" "app/study/[topicId]/FlashcardStudy.tsx" "app/study/[topicId]/CardList.tsx" app/page.tsx` should return nothing new).
- [ ] `lib/db/queries.ts`: both `StudyCard` and `TopicSummary` include the new fields, and both query functions select/aggregate them.

If any box can't be checked, fix it before proceeding — do not check it off speculatively.

- [ ] **Step 3: Live walkthrough checklist for the project owner**

Since there's no browser tool in this environment, hand off this list rather than attempting it:
1. Open a topic, tap a card to enter study view, toggle "Track progress" on — confirm the bottom bar switches from `‹ Back / Next ›` to `‹ Back / ✕ Don't know / ✓ Know`.
2. Mark a few cards, mixing ✕ and ✓ — confirm each mark advances to the next card.
3. Reach the last card and mark it — confirm a summary screen appears ("`X / N known`") instead of wrapping back to card 1.
4. If any card was marked ✕, tap "Repeat mistakes" — confirm the pass restarts containing only those cards, and finishing it shows its own summary (with its own "Repeat mistakes" if any of *those* were marked ✕ again).
5. Tap "Done" on a summary screen — confirm it returns to the card list.
6. Go back to the card list and reload the page — confirm the "K / N known" badge next to "Edit" reflects the marks just made.
7. Return to the topics list (home page) — confirm that topic's row shows the same "K / N known" count.
8. Toggle "Track progress" off mid-session — confirm the bottom bar reverts to `‹ Back / Next ›` and normal browsing resumes from the current card.
9. With "Track progress" on, tap `‹ Back` to revisit an already-marked card, then mark it the opposite way — confirm the badge/count updates to reflect the new mark, not both.
10. **In a private/incognito window (no admin login)** — repeat steps 1-3, confirming marking works with no login prompt, consistent with the rest of `/study/**`.

- [ ] **Step 4: Final commit (only if Step 2 required fixes)**

If everything already passed with no changes needed, there's nothing to commit for this task. Otherwise:

```bash
git add -A
git commit -m "fix: address track progress spec-coverage findings"
```
