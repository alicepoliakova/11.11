# Auto Mode Pause On/Off Toggle — Design

Date: 2026-08-14
Status: Approved

## Context

Auto mode (Auto L / Auto L+R, added earlier) pauses 1s after the question
audio (before flipping) and 1s after the answer audio (before advancing to
the next card) — hardcoded via `sleep(1000)` in `runAuto`
(`app/study/[topicId]/FlashcardStudy.tsx`). The user wants a way to remove
those pauses entirely, so clips play back-to-back for uninterrupted
listening, with a toggle to switch between the two.

## Design

**State:** a new `pauseOn` boolean in `FlashcardStudy`, `useState(true)` —
defaults to the current 1s-pause behavior. Session-only (not persisted to
`localStorage`, unlike the sound toggle) since this is a listening-mode
choice rather than a standing preference.

**UI:** a "Pause: On" / "Pause: Off" toggle button, styled identically to
the existing Sound toggle, placed next to it in the toolbar's left group
(Sound + Pause together; Auto L / Auto L+R / Stop stay on the right).

**Behavior:** both `sleep(1000)` call sites in `runAuto` become
conditional on `pauseOn` — skipped entirely (not reduced to `sleep(0)`)
when off, so the next `play()` call starts the instant the previous one's
`ended` event fires. Nothing else about the sequence changes: same L vs
L+R ordering (LU immediately followed by RU with no gap either way),
same cancellation, same stop-on-interaction, same no-wrap-around.

**Live mid-run updates:** `runAuto` is a single long-lived async function,
so it can't just close over `pauseOn` at start — a toggle mid-run needs to
affect the *next* pause point, not just future `runAuto` calls. Mirrors the
existing `autoModeRef` pattern: a `pauseOnRef`, synced via a
no-dependency-array `useEffect` (not a render-time write, to avoid the
`react-hooks/refs` lint violation already worked around for `autoModeRef`).
`runAuto` reads `pauseOnRef.current` at each pause point instead of a
captured `pauseOn` value.

## Out of scope

- Persisting the pause preference across reloads.
- A configurable pause duration (still fixed at 1s when on).
- Any change to manual (non-Auto) mode.
