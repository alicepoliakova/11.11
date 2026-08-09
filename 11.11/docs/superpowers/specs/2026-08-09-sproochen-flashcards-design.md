# Sproochen Flashcards — Design

Date: 2026-08-09
Status: Approved

## Context

An existing static HTML file (`sproochen-cards.html`) implements a mobile-friendly
Luxembourgish/Russian flashcard study app: pick a topic, flip cards (LU question →
LU+RU answer), study in order or shuffled, swipe/keyboard navigation. Card data
(currently one topic, "Sproochen", 47 question/answer pairs) is hardcoded in a
`TOPICS` JS array in the file, so adding a topic means editing code.

Goal: rebuild this as a page (or pages) inside the existing `11.11/` Next.js app,
with cards stored in a real database instead of hardcoded JS, and a way to manage
topics/cards without touching code.

Note: the source HTML's Cyrillic/accented text is mojibake (UTF-8 mis-decoded as
Latin-1, e.g. `Ð°Ð½Ð³Ð»Ð¸Ð¹ÑÐºÐ¸` should read `английски`, `MÃ©int` should read `Méint`).
When porting the 47 existing cards into seed data, this must be corrected
(`Buffer.from(text, 'latin1').toString('utf8')` on each string fixes it).

## Architecture

Next.js 16 App Router (existing `11.11/` project), React Server Components +
Server Actions — no separate REST/API-route layer, since nothing but this app's
own pages consumes the data.

```
lib/db/schema.ts       Drizzle schema (topics, cards)
lib/db/index.ts        Drizzle client over @libsql/client (Turso)
lib/actions.ts         server actions: topic/card CRUD, admin login/logout
drizzle/                SQL migrations (drizzle-kit generated)
data/seed-sproochen.ts  the 47 existing cards, decoded, as plain data
scripts/seed.ts         one-time seed script (run via `npm run db:seed`)
middleware.ts           guards /admin/** routes
```

Routes:
- `/` — topic picker. Server Component; reads topics + card counts. Empty state
  ("No topics yet — add one in the admin panel") if none exist.
- `/study/[topicId]` — study screen. Server Component fetches the deck and
  passes it to a client component, `FlashcardStudy`, which owns all interactive
  state (position, shuffle order, flipped/unflipped).
- `/admin/login` — password form.
- `/admin` — list topics (name, card count), create topic, delete topic
  (cascades to its cards, with confirm).
- `/admin/[topicId]` — manage cards for one topic: editable rows (question LU/RU,
  answer LU/RU), add row, delete row, reorder via up/down (position field).

## Data model

```sql
topics (
  id          text primary key,   -- slug, e.g. "sproochen"
  name        text not null,
  position    integer not null,   -- home-screen display order
  created_at  integer not null
)

cards (
  id          integer primary key autoincrement,
  topic_id    text not null references topics(id) on delete cascade,
  question_lu text not null,
  question_ru text not null,
  answer_lu   text not null,
  answer_ru   text not null,
  position    integer not null,   -- "In order" study order
  created_at  integer not null
)
```

No "locked / coming soon" flag (present in the original hardcoded array) — since
topics are now created via `/admin` on demand, a topic simply doesn't exist until
added.

## Study UI

Faithful port of the original HTML's look and behavior: blue/white palette,
tap-to-flip 3D card (question LU + RU on front; answer LU + RU on back), In
order/Shuffle toggle, prev/next buttons, left/right swipe, arrow-key and
spacebar support on desktop. Rebuilt in Tailwind, with a small amount of custom
CSS for the 3D flip (`perspective`, `backface-visibility`) since Tailwind's
utility set doesn't cleanly cover those. Interaction logic (render/next/prev/
shuffle) is a direct port of the original file's functions into React state.

## Admin UI

Functional, minimal styling (not a design priority):
- `/admin`: topics table + "new topic" form + delete-with-confirm per topic.
- `/admin/[topicId]`: cards table, one row per card with 4 text inputs
  (question LU/RU, answer LU/RU), "add card" row, delete-with-confirm per card,
  up/down buttons to reorder (updates `position`).

## Auth

Single shared password, via env vars:
- `ADMIN_PASSWORD` — the password itself.
- `ADMIN_SECRET` — HMAC key used to sign the session cookie.

`/admin/login` submits to a server action that checks the password, and on
success sets an httpOnly cookie containing an HMAC-signed token (30-day
expiry). `middleware.ts` verifies that cookie on every `/admin/**` request and
redirects to `/admin/login` if missing or invalid. Study pages (`/`,
`/study/**`) remain fully public.

## Error handling

Server actions return `{ error?: string }` on failure (e.g. duplicate topic id,
empty required field); forms render the error inline rather than throwing.
Home screen shows an explicit empty state rather than an empty list when no
topics exist yet.

## Testing

No test runner exists in this project yet, and introducing one isn't warranted
for this scope. Verification is manual, run against `npm run dev`:
1. Log into `/admin`, create a topic, add a few cards.
2. Study the topic: flip, next/prev, toggle shuffle, swipe (mobile viewport),
   arrow keys/spacebar (desktop).
3. Edit a card's text in `/admin/[topicId]`, confirm it reflects in study.
4. Delete a card, delete a topic (with cascade), confirm both disappear.
5. Log out, confirm `/admin/**` redirects to `/admin/login`.
6. Run `npm run db:seed` against a fresh DB, confirm the Sproochen topic and
   all 47 cards appear correctly (Cyrillic/Luxembourgish text renders properly,
   not mojibake).

## Out of scope

- Multi-user accounts / per-user progress tracking (spaced repetition, "known"
  marking) — not present in the original app, not requested.
- Rich text/markdown/audio in cards.
- Drag-and-drop reordering (up/down buttons are sufficient).
