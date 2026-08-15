# Card List Edit Mode — Design

Date: 2026-08-15
Status: Approved

## Context

The card list screen (added previously) currently only browses: tap a card
to study it. The user wants full CRUD plus reordering reachable directly
from that screen — add a card, edit any field, delete a card, drag to
reorder — without needing to go to `/admin`.

**Scope decision, explicitly confirmed with the user:** card-level
mutations (create/update/delete/reorder) become **fully public — no admin
login required**, anywhere they're triggered from, including the existing
`/admin/[topicId]` screen (which uses the same underlying server actions).
This is a deliberate choice for a personal app, not an oversight — the user
was shown the alternative (edit UI always visible, but still gated by the
existing admin session) and chose the fully-public option regardless.
**Topic-level management is out of scope and stays exactly as it is today**
— `createTopic`/`deleteTopic` remain behind `requireAdminSession()`; this
change only touches card-level actions (`createCard`, `updateCard`,
`deleteCard`) plus the new `reorderCards`.

## Design

### Mode toggle

An "Edit" button, top-right of the card list (`CardList.tsx`), symmetrical
with where a "Done" label replaces it once active. Toggles a local
`editMode: boolean` state in `CardList`.

### Browse mode (unchanged)

Exactly as it is today: featured first card, compact question-only rows,
tap any row to study from there.

### Edit mode

- The featured-first-card treatment is dropped — every row renders
  identically, since editing needs consistent layout regardless of
  position.
- Each row is inline-editable with the same four fields
  `/admin/[topicId]/CardRow.tsx` already has: Question LU, Question RU,
  Answer LU, Answer RU, plus a Save button — reusing that proven layout
  rather than inventing a new one.
- Each row also gets, on the right: a delete icon (confirm before
  deleting, matching the existing admin pattern) and a drag handle.
- An "Add card" row at the bottom: the same four fields, empty, plus an Add
  button — matching `/admin/[topicId]/NewCardForm.tsx`.
- Rows are draggable to reorder, via `@dnd-kit` (`@dnd-kit/core` +
  `@dnd-kit/sortable` + `@dnd-kit/utilities`) — the current maintained
  standard for touch-friendly React sortable lists (the older
  `react-beautiful-dnd` is unmaintained). New dependency, first one added
  to this project.

### Reordering persistence

The existing `moveCard` action only swaps one position with its immediate
neighbor — not a good fit for an arbitrary drag that can move a card many
positions in one gesture. New server action:

```ts
reorderCards(topicId: string, orderedCardIds: number[]): Promise<void>
```

Recomputes every card's `position` from its index in `orderedCardIds` in
one batch, rather than walking there via repeated single-step moves. No
`requireAdminSession()` check, per the scope decision above.

### Auth changes

Remove the `requireAdminSession()` check (and its early return) from
`createCard`, `updateCard`, and `deleteCard` in `lib/actions/cards.ts`.
`moveCard` is untouched — it isn't used by this feature at all (the new
`reorderCards` action handles drag reordering), and `/admin`'s existing
up/down arrows keep working exactly as today since `/admin` itself stays
behind its own login. Leave `lib/actions/topics.ts` (`createTopic`,
`deleteTopic`) and the `/admin` login/session mechanism itself completely
untouched.

## Out of scope

- Any change to topic-level actions or the `/admin` login flow.
- Bulk/multi-select delete — one delete icon per row, one card at a time.
- Any visual redesign of browse mode — only edit mode is new.
- Undo for delete — a confirm dialog is the only safety net, matching the
  existing admin pattern.
