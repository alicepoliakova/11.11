# Charcoal Lime Theme (Light/Dark, Whole App) — Design

Date: 2026-08-14
Status: Approved

## Context

Two rounds of visual exploration (see the published mockup artifact from this
conversation) landed on "Charcoal Lime": black secondary buttons, a single
fresh-lime accent used surgically, on a layered dark ground. The user wants
this built for real, as a genuine light/dark theme (Charcoal Lime as the
dark/night mode), switchable app-wide from a toggle on the home page header —
not just the study screen.

Today the app has **no theme system**: every page hardcodes one blue brand
(`#2E5A87` and four or five supporting hex values) directly in Tailwind
arbitrary-value classes, spread across ~9 files (home, study screen +
`FlashcardStudy.tsx`, and four admin files). This is a genuine rebrand —
the old blue goes away everywhere, replaced by black+lime in both a light
and a dark variant — not an "add a dark mode on top of the existing design"
patch.

## Design

### Token architecture

CSS custom properties in `app/globals.css`, replacing the current unused
Next.js boilerplate tokens (`--background`/`--foreground`). A light `:root`
block is the default; a `[data-theme="dark"]` block on `<html>` overrides
it. There is no `prefers-color-scheme` auto-detection — this is an explicit,
persisted user choice (like the existing Sound/Pause toggles), not ambient
OS-following.

**Tokens that differ between light and dark:**

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#f5f8f1` | `#14151a` |
| `--surface` (cards, inputs) | `#ffffff` | `#1c1e24` |
| `--ink` (headings, primary text) | `#14161a` | `#f3f5f0` |
| `--ink-muted` (secondary text) | `#6e7568` | `#8b9088` |
| `--line` (borders) | `#dde4d6` | `#262a30` |
| `--accent-text` (lime used as text — labels, links, "on" indicators) | `#3f8f34` | `#a6f26b` |
| `--danger` (delete/error) | `#dc2626` | `#ff6b6b` |

**Tokens that are the *same value* in both themes** — this is the
deliberate throughline that makes it read as one brand with two states,
not two different apps:

| Token | Value | Used for |
|---|---|---|
| `--accent-fill` | `#a6f26b` | Primary CTA button backgrounds (e.g. "Next") |
| `--accent-ink` | `#0b1a06` | Text/icon color sitting on top of `--accent-fill` |
| `--btn-secondary-bg` | `#101114` | Secondary/idle button backgrounds ("black buttons": Back, mode toggles, Auto L/L+R pills) |
| `--btn-secondary-ink` | `#f5f8f1` | Text on `--btn-secondary-bg` when idle |

**Why `--accent-fill` is one shared value but `--accent-text` needs two:**
a bright lime button fill reads clearly on both a white and a near-black
ground when paired with dark text — the same hex genuinely works both
places. Lime used directly as *text color on the page background* does
not: on dark grounds `#a6f26b` is легible, but that same brightness fails
contrast as text on a light ground, so `--accent-text` gets a deeper,
AA-compliant green in light mode. `--btn-secondary-bg` needs no such split
— near-black has plenty of contrast against both a light and a dark
ground, just at different visual prominence (bold on light, subtle on
dark), which is expected and fine.

### Where each token lands (Charcoal Lime button semantics, from the approved mockup)

- Page background → `--bg`. Cards, the flashcard itself, form inputs →
  `--surface`.
- Headings/primary text → `--ink`. Captions, RU gloss, helper text →
  `--ink-muted`. Borders/dividers → `--line`.
- The **one** primary action per screen (Next on the study card, Save/Log
  in on forms) → filled `--accent-fill` background, `--accent-ink` text.
- Secondary actions (Back, In order/Shuffle segmented control, Sound/Pause/
  Auto L/Auto L+R pills when idle) → filled `--btn-secondary-bg`,
  `--btn-secondary-ink` text; when a pill is "on," swap its text/border to
  `--accent-text` instead of filling it lime (keeps the accent rare,
  matching the mockup's "surgical" restraint).
- Delete/destructive actions in `/admin` → `--danger`, unchanged in spirit
  from today's red, just theme-aware.

### Per-page treatment

- **Home (`app/page.tsx`)**: header becomes a `--btn-secondary-bg` bar
  (black in light mode, near-charcoal in dark — same token, different
  perceived weight) carrying the "Sproochentest" wordmark in
  `--btn-secondary-ink`, with the theme toggle top-right. Topic list cards
  use `--surface`/`--ink`/`--ink-muted`/`--line`.
- **Study screen** (`app/study/[topicId]/page.tsx` + `FlashcardStudy.tsx`):
  header and card structure carry over from the current layout; colors
  swap to tokens per the button semantics above.
- **Admin** (`app/admin/page.tsx`, `app/admin/[topicId]/page.tsx`,
  `app/admin/login/page.tsx`, `NewTopicForm.tsx`, `CardRow.tsx`,
  `NewCardForm.tsx`, `ConfirmSubmitButton.tsx`): same token set; primary
  submit buttons get `--accent-fill`, delete stays `--danger`.

### Toggle

A two-option segmented control — "Light" / "Dark" text labels, matching
the existing In order/Shuffle and Sound/Pause pill language rather than
introducing an icon — in the home page header, top-right. New component
`app/ThemeToggle.tsx` ("use client").

**Persistence & hydration safety:** `localStorage` key
`flashcards-theme` (`"light" | "dark"`). Unlike the Sound toggle (which
accepts a brief post-hydration correction — fine for audio, since nothing
is visible), a full-page color theme needs to avoid a flash of the wrong
theme entirely. So: a small inline, blocking `<script>` in
`app/layout.tsx`'s `<head>`, running before React hydrates, reads
`localStorage` synchronously and sets `document.documentElement.dataset.theme`
immediately (wrapped in `try/catch`, since this runs outside React's
error boundaries and must be safe if `localStorage` is unavailable).
`ThemeToggle` then just toggles that same attribute and re-writes
`localStorage` on click — no React context needed across pages, since
every navigation re-runs the blocking script from the persisted value.

**Default for first-time visitors:** dark (Charcoal Lime) — it's the
direction that drove this whole redesign. Correctable later if it turns
out light should be the default.

## Out of scope

- Any `prefers-color-scheme` auto-detection — explicit toggle only.
- Redesigning layout/information architecture — this is a color/token
  retrofit onto the existing structure, not a re-layout (Bento Fresh's
  grid, for example, is not part of this).
- New pages or features beyond the toggle itself.
