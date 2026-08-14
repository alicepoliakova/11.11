# ElevenLabs Text-to-Speech — Design

Date: 2026-08-14
Status: Approved

## Context

The study screen (`app/study/[topicId]/FlashcardStudy.tsx`) currently only
shows text: Luxembourgish + Russian question, flip to Luxembourgish + Russian
answer. There's no audio, so there's no way to hear correct Luxembourgish
pronunciation while studying.

Goal: integrate ElevenLabs' `eleven_v3` text-to-speech model to read the
Luxembourgish text aloud, with:
- A speaker on/off toggle controlling whether audio plays at all.
- Autoplay of the visible card face's Luxembourgish audio during normal
  (In order / Shuffle) study.
- A hands-free "Auto mode" that reads through an entire topic unattended, in
  two variants: Luxembourgish only, or Luxembourgish + Russian translation.

The user already has an ElevenLabs API key and has picked a voice:
`1SM7GgM6IMuvQlz2BwM3`.

Known caveat: Luxembourgish isn't a commonly-listed ElevenLabs language.
`eleven_v3` may still produce reasonable output (it's phonetically close to
German), but pronunciation quality is unverified until tested against real
cards. Russian audio (used only in Auto L+R mode) uses the same model/voice
and is natively well-supported.

## Architecture

```
lib/elevenlabs.ts                     server-only TTS client (calls ElevenLabs REST API)
app/api/tts/[cardId]/[field]/route.ts route handler: serve cached audio or generate+cache it
lib/db/schema.ts                      + 4 nullable audio blob columns on `cards`
lib/actions/cards.ts                  updateCard clears cached audio columns on save
app/study/[topicId]/FlashcardStudy.tsx + speaker toggle, autoplay, Auto L / Auto L+R
```

No new persistent services are introduced — cached audio lives in the
existing Turso/SQLite database alongside the card text, consistent with how
the rest of the app already stores its data. Estimated size: ~150 cards ×
up to 4 clips (question-lu, question-ru, answer-lu, answer-ru) × ~50–150KB
each ≈ tens of MB total, well within Turso's free-tier limits.

### Caching flow

Audio is generated lazily and cached forever (until the underlying text
changes):

1. Client requests `GET /api/tts/{cardId}/{field}`.
2. Route loads the card, checks the matching blob column
   (`questionLuAudio` / `questionRuAudio` / `answerLuAudio` / `answerRuAudio`).
3. If populated, stream it back immediately as `audio/mpeg`.
4. If null, call ElevenLabs to synthesize the corresponding text, save the
   resulting bytes to that column, then stream it back.

This makes caching transparent to the client: it always requests the same
URL and gets a fast cached response after the first play. There is no
separate warm-up/pregeneration step — the first person to study a card pays
the one-time generation latency.

### `field` → column/text/language mapping

| `field` value  | DB column          | Source text     | Language |
|----------------|---------------------|------------------|----------|
| `question-lu`  | `questionLuAudio`   | `cards.questionLu` | Luxembourgish |
| `question-ru`  | `questionRuAudio`   | `cards.questionRu` | Russian |
| `answer-lu`    | `answerLuAudio`     | `cards.answerLu`   | Luxembourgish |
| `answer-ru`    | `answerRuAudio`     | `cards.answerRu`   | Russian |

An invalid `field` value returns 404.

### Cache invalidation

`updateCard` (in `lib/actions/cards.ts`) nulls out all four audio columns
whenever a card is saved, regardless of which text fields actually changed.
Card edits are rare (done manually via `/admin`), so the cost of an
unconditional regeneration — one extra ElevenLabs call per field, on next
play — is negligible and avoids the complexity of diffing which specific
text changed.

### ElevenLabs client (`lib/elevenlabs.ts`)

A single function, e.g. `synthesizeSpeech(text: string): Promise<Buffer>`,
that calls `POST https://api.elevenlabs.io/v1/text-to-speech/{voiceId}` with
`model_id: eleven_v3` and the given text, using `ELEVENLABS_API_KEY` for
auth, and returns the raw MP3 bytes. Throws on non-2xx responses so the
route handler can surface an error.

### Env vars

Added to `.env.local.example` and required in production (Vercel):

```
ELEVENLABS_API_KEY=        # secret, server-only
ELEVENLABS_VOICE_ID=1SM7GgM6IMuvQlz2BwM3
ELEVENLABS_MODEL_ID=eleven_v3
```

`ELEVENLABS_VOICE_ID` and `ELEVENLABS_MODEL_ID` have code-level defaults
matching the values above, so they're only strictly required in env if the
user wants to override them later.

## UI

### Speaker toggle

A speaker icon button in the study page header (next to the "Topics" link)
toggles a `soundOn` boolean. Persisted in `localStorage` so the choice
survives reloads; defaults to **on** the first time a study page is ever
opened on a device.

### Manual mode autoplay (In order / Shuffle)

Whenever the visible card face changes (new card, or flipped
question↔answer) and `soundOn` is true, `FlashcardStudy` plays that face's
Luxembourgish audio automatically via a hidden `<audio>` element:
`/api/tts/{cardId}/question-lu` or `/api/tts/{cardId}/answer-lu` depending on
`flipped`. Russian audio is never played in manual mode. Switching cards or
flipping mid-playback cancels any in-flight audio before starting the next
clip.

### Auto mode

Two buttons next to the existing In order / Shuffle toggle: **"▶ Auto L"**
and **"▶ Auto L+R"**. Auto mode runs through the topic in whichever order
(in-order or shuffled) is currently selected.

Starting either one turns `soundOn` on if it was off, then runs an
unattended sequence starting from the current card position:

**Auto L** — per card:
1. Show question (unflipped), play `question-lu` audio.
2. On audio end, wait 1s.
3. Flip to answer, play `answer-lu` audio.
4. On audio end, wait 1s.
5. Advance to the next card and repeat.

**Auto L+R** — per card:
1. Show question (unflipped), play `question-lu` audio, then immediately
   (no gap) play `question-ru` audio.
2. On the RU audio ending, wait 1s.
3. Flip to answer, play `answer-lu` audio, then immediately play
   `answer-ru` audio.
4. On the RU audio ending, wait 1s.
5. Advance to the next card and repeat.

Both variants stop automatically after the last card in the current order —
no wrap-around/looping.

While one variant is running, its button's label becomes **"■ Stop"** and
the other Auto button is disabled (only one Auto run can be active at a
time). Clicking Stop stops playback immediately. Any manual interaction
during Auto mode —
tapping/flipping the card, swiping, or pressing Back/Next — also stops Auto
mode immediately and returns control to normal manual browsing (the card
stays wherever the interruption left it).

Implementation note: the sequence is driven by a cancellable async
run-loop (a ref holding a "generation" counter or `AbortController`-style
flag checked between steps), not chained `setTimeout` callbacks closed over
stale state — this avoids race conditions when Stop is pressed mid-sequence.

### Error handling

If a TTS request fails (bad API key, ElevenLabs rate limit, network error),
the route handler returns a non-2xx response. The client:
- In manual mode: shows a small, non-blocking "Audio unavailable" note near
  the speaker icon; study continues normally without audio for that card.
- In Auto mode: stops the run and shows the same "Audio unavailable" note,
  rather than hanging indefinitely waiting for audio that will never play.

## Out of scope

- Pregenerating/warming the audio cache in bulk (e.g. a script to
  synthesize all cards up front) — first-play latency per card is accepted.
- Audio for topics other than via the existing four fields (e.g. no
  separate "read the whole card" combined clip).
- Offline/PWA audio caching beyond normal HTTP behavior.
- Non-Luxembourgish, non-Russian languages.
