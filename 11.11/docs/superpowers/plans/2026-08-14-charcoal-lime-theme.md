# Charcoal Lime Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the app's one hardcoded blue brand with a real light/dark theme ("Charcoal Lime" as dark mode) across every page — home, study, and admin — with a toggle on the home page header, persisted, and applied with zero flash of the wrong theme.

**Architecture:** CSS custom properties in `app/globals.css` (light `:root` defaults, `[data-theme="dark"]` overrides) drive every color via Tailwind arbitrary-value classes (`bg-[var(--token)]`) in place of today's hardcoded hex. A blocking inline script in `app/layout.tsx`'s `<head>` sets `data-theme` on `<html>` from `localStorage` before hydration. A new `ThemeToggle` client component writes to both the attribute and `localStorage`.

**Tech Stack:** Tailwind v4 arbitrary-value classes reading CSS custom properties — no Tailwind config changes, no new dependencies, no server/DB involvement (pure front-end).

## Global Constraints

**Token values** (from the design spec, `docs/superpowers/specs/2026-08-14-charcoal-lime-theme-design.md`):

Differ between light and dark:

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#f5f8f1` | `#14151a` |
| `--surface` | `#ffffff` | `#1c1e24` |
| `--ink` | `#14161a` | `#f3f5f0` |
| `--ink-muted` | `#6e7568` | `#8b9088` |
| `--line` | `#dde4d6` | `#262a30` |
| `--accent-text` | `#3f8f34` | `#a6f26b` |
| `--danger` | `#dc2626` | `#ff6b6b` |

Identical in both themes (define once in `:root`, never redefined in the dark block):

| Token | Value |
|---|---|
| `--accent-fill` | `#a6f26b` |
| `--accent-ink` | `#0b1a06` |
| `--btn-secondary-bg` | `#101114` |
| `--btn-secondary-ink` | `#f5f8f1` |

**Button/color semantics — apply consistently everywhere:**
- Exactly **one** primary action per screen (the thing you're most likely to do next: study's "Next", login's "Log in", forms' submit) → `bg-[var(--accent-fill)] text-[var(--accent-ink)]`.
- Secondary/idle actions (Back, mode toggles, Auto L/Auto L+R, nav links styled as buttons) → `bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-ink)]`.
- A secondary pill's "on" state (Sound: On, Pause: On) → same black background, swap text (and border, where a border exists) to `var(--accent-text)` — never fill it lime. This is the "surgical" restraint the whole design is built on: don't dilute the one-primary-action rule.
- Plain text links (not styled as buttons/pills) → `text-[var(--accent-text)]`.
- Destructive actions (Delete) and error/failure text → `text-[var(--danger)]`.
- Card/panel surfaces → `bg-[var(--surface)]` with `border-[var(--line)]`. Page background → `bg-[var(--bg)]`. Headings/primary text → `text-[var(--ink)]`. Secondary/caption text → `text-[var(--ink-muted)]`.
- Text inputs get an explicit `bg-[var(--bg)]` (a visible "well" distinct from the `--surface` card they sit in) and `placeholder:text-[var(--ink-muted)]` (browser-default placeholder gray is illegible in dark mode).

**No `prefers-color-scheme` auto-detection** — explicit toggle only, default **dark** for first-time visitors (no `localStorage` value yet).

**Hydration/flash approach:** a blocking `<script>` in `<head>` sets `data-theme` before hydration, so the page's actual colors never flash wrong. The `ThemeToggle` button's own highlighted-label state may still show the default ("Dark" highlighted) for one render before a `useEffect` corrects it to match — this is the same class of harmless, already-precedented flash the Sound toggle has (label state, not page color), not something this plan needs to eliminate.

**This repo has no automated test framework and no browser tool in this environment** — every task is verified via `npm run lint`, `npm run build`, and (where practical) `curl` against a locally running `npm run dev` for structural/HTTP checks. Actual visual/theme-switching confirmation is deferred to the project owner, exactly as it was for the ElevenLabs TTS feature earlier in this project.

---

### Task 1: Token system + blocking theme script

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: all 13 CSS custom properties listed in Global Constraints above, available globally via `var(--token-name)` in any Tailwind arbitrary-value class. Produces the `data-theme` attribute contract on `<html>` (`"light"` | `"dark"`, defaults to `"dark"` when `localStorage["flashcards-theme"]` is unset or invalid). Used by every subsequent task.

- [ ] **Step 1: Replace the token block in globals.css**

Read `app/globals.css` first to confirm current content matches what's being replaced (it should be the default Next.js `--background`/`--foreground` boilerplate plus the existing `.flip-card`/`.flip-inner`/`.flip-flipped`/`.flip-face`/`.flip-back` rules).

Replace the file's content with:

```css
@import "tailwindcss";

:root {
  --bg: #f5f8f1;
  --surface: #ffffff;
  --ink: #14161a;
  --ink-muted: #6e7568;
  --line: #dde4d6;
  --accent-text: #3f8f34;
  --accent-fill: #a6f26b;
  --accent-ink: #0b1a06;
  --btn-secondary-bg: #101114;
  --btn-secondary-ink: #f5f8f1;
  --danger: #dc2626;
}

[data-theme="dark"] {
  --bg: #14151a;
  --surface: #1c1e24;
  --ink: #f3f5f0;
  --ink-muted: #8b9088;
  --line: #262a30;
  --accent-text: #a6f26b;
  --danger: #ff6b6b;
}

@theme inline {
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--bg);
  color: var(--ink);
  font-family: Arial, Helvetica, sans-serif;
}

.flip-card {
  position: relative;
  perspective: 1600px;
}
.flip-inner {
  position: absolute;
  inset: 0;
  transition: transform 0.5s cubic-bezier(0.4, 0.15, 0.2, 1);
  transform-style: preserve-3d;
}
.flip-flipped {
  transform: rotateY(180deg);
}
.flip-face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
.flip-back {
  transform: rotateY(180deg);
}
```

(`--accent-fill`, `--accent-ink`, `--btn-secondary-bg`, `--btn-secondary-ink` are deliberately absent from the `[data-theme="dark"]` block — they're identical in both themes, so `:root`'s values simply carry through uncontested. The old `--background`/`--foreground` tokens and their `@theme inline` mapping are removed — confirmed unused anywhere in the app via `grep -rn "bg-background\|text-foreground" app/`, which returns nothing.)

- [ ] **Step 2: Add the blocking theme script to the root layout**

Edit `app/layout.tsx`. Add a `THEME_SCRIPT` constant and a `<head>` element containing it, so it runs before hydration:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sproochentest",
  description: "Flashcards for language study",
};

const THEME_SCRIPT = `
try {
  var stored = localStorage.getItem("flashcards-theme");
  var theme = stored === "light" || stored === "dark" ? stored : "dark";
  document.documentElement.setAttribute("data-theme", theme);
} catch (e) {}
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npm run lint`
Expected: no new errors or warnings.

Run: `npm run build`
Expected: succeeds, no type errors.

Run: `npm run dev` (backgrounded), then:
```bash
curl -s http://localhost:3000/ | grep -o '<script>.*flashcards-theme.*</script>' | head -c 200
```
Expected: the theme script's content appears in the raw server-rendered HTML's `<head>` (confirms it's present before hydration, not injected client-side only).

- [ ] **Step 4: Commit**

```bash
git add app/globals.css app/layout.tsx
git commit -m "feat: add Charcoal Lime theme token system and blocking theme script"
```

---

### Task 2: ThemeToggle component + home page

**Files:**
- Create: `app/ThemeToggle.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: the `data-theme` attribute contract and CSS tokens from Task 1.
- Produces: `ThemeToggle` — a `"use client"` component with no props, self-contained (reads/writes `data-theme` on `<html>` and `localStorage["flashcards-theme"]` directly). Rendered once, in the home page header only (per the approved design — the switch lives on the home page; the theme it sets applies everywhere via the CSS tokens).

- [ ] **Step 1: Create the toggle component**

Create `app/ThemeToggle.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "flashcards-theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- same
    // justified SSR-sync pattern as useSound.ts's mount effect: correcting
    // React state to match the DOM attribute the blocking script already
    // set, before hydration renders anything visibly wrong.
    if (current === "light" || current === "dark") setTheme(current);
  }, []);

  function choose(next: "light" | "dark") {
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage unavailable — theme still applies for this page view
    }
  }

  // Two-option exclusive segmented control, same treatment as the study
  // screen's In order/Shuffle toggle (a lifted --surface chip for the
  // selected option) — NOT a lime fill. The Global Constraints reserve
  // --accent-fill for the one primary action per screen and cap secondary
  // pills' "on" state at a text/border swap; this toggle is a settings
  // selector, not an action, so it gets no lime at all, consistent with
  // In order/Shuffle rather than with Sound/Pause/Auto's pill treatment.
  return (
    <div className="flex rounded-[10px] bg-[var(--btn-secondary-bg)] p-[3px]">
      <button
        onClick={() => choose("light")}
        className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold ${
          theme === "light"
            ? "bg-[var(--surface)] text-[var(--ink)] shadow-sm"
            : "text-[var(--btn-secondary-ink)]"
        }`}
      >
        Light
      </button>
      <button
        onClick={() => choose("dark")}
        className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold ${
          theme === "dark"
            ? "bg-[var(--surface)] text-[var(--ink)] shadow-sm"
            : "text-[var(--btn-secondary-ink)]"
        }`}
      >
        Dark
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the home page and retheme the page**

Replace the full contents of `app/page.tsx` with:

```tsx
import Link from "next/link";
import { getTopicsWithCounts } from "@/lib/db/queries";
import { ThemeToggle } from "./ThemeToggle";

export default async function HomePage() {
  const topics = await getTopicsWithCounts();

  return (
    <div className="flex flex-1 flex-col bg-[var(--bg)]">
      <header className="flex items-center justify-between bg-[var(--btn-secondary-bg)] px-5 py-4 text-[var(--btn-secondary-ink)] shadow-md">
        <div>
          <div className="text-[17px] font-bold">Sproochentest</div>
          <div className="mt-0.5 text-xs opacity-80">Flashcards · A1–A2</div>
        </div>
        <ThemeToggle />
      </header>
      <main className="flex-1 overflow-y-auto px-4 py-5">
        <h2 className="mb-3 px-0.5 text-sm font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
          Choose a topic
        </h2>
        {topics.length === 0 ? (
          <p className="mt-8 text-center text-sm text-[var(--ink-muted)]">
            No topics yet.{" "}
            <Link href="/admin" className="font-semibold text-[var(--accent-text)] underline">
              Add one in the admin panel
            </Link>
            .
          </p>
        ) : (
          <div className="flex flex-col gap-3.5">
            {topics.map((topic) => (
              <Link
                key={topic.id}
                href={`/study/${topic.id}`}
                className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-[18px] py-[18px] shadow-sm transition-transform active:scale-[0.98]"
              >
                <div>
                  <div className="text-[19px] font-bold text-[var(--ink)]">{topic.name}</div>
                  <div className="mt-0.5 text-[13px] text-[var(--ink-muted)]">{topic.cardCount} cards</div>
                </div>
                <div className="text-[22px] text-[var(--accent-text)]">›</div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npm run lint` — expect no new errors/warnings.
Run: `npm run build` — expect success, no type errors.

With `npm run dev` running:
```bash
curl -s http://localhost:3000/ | grep -o 'data-theme\|Sproochentest\|Light\|Dark' | sort -u
```
Expected: the server-rendered HTML contains "Sproochentest" and the toggle's "Light"/"Dark" button labels (confirms the component rendered server-side without crashing).

- [ ] **Step 4: Commit**

```bash
git add app/ThemeToggle.tsx app/page.tsx
git commit -m "feat: add theme toggle and retheme home page"
```

---

### Task 3: Study screen

**Files:**
- Modify: `app/study/[topicId]/page.tsx`
- Modify: `app/study/[topicId]/FlashcardStudy.tsx`

**Interfaces:**
- Consumes: CSS tokens from Task 1. No prop/type changes to either component — this is a pure className retheme, `FlashcardStudy`'s `{ cards: StudyCard[] }` prop and all internal state/logic (sound, pause, auto mode) are unchanged.

- [ ] **Step 1: Retheme the study page shell**

In `app/study/[topicId]/page.tsx`, replace the returned JSX with:

```tsx
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
      <FlashcardStudy cards={topic.cards} />
    )}
  </div>
);
```

(Only the `bg-[#eef2f6]` → `bg-[var(--bg)]`, `bg-[#2E5A87]`/`text-white` → `bg-[var(--btn-secondary-bg)]`/`text-[var(--btn-secondary-ink)]`, and `text-[#6c7a89]` → `text-[var(--ink-muted)]` changed. The `bg-white/15` translucent "Topics" chip is left as-is — a deliberate translucency effect that reads fine against the black header in both themes, not a flat brand color.)

- [ ] **Step 2: Retheme FlashcardStudy.tsx**

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

export function FlashcardStudy({ cards }: { cards: StudyCard[] }) {
  const [shuffled, setShuffled] = useState(false);
  const [order, setOrder] = useState<number[]>(() => cards.map((_, i) => i));
  const [pos, setPos] = useState(0);
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
      <div className="flex items-center justify-between px-4 pb-1 pt-3">
        <div className="flex rounded-[10px] bg-[var(--btn-secondary-bg)] p-[3px]">
          <button
            onClick={() => setMode(false)}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold ${
              !shuffled
                ? "bg-[var(--surface)] text-[var(--ink)] shadow-sm"
                : "text-[var(--btn-secondary-ink)]"
            }`}
          >
            In order
          </button>
          <button
            onClick={() => setMode(true)}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold ${
              shuffled
                ? "bg-[var(--surface)] text-[var(--ink)] shadow-sm"
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
            className={`rounded-lg border px-3 py-1.5 text-[13px] font-semibold ${
              soundOn
                ? "border-[var(--accent-text)] bg-[var(--btn-secondary-bg)] text-[var(--accent-text)]"
                : "border-[var(--line)] bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-ink)]"
            }`}
          >
            {soundOn ? "Sound: On" : "Sound: Off"}
          </button>
          <button
            onClick={() => setPauseOn(!pauseOn)}
            className={`rounded-lg border px-3 py-1.5 text-[13px] font-semibold ${
              pauseOn
                ? "border-[var(--accent-text)] bg-[var(--btn-secondary-bg)] text-[var(--accent-text)]"
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
              className="rounded-lg bg-[var(--accent-fill)] px-3 py-1.5 text-[13px] font-semibold text-[var(--accent-ink)]"
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
          className="flex-1 rounded-[14px] bg-[var(--btn-secondary-bg)] py-4 text-base font-bold text-[var(--btn-secondary-ink)] disabled:opacity-40"
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

(All logic — `runAuto`, `stopAuto`, effects, the `hydrated`/`autoModeRef` guards — is untouched; only `className` values changed. Note two explicit design calls made here, consistent with Global Constraints: the "Stop" button uses `--accent-fill` (it's the one actionable thing on screen while Auto is running, same role as "Next"); the answer-side eyebrow uses `--ink-muted` rather than a second accent color, so only the question-side eyebrow carries the lime highlight.)

- [ ] **Step 3: Verify**

Run: `npm run lint` — expect no new errors/warnings.
Run: `npm run build` — expect success, no type errors.

With `npm run dev` running:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/study/sproochen
```
Expected: `200`.

```bash
curl -s http://localhost:3000/study/sproochen | grep -c "var(--"
```
Expected: a large positive number (confirms token-based classes are present in the server-rendered output).

- [ ] **Step 4: Commit**

```bash
git add "app/study/[topicId]/page.tsx" "app/study/[topicId]/FlashcardStudy.tsx"
git commit -m "feat: retheme study screen with Charcoal Lime tokens"
```

---

### Task 4: Admin — topics list + login

**Files:**
- Modify: `app/admin/page.tsx`
- Modify: `app/admin/login/page.tsx`
- Modify: `app/admin/NewTopicForm.tsx`
- Modify: `app/admin/ConfirmSubmitButton.tsx`

**Interfaces:** Consumes CSS tokens from Task 1. No prop/type changes to any of these four components.

- [ ] **Step 1: Retheme admin/page.tsx**

Replace the returned JSX in `app/admin/page.tsx` with:

```tsx
return (
  <div className="mx-auto flex max-w-2xl flex-1 flex-col bg-[var(--bg)] p-6">
    <div className="mb-6 flex items-center justify-between">
      <h1 className="text-xl font-bold text-[var(--ink)]">Admin · Topics</h1>
      <form action={logout}>
        <button type="submit" className="text-sm font-semibold text-[var(--ink-muted)] underline">
          Log out
        </button>
      </form>
    </div>

    <NewTopicForm />

    <div className="flex flex-col gap-2">
      {topics.map((topic) => (
        <div
          key={topic.id}
          className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3"
        >
          <div>
            <div className="font-semibold text-[var(--ink)]">{topic.name}</div>
            <div className="text-xs text-[var(--ink-muted)]">{topic.cardCount} cards</div>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/admin/${topic.id}`} className="text-sm font-semibold text-[var(--accent-text)] underline">
              Manage cards
            </Link>
            <form action={deleteTopic.bind(null, topic.id)}>
              <ConfirmSubmitButton
                label="Delete"
                confirmMessage={`Delete topic "${topic.name}" and all its cards?`}
              />
            </form>
          </div>
        </div>
      ))}
      {topics.length === 0 && (
        <p className="text-sm text-[var(--ink-muted)]">No topics yet — add one above.</p>
      )}
    </div>
  </div>
);
```

(Only `text-[#213f5e]` → `text-[var(--ink)]`, `text-[#6c7a89]` → `text-[var(--ink-muted)]`, `border-[#dbe3ec] bg-white` → `border-[var(--line)] bg-[var(--surface)]`, `text-[#2E5A87]` → `text-[var(--accent-text)]`, plus the added `bg-[var(--bg)]` on the outer container, which had no explicit background before. Imports/logic unchanged.)

- [ ] **Step 2: Retheme admin/login/page.tsx**

Replace the returned JSX in `app/admin/login/page.tsx` with:

```tsx
return (
  <div className="flex flex-1 items-center justify-center bg-[var(--bg)] p-6">
    <form
      action={formAction}
      className="w-full max-w-sm rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-8 shadow-sm"
    >
      <h1 className="mb-1 text-lg font-bold text-[var(--ink)]">Admin login</h1>
      <p className="mb-6 text-sm text-[var(--ink-muted)]">Sproochentest admin</p>
      <input
        type="password"
        name="password"
        placeholder="Password"
        required
        className="mb-3 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm outline-none placeholder:text-[var(--ink-muted)] focus:border-[var(--accent-text)]"
      />
      {state.error && <p className="mb-3 text-sm text-[var(--danger)]">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[var(--accent-fill)] px-3 py-2 text-sm font-semibold text-[var(--accent-ink)] disabled:opacity-60"
      >
        {pending ? "Checking…" : "Log in"}
      </button>
    </form>
  </div>
);
```

- [ ] **Step 3: Retheme NewTopicForm.tsx**

Replace the returned JSX in `app/admin/NewTopicForm.tsx` with:

```tsx
return (
  <form
    action={formAction}
    className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4"
  >
    <div className="flex-1">
      <label className="mb-1 block text-xs font-semibold uppercase text-[var(--ink-muted)]">
        New topic name
      </label>
      <input
        name="name"
        required
        placeholder="e.g. Wunnen"
        className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm outline-none placeholder:text-[var(--ink-muted)] focus:border-[var(--accent-text)]"
      />
    </div>
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-[var(--accent-fill)] px-4 py-2 text-sm font-semibold text-[var(--accent-ink)] disabled:opacity-60"
    >
      {pending ? "Adding…" : "Add topic"}
    </button>
    {state.error && <p className="w-full text-sm text-[var(--danger)]">{state.error}</p>}
  </form>
);
```

- [ ] **Step 4: Retheme ConfirmSubmitButton.tsx**

Replace the returned JSX in `app/admin/ConfirmSubmitButton.tsx` with:

```tsx
return (
  <button
    type="submit"
    onClick={(e) => {
      if (!confirm(confirmMessage)) e.preventDefault();
    }}
    className="rounded-lg px-3 py-1.5 text-sm font-semibold text-[var(--danger)] hover:bg-[var(--danger)]/10"
  >
    {label}
  </button>
);
```

- [ ] **Step 5: Verify**

Run: `npm run lint` — expect no new errors/warnings.
Run: `npm run build` — expect success, no type errors.

With `npm run dev` running and logged into `/admin` (per your `ADMIN_PASSWORD` in `.env.local`):
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/admin/login
```
Expected: `200`.

- [ ] **Step 6: Commit**

```bash
git add app/admin/page.tsx app/admin/login/page.tsx app/admin/NewTopicForm.tsx app/admin/ConfirmSubmitButton.tsx
git commit -m "feat: retheme admin topics list and login with Charcoal Lime tokens"
```

---

### Task 5: Admin — card management

**Files:**
- Modify: `app/admin/[topicId]/page.tsx`
- Modify: `app/admin/[topicId]/CardRow.tsx`
- Modify: `app/admin/[topicId]/NewCardForm.tsx`

**Interfaces:** Consumes CSS tokens from Task 1. No prop/type changes.

- [ ] **Step 1: Retheme admin/[topicId]/page.tsx**

Replace the returned JSX in `app/admin/[topicId]/page.tsx` with:

```tsx
return (
  <div className="mx-auto flex max-w-2xl flex-1 flex-col bg-[var(--bg)] p-6">
    <div className="mb-6 flex items-center justify-between">
      <div>
        <Link href="/admin" className="text-sm font-semibold text-[var(--ink-muted)] underline">
          ‹ All topics
        </Link>
        <h1 className="mt-1 text-xl font-bold text-[var(--ink)]">{topicName}</h1>
      </div>
      <Link href={`/study/${topicId}`} className="text-sm font-semibold text-[var(--accent-text)] underline">
        Preview study view
      </Link>
    </div>

    <NewCardForm topicId={topicId} />

    <div className="flex flex-col gap-3">
      {cards.map((card, index) => (
        <CardRow
          key={card.id}
          card={card}
          topicId={topicId}
          isFirst={index === 0}
          isLast={index === cards.length - 1}
        />
      ))}
      {cards.length === 0 && <p className="text-sm text-[var(--ink-muted)]">No cards yet — add one above.</p>}
    </div>
  </div>
);
```

- [ ] **Step 2: Retheme CardRow.tsx**

Replace the returned JSX in `app/admin/[topicId]/CardRow.tsx` with:

```tsx
return (
  <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
    <form
      action={updateCard.bind(null, card.id, topicId)}
      className="grid grid-cols-1 gap-2 sm:grid-cols-2"
    >
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
      <div className="col-span-full flex items-center justify-between pt-1">
        <div className="flex gap-1">
          <button
            type="submit"
            formAction={moveCard.bind(null, card.id, topicId, "up")}
            disabled={isFirst}
            className="rounded-lg px-2 py-1 text-sm text-[var(--accent-text)] disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="submit"
            formAction={moveCard.bind(null, card.id, topicId, "down")}
            disabled={isLast}
            className="rounded-lg px-2 py-1 text-sm text-[var(--accent-text)] disabled:opacity-30"
          >
            ↓
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-lg bg-[var(--accent-fill)] px-3 py-1.5 text-sm font-semibold text-[var(--accent-ink)]"
          >
            Save
          </button>
          <button
            type="submit"
            formAction={deleteCard.bind(null, card.id, topicId)}
            onClick={(e) => {
              if (!confirm("Delete this card?")) e.preventDefault();
            }}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-[var(--danger)]"
          >
            Delete
          </button>
        </div>
      </div>
    </form>
  </div>
);
```

- [ ] **Step 3: Retheme NewCardForm.tsx**

Replace the returned JSX in `app/admin/[topicId]/NewCardForm.tsx` with:

```tsx
return (
  <form
    ref={formRef}
    action={async (formData: FormData) => {
      await formAction(formData);
      formRef.current?.reset();
    }}
    className="mb-6 grid grid-cols-1 gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:grid-cols-2"
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
```

- [ ] **Step 4: Verify**

Run: `npm run lint` — expect no new errors/warnings.
Run: `npm run build` — expect success, no type errors.

With `npm run dev` running:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/admin/sproochen
```
Expected: `200` if logged in (a redirect to `/admin/login` is also fine/expected if the curl session has no auth cookie — either way confirms the route doesn't 500).

- [ ] **Step 5: Commit**

```bash
git add "app/admin/[topicId]/page.tsx" "app/admin/[topicId]/CardRow.tsx" "app/admin/[topicId]/NewCardForm.tsx"
git commit -m "feat: retheme admin card management with Charcoal Lime tokens"
```

---

### Task 6: Full verification pass

**Files:** none (verification only)

**Interfaces:** none — re-exercises the whole app end to end.

- [ ] **Step 1: Full lint + build**

Run: `npm run lint` — expect 0 errors (pre-existing 4 `_formData` warnings in `lib/actions/*` are unrelated and expected to remain).
Run: `npm run build` — expect success, all routes generated.

- [ ] **Step 2: Grep for any remaining hardcoded brand hex**

```bash
grep -rn "#2E5A87\|#213f5e\|#dde5ee\|#dbe3ec\|#eef2f6\|#6c7a89\|#c8702d\|#a9b4c0\|#1a1a1a\|text-red-600\|bg-red-50" app/ --include="*.tsx"
```
Expected: no matches (every occurrence of the old blue-brand hex values and the ad-hoc Tailwind reds has been replaced with a token across all files touched in Tasks 2-5). If anything remains, it was missed and must be fixed before this task is complete.

- [ ] **Step 3: Spec coverage checklist**

Confirm each item against `docs/superpowers/specs/2026-08-14-charcoal-lime-theme-design.md`:
- [ ] Token system exists with the exact light/dark values specified — Task 1.
- [ ] `--accent-fill`, `--accent-ink`, `--btn-secondary-bg`, `--btn-secondary-ink` are defined once, not duplicated in the dark block — Task 1.
- [ ] Blocking script sets `data-theme` before hydration, defaults to `"dark"` — Task 1.
- [ ] Toggle exists on the home page header only, persists to `localStorage` — Task 2.
- [ ] Every page (home, study, admin ×4) uses tokens, no page left on the old blue brand — Tasks 2-5, confirmed by Step 2's grep above.
- [ ] Exactly one primary lime action per screen; secondary actions black; "on" pill states are lime text on black, not lime fill — Task 3 (Sound/Pause/Auto pills), Tasks 4-5 (form submit buttons as the one primary action per form).

If any box can't be checked, fix it before proceeding — do not check it off speculatively.

- [ ] **Step 4: Final commit (only if Step 2/3 required fixes)**

If everything already passed with no changes needed, there's nothing to commit for this task. Otherwise:

```bash
git add -A
git commit -m "fix: address theme spec-coverage findings"
```
