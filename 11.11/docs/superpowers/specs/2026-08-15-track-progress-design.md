# Track Progress Design Spec

**Goal:** Let the user mark each flashcard as "know" (✓) or "don't know" (✕) while studying, persist that per-card, offer to immediately repeat just the ✕ cards at the end of a pass, and surface a "known / total" count per topic on the home page and the topic's card list.

**Reference:** Quizlet's "Track progress" toggle in its flashcard view — a persistent switch that, when on, replaces the Next button with ✕/✓ buttons flanking a position counter.

## Data model

Add one nullable column to `cards`:

```ts
knownStatus: text("known_status", { enum: ["known", "unknown"] }),
```

- `null` = never marked (default for all existing and new cards).
- `"known"` / `"unknown"` = the last mark the user made on that card, no history kept.
- No per-user scoping — this app has no login on the study side (card CRUD is already public per the card-list-edit-mode feature); progress is a single global value per card, same trust model as the rest of `/study/**`.

Requires one Drizzle migration (`npm run db:generate` after the schema change).

## Server actions

In `lib/actions/cards.ts`, add:

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

- No `requireAdminSession()` — consistent with `createCard`/`updateCard`/`deleteCard`/`reorderCards`, all already public.
- The `and(cards.id, cards.topicId)` guard matches the pattern already established for the other mutations (cross-topic safety on an unauthenticated action).
- Revalidates `/` too, since the home page will show per-topic known counts.

## Data reads

- `getTopicWithCards` (in `lib/db/queries.ts`) starts selecting `knownStatus` alongside the existing fields, so `StudyCard` gains `knownStatus: "known" | "unknown" | null`.
- `getTopicsWithCounts` gains a second aggregate alongside `cardCount`: a count of cards where `knownStatus = 'known'`, e.g. via a second `count()` with a `sql\`case when...\`` or a `filterWhere`-style conditional count. Returned as `TopicSummary.knownCount: number`.

## UI: the toggle and marking flow

All changes are inside `app/study/[topicId]/FlashcardStudy.tsx` — no new route, no new top-level component.

- New local state: `const [trackProgress, setTrackProgress] = useState(false);` — session-only (not persisted; resets to off every time you enter the flip-card view). Rendered as a labeled toggle switch in the existing control row that already holds the `In order / Shuffle` segmented control.
- **Toggle off (current behavior, unchanged):** bottom bar shows `‹ Back` / `Next ›` exactly as today.
- **Toggle on:** bottom bar shows three controls: `‹ Back` (unchanged — moves to the previous card, does not mark anything), `✕ Don't know`, `✓ Know`. Tapping ✕ or ✓ calls `markCardStatus(current.id, topicId, status)` and then advances exactly like `next()` does today (including the shuffle-reshuffle-on-wrap behavior already in `next()`).
- Marking is idempotent/overwriting: if the user goes `Back` to an already-marked card and taps ✕/✓ again, the new value simply replaces the old one via the same `markCardStatus` call — no separate undo control, no history.
- On reaching the end of the pass (the same wraparound point `next()` already detects when `!shuffled`... actually: end-of-pass is reaching the last card and marking it, when `trackProgress` is on), instead of silently wrapping to card 0, show a **summary screen** in place of the flip card:
  - "`X / N known`" (X = cards marked known during *this* pass — tracked client-side as the set of card IDs marked ✓ while `trackProgress` has been on, reset each time a fresh pass starts).
  - `Repeat mistakes` button — visible only if the mistakes set (cards marked ✕ during this pass) is non-empty. Starts a new pass whose card list is exactly that mistakes set (own shuffle/order irrelevant at that size), with the same ✕/✓/Back mechanics. Finishing *that* pass shows the same summary-screen pattern, so it can chain ("mistakes of mistakes") until either the set is empty or the user leaves.
  - `Done` button — returns to `CardList` (calls `onBackToList`), same as today's "Back to cards" link.
- This is purely client-side session bookkeeping (which IDs were marked ✕/✓ *this pass*) layered on top of the DB writes — the DB always reflects the latest mark regardless of pass structure.

## UI: stats display

- **Home page (`app/page.tsx`):** each topic row gains a small line under the card count, e.g. `12 / 30 known`, sourced from `TopicSummary.knownCount` / `cardCount`. Omitted (or shows nothing extra) when `cardCount === 0`.
- **Topic card list (`CardList.tsx`, browse mode header):** same "K / N known" shown next to the existing `Edit` button, sourced from the `cards` prop's `knownStatus` field (no extra query — already have the data client-side).

## Explicitly out of scope (v1)

- Resetting/clearing progress for a topic.
- Cross-session "resume where you left off" for the toggle itself (it's always off on entry).
- Any history of past marks, multi-mark analytics, or streaks.
- Per-user tracking (matches the rest of the app's single-user, public-by-URL model).

## Testing

Same constraints as the rest of this project: no automated test framework, no browser tool in the agent environment. Verification is `npm run lint`, `npm run build`, and `curl` against `npm run dev` for basic page-renders-without-crashing checks. Full click-through (toggle behavior, marking, repeat-mistakes chaining, stats accuracy) is a live walkthrough handed off to the project owner, same pattern as the card-list-edit-mode plan.
