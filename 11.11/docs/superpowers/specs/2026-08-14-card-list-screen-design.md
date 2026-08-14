# Card List Screen — Design

Date: 2026-08-14
Status: Approved

## Context

Today, tapping a topic on the home page goes straight into full-screen study
mode (`FlashcardStudy`), always starting at card 1. The user wants a browse
step in between: tap a topic → see a scrollable list of that topic's cards →
tap any card to jump straight into full-screen study mode starting there.

## Design

### Flow

`/` (home) → tap a topic → `/study/[topicId]` now shows a **card list**
first, instead of going straight to full-screen mode. Tapping any card in
the list opens full-screen mode (the existing `FlashcardStudy` experience,
unchanged) positioned at that card. No new route/URL — this is a
client-side view toggle within the same page.

### Card list screen

- The first card renders larger/featured at the top of the scroll (not
  pinned — it scrolls away like any other item), showing its Luxembourgish
  question with card-face styling similar to the full-screen card's
  question side.
- Every other card is a compact row: Luxembourgish question text only, no
  Russian gloss, no answer preview.
- Tapping **any** row (including the featured first one) immediately opens
  full-screen mode starting at that card — one tap, no separate confirm
  step, no lingering "which one is selected" state to track once you're in
  the list.
- Empty-topic handling is unchanged: if a topic has zero cards, the
  existing "This topic has no cards yet" message shows instead of the list.

### Full-screen mode changes

- Gains an optional starting position: instead of always starting at index
  0, it starts at whichever card was tapped in the list.
- Gains a "‹ Back to cards" control that returns to the list view (not the
  browser back button, not the existing "Topics" link — a new, third
  navigation option). The existing header's "Topics" link (topic name +
  link back to `/`) is unchanged and still jumps straight home from either
  view.
- Everything else — Sound/Pause toggles, Auto L/Auto L+R, In order/Shuffle,
  flip/swipe/keyboard nav — is completely unchanged. Auto mode and manual
  navigation still work exactly as today, just starting from a different
  card index than 0.

### Architecture

```
app/study/[topicId]/page.tsx       Server Component — unchanged data fetch,
                                    now renders StudySession instead of
                                    FlashcardStudy directly
app/study/[topicId]/StudySession.tsx  NEW client component — owns
                                    `selectedIndex: number | null`. null →
                                    renders CardList; a number → renders
                                    FlashcardStudy with that starting index
                                    and a callback back to the list.
app/study/[topicId]/CardList.tsx   NEW client component — the scrollable
                                    list itself (featured first card +
                                    compact rows), calls a prop to report
                                    which index was tapped.
app/study/[topicId]/FlashcardStudy.tsx  Two additions only: an optional
                                    starting index and the "‹ Back to
                                    cards" control. All existing state/
                                    logic (sound, pause, auto mode, the
                                    hydration-race guard, the ref-sync
                                    pattern) is untouched.
```

All new UI uses the existing Charcoal Lime CSS tokens (`--bg`, `--surface`,
`--ink`, `--ink-muted`, `--line`, `--accent-fill`, `--accent-text`,
`--btn-secondary-bg`/`--btn-secondary-ink`) — no new colors introduced.

## Out of scope

- Any change to the header that already lives in `page.tsx` (topic name +
  "Topics" link) — stays exactly as-is in both views.
- Any change to what happens inside full-screen mode besides the starting
  index and the new back-to-list control.
- Persisting/remembering the list scroll position or last-viewed card
  across visits.
- Showing the Russian gloss or answer preview in the list.
