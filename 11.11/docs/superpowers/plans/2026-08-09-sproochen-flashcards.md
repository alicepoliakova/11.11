# Sproochen Flashcards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `~/Downloads/sproochen-cards.html` (a static flashcard study app) as pages inside the existing `11.11/` Next.js app, backed by a real database (topics + cards tables) instead of a hardcoded JS array, with an admin UI to manage topics/cards.

**Architecture:** Next.js 16 App Router, React Server Components + Server Actions (no separate API route layer). Data lives in SQLite accessed via `@libsql/client` + Drizzle ORM — a local file (`file:./local.db`) for development, Turso (hosted libSQL) for the Vercel deployment. A single shared-password session (HMAC-signed cookie, checked in `middleware.ts`) gates `/admin/**`; study pages stay public.

**Tech Stack:** Next.js 16, React 19.2, TypeScript (strict), Tailwind CSS v4, Drizzle ORM, `@libsql/client`, `drizzle-kit`, `tsx` (for running one-off DB scripts).

Full design context: `docs/superpowers/specs/2026-08-09-sproochen-flashcards-design.md`.

## Global Constraints

- All work happens inside `11.11/` (run every command from that directory unless stated otherwise).
- No new test framework — the approved spec explicitly rejects adding one for this scope. Every task instead ends with a concrete, runnable manual/CLI verification step.
- Local dev uses a local SQLite file via libSQL (`DATABASE_URL=file:./local.db`); production points at Turso via env vars. Never hardcode Turso credentials in source — env vars only, and `.env.local` stays out of git (already covered by the existing `.env*` line in `.gitignore`).
- All DB reads/writes happen server-side only (Server Components + Server Actions) — no client-side `fetch`, no API routes.
- `/admin/**` must stay behind the password-gated session enforced by `middleware.ts`. `/` and `/study/**` stay public.
- Styling is Tailwind utility classes, matching the original HTML's palette (`--blue:#2E5A87`, `--blue-deep:#213f5e`, `--ink:#1a1a1a`, `--grey:#6c7a89`, `--line:#dbe3ec`, `--bg:#eef2f6`, `--accent:#c8702d`), except the 3D card-flip mechanics, which need a few plain CSS rules in `app/globals.css` (Tailwind has no `preserve-3d`/`backface-visibility` utilities).
- TypeScript strict mode is on (existing `tsconfig.json`) — all new code must type-check (`npx tsc --noEmit`).

---

### Task 1: Install DB dependencies & environment scaffolding

**Files:**
- Modify: `11.11/package.json` (dependencies)
- Create: `11.11/.env.local.example`
- Create: `11.11/.env.local` (gitignored — not committed)
- Create: `11.11/drizzle.config.ts`

**Interfaces:**
- Produces: env vars `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `ADMIN_PASSWORD`, `ADMIN_SECRET`, consumed by every later task that touches the DB or auth.

- [ ] **Step 1: Install runtime and dev dependencies**

```bash
cd 11.11
npm install drizzle-orm @libsql/client
npm install -D drizzle-kit tsx
```

- [ ] **Step 2: Create the example env file (committed, documents required vars)**

Create `11.11/.env.local.example`:

```
# Local dev default — a SQLite file in the project root. Leave as-is for local dev.
DATABASE_URL=file:./local.db
# Only needed when DATABASE_URL points at Turso (libsql://...).
DATABASE_AUTH_TOKEN=

# Shared password for /admin. Pick your own value.
ADMIN_PASSWORD=changeme
# Random key used to sign admin session cookies. Generate with: openssl rand -hex 32
ADMIN_SECRET=
```

- [ ] **Step 3: Create your real local env file**

Create `11.11/.env.local` (this file is gitignored via the existing `.env*` rule):

```
DATABASE_URL=file:./local.db
DATABASE_AUTH_TOKEN=
ADMIN_PASSWORD=changeme
ADMIN_SECRET=<paste output of: openssl rand -hex 32>
```

Run `openssl rand -hex 32` in your terminal and paste the result as `ADMIN_SECRET`. Pick any password you like for `ADMIN_PASSWORD` (you can change it later — it's not stored anywhere but this file).

- [ ] **Step 4: Create the Drizzle Kit config**

Create `11.11/drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  driver: "turso",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "file:./local.db",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  },
});
```

- [ ] **Step 5: Verify**

Run: `npx drizzle-kit --version`
Expected: prints a version number (no errors about missing config).

- [ ] **Step 6: Commit**

```bash
git add 11.11/package.json 11.11/package-lock.json 11.11/.env.local.example 11.11/drizzle.config.ts
git commit -m "chore: add drizzle/libsql dependencies and env scaffolding"
```

---

### Task 2: Drizzle schema & database client

**Files:**
- Create: `11.11/lib/db/schema.ts`
- Create: `11.11/lib/db/index.ts`

**Interfaces:**
- Consumes: `DATABASE_URL`, `DATABASE_AUTH_TOKEN` env vars (Task 1).
- Produces: `topics`, `cards` tables and `Topic`, `NewTopic`, `Card`, `NewCard` types from `lib/db/schema.ts`; `db` (a configured Drizzle instance) from `lib/db/index.ts`. Both are imported by every later task that touches the database.

- [ ] **Step 1: Write the schema**

Create `11.11/lib/db/schema.ts`:

```ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const topics = sqliteTable("topics", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  position: integer("position").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const cards = sqliteTable("cards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  topicId: text("topic_id")
    .notNull()
    .references(() => topics.id, { onDelete: "cascade" }),
  questionLu: text("question_lu").notNull(),
  questionRu: text("question_ru").notNull(),
  answerLu: text("answer_lu").notNull(),
  answerRu: text("answer_ru").notNull(),
  position: integer("position").notNull(),
  createdAt: integer("created_at").notNull(),
});

export type Topic = typeof topics.$inferSelect;
export type NewTopic = typeof topics.$inferInsert;
export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
```

- [ ] **Step 2: Write the database client**

Create `11.11/lib/db/index.ts`:

```ts
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

const client = createClient({
  url: process.env.DATABASE_URL ?? "file:./local.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

// SQLite/libSQL does not enforce foreign keys (our `onDelete: "cascade"`)
// unless this pragma is set on the connection.
await client.execute("PRAGMA foreign_keys = ON;");

export const db = drizzle(client, { schema });
```

- [ ] **Step 3: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add 11.11/lib/db/schema.ts 11.11/lib/db/index.ts
git commit -m "feat: add topics/cards Drizzle schema and db client"
```

---

### Task 3: Generate & run the initial migration

**Files:**
- Modify: `11.11/package.json` (scripts)
- Create: `11.11/scripts/migrate.ts`
- Create: `11.11/drizzle/*.sql` (generated, not hand-written)

**Interfaces:**
- Consumes: `topics`, `cards` schema (Task 2).
- Produces: `local.db` SQLite file with `topics`/`cards` tables; `npm run db:migrate` script reused by Task 11's deployment step (against Turso).

- [ ] **Step 1: Add `db:generate` and `db:migrate` scripts**

In `11.11/package.json`, add to `"scripts"`:

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "tsx scripts/migrate.ts"
```

- [ ] **Step 2: Write the migration runner**

Create `11.11/scripts/migrate.ts`:

```ts
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.DATABASE_URL ?? "file:./local.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

const db = drizzle(client);

await migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migrations applied.");
client.close();
```

- [ ] **Step 3: Generate the migration SQL**

Run: `npm run db:generate`
Expected: creates a `11.11/drizzle/0000_*.sql` file containing `CREATE TABLE topics ...` and `CREATE TABLE cards ...` with a foreign key + `ON DELETE CASCADE`. Open the generated file and confirm both tables and all columns from Task 2's schema are present.

- [ ] **Step 4: Run the migration against the local SQLite file**

Run: `node --env-file=.env.local node_modules/.bin/tsx scripts/migrate.ts`
Expected: prints `Migrations applied.` and creates `11.11/local.db`.

- [ ] **Step 5: Verify the tables exist**

Run: `sqlite3 local.db ".tables"`
Expected: output includes `topics`, `cards`, and `__drizzle_migrations`.

- [ ] **Step 6: Commit**

```bash
git add 11.11/package.json 11.11/scripts/migrate.ts 11.11/drizzle
git commit -m "feat: add and run initial topics/cards migration"
```

---

### Task 4: Extract legacy seed data from the original HTML

**Files:**
- Create: `11.11/scripts/extract-seed.mjs`
- Create: `11.11/data/seed-sproochen.ts` (generated by the script, then committed)

**Interfaces:**
- Consumes: `~/Downloads/sproochen-cards.html` (source file, confirmed clean UTF-8; contains one `const TOPICS = [...]` array).
- Produces: `seedTopics: SeedTopic[]` exported from `data/seed-sproochen.ts`, where `SeedTopic = { id: string; name: string; cards: SeedCard[] }` and `SeedCard = [questionLu: string, questionRu: string, answerLu: string, answerRu: string]`. Consumed by Task 5's seed script.

- [ ] **Step 1: Add the `db:extract-seed` script**

In `11.11/package.json`, add to `"scripts"`:

```json
"db:extract-seed": "node scripts/extract-seed.mjs"
```

- [ ] **Step 2: Write the extraction script**

Create `11.11/scripts/extract-seed.mjs`:

```js
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const SOURCE =
  process.argv[2] ?? path.join(os.homedir(), "Downloads", "sproochen-cards.html");

const html = fs.readFileSync(SOURCE, "utf8");

const match = html.match(/const TOPICS = (\[[\s\S]*?\n\]);/);
if (!match) {
  throw new Error(`Could not find "const TOPICS = [...]" in ${SOURCE}`);
}

// The matched text is a plain JS array/object literal (no imports, no
// function calls) copied out of a file we trust — safe to evaluate directly.
const topics = new Function(`"use strict"; return (${match[1]});`)();

const readyTopics = topics
  .filter((t) => t.ready)
  .map((t) => ({ id: t.id, name: t.name, cards: t.cards }));

const output = `// Generated by scripts/extract-seed.mjs from ${path.basename(SOURCE)} — do not hand-edit.
export type SeedCard = [questionLu: string, questionRu: string, answerLu: string, answerRu: string];
export type SeedTopic = { id: string; name: string; cards: SeedCard[] };

export const seedTopics: SeedTopic[] = ${JSON.stringify(readyTopics, null, 2)};
`;

const outPath = path.join(import.meta.dirname, "..", "data", "seed-sproochen.ts");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, output);

const cardCount = readyTopics.reduce((n, t) => n + t.cards.length, 0);
console.log(
  `Wrote ${cardCount} card(s) across ${readyTopics.length} topic(s) to data/seed-sproochen.ts`
);
```

- [ ] **Step 3: Run it**

Run: `npm run db:extract-seed`
Expected: prints `Wrote 44 card(s) across 1 topic(s) to data/seed-sproochen.ts` (44 is the count as of this file's current content — if the source HTML has since changed, a different number is fine as long as it's non-zero).

- [ ] **Step 4: Spot-check the output**

Run: `npx tsc --noEmit` (confirms `data/seed-sproochen.ts` is valid TypeScript)
Open `11.11/data/seed-sproochen.ts` and confirm the first card matches the source HTML's first card (`"Wat fir Sprooche schwätzt Dir?"` / `"На каких языках Вы говорите?"` / ...), with correct, non-garbled Cyrillic and Luxembourgish accented characters.

- [ ] **Step 5: Commit**

```bash
git add 11.11/package.json 11.11/scripts/extract-seed.mjs 11.11/data/seed-sproochen.ts
git commit -m "feat: extract legacy Sproochen cards into seed data"
```

---

### Task 5: Seed the database

**Files:**
- Modify: `11.11/package.json` (scripts)
- Create: `11.11/scripts/seed.ts`

**Interfaces:**
- Consumes: `db`, `topics`, `cards` (Task 2); `seedTopics` (Task 4).
- Produces: seeded rows in `local.db`, used to manually verify Tasks 7–10's UI.

- [ ] **Step 1: Add the `db:seed` script**

In `11.11/package.json`, add to `"scripts"`:

```json
"db:seed": "tsx scripts/seed.ts"
```

- [ ] **Step 2: Write the seed script**

Create `11.11/scripts/seed.ts`:

```ts
import { db } from "../lib/db";
import { topics, cards } from "../lib/db/schema";
import { seedTopics } from "../data/seed-sproochen";

for (const [topicIndex, topic] of seedTopics.entries()) {
  await db
    .insert(topics)
    .values({
      id: topic.id,
      name: topic.name,
      position: topicIndex,
      createdAt: Date.now(),
    })
    .onConflictDoNothing();

  for (const [cardIndex, [questionLu, questionRu, answerLu, answerRu]] of topic.cards.entries()) {
    await db.insert(cards).values({
      topicId: topic.id,
      questionLu,
      questionRu,
      answerLu,
      answerRu,
      position: cardIndex,
      createdAt: Date.now(),
    });
  }
}

const cardCount = seedTopics.reduce((n, t) => n + t.cards.length, 0);
console.log(`Seeded ${seedTopics.length} topic(s), ${cardCount} card(s).`);
```

- [ ] **Step 3: Run it**

Run: `node --env-file=.env.local node_modules/.bin/tsx scripts/seed.ts`
Expected: prints `Seeded 1 topic(s), 44 card(s).` (or the actual count from Task 4).

- [ ] **Step 4: Verify against the database directly**

Run: `sqlite3 local.db "select id, name from topics; select count(*) from cards;"`
Expected: one row `sproochen|Sproochen`, and the card count matches Task 4's output.

- [ ] **Step 5: Commit**

```bash
git add 11.11/package.json 11.11/scripts/seed.ts
git commit -m "feat: add database seed script"
```

---

### Task 6: Admin session auth, login/logout, and route protection

**Files:**
- Create: `11.11/lib/auth.ts`
- Create: `11.11/lib/actions/auth.ts`
- Create: `11.11/app/admin/login/page.tsx`
- Create: `11.11/app/admin/page.tsx` (minimal placeholder — replaced in Task 9)
- Create: `11.11/middleware.ts`

**Interfaces:**
- Consumes: `ADMIN_PASSWORD`, `ADMIN_SECRET` env vars (Task 1).
- Produces: `SESSION_COOKIE_NAME`, `createSessionToken(secret, expiresAt): Promise<string>`, `verifySessionToken(secret, token): Promise<boolean>` from `lib/auth.ts` (used by `middleware.ts` and `lib/actions/auth.ts`); `login`, `logout` server actions from `lib/actions/auth.ts` (used by Task 9's admin page).

- [ ] **Step 1: Write the session token helpers**

Create `11.11/lib/auth.ts`:

```ts
export const SESSION_COOKIE_NAME = "admin_session";
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

const encoder = new TextEncoder();

async function getKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSessionToken(secret: string, expiresAt: number): Promise<string> {
  const key = await getKey(secret);
  const payload = String(expiresAt);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `${payload}.${toHex(signature)}`;
}

export async function verifySessionToken(
  secret: string,
  token: string | undefined
): Promise<boolean> {
  if (!token) return false;
  const [payload, signatureHex] = token.split(".");
  if (!payload || !signatureHex) return false;

  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;

  const key = await getKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toHex(signature) === signatureHex;
}
```

- [ ] **Step 2: Write the login/logout server actions**

Create `11.11/lib/actions/auth.ts`:

```ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_DURATION_MS } from "@/lib/auth";

export async function login(
  _prevState: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  const password = String(formData.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SECRET;

  if (!expected || !secret) {
    return { error: "Server is not configured: missing ADMIN_PASSWORD/ADMIN_SECRET." };
  }
  if (password !== expected) {
    return { error: "Wrong password." };
  }

  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const token = await createSessionToken(secret, expiresAt);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });

  redirect("/admin");
}

export async function logout(_formData: FormData): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/admin/login");
}
```

- [ ] **Step 3: Write the login page**

Create `11.11/app/admin/login/page.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { login } from "@/lib/actions/auth";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, {});

  return (
    <div className="flex flex-1 items-center justify-center bg-[#eef2f6] p-6">
      <form
        action={formAction}
        className="w-full max-w-sm rounded-2xl border border-[#dbe3ec] bg-white p-8 shadow-sm"
      >
        <h1 className="mb-1 text-lg font-bold text-[#213f5e]">Admin login</h1>
        <p className="mb-6 text-sm text-[#6c7a89]">Sproochentest admin</p>
        <input
          type="password"
          name="password"
          placeholder="Password"
          required
          className="mb-3 w-full rounded-lg border border-[#dbe3ec] px-3 py-2 text-sm outline-none focus:border-[#2E5A87]"
        />
        {state.error && <p className="mb-3 text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-[#2E5A87] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Checking…" : "Log in"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Write a minimal admin placeholder page**

Create `11.11/app/admin/page.tsx` (replaced with the full topics UI in Task 9):

```tsx
import { logout } from "@/lib/actions/auth";

export default function AdminPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <p className="text-sm text-[#6c7a89]">Logged in.</p>
      <form action={logout}>
        <button type="submit" className="text-sm font-semibold text-[#2E5A87] underline">
          Log out
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Write the middleware**

Create `11.11/middleware.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin/login") {
    return NextResponse.next();
  }

  const secret = process.env.ADMIN_SECRET;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const valid = secret ? await verifySessionToken(secret, token) : false;

  if (!valid) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
```

- [ ] **Step 6: Verify manually**

Run: `npm run dev`, then in a browser:
1. Visit `http://localhost:3000/admin` — expect an immediate redirect to `/admin/login`.
2. Submit a wrong password — expect the "Wrong password." message, still on `/admin/login`.
3. Submit the correct password (from `.env.local`'s `ADMIN_PASSWORD`) — expect a redirect to `/admin` showing "Logged in." and a "Log out" link.
4. Reload `/admin` — expect it to stay on `/admin` (no redirect back to login), confirming the session cookie persisted.
5. Click "Log out" — expect a redirect to `/admin/login`, and visiting `/admin` again redirects back to login.

- [ ] **Step 7: Commit**

```bash
git add 11.11/lib/auth.ts 11.11/lib/actions/auth.ts 11.11/app/admin/login/page.tsx 11.11/app/admin/page.tsx 11.11/middleware.ts
git commit -m "feat: add password-gated admin session auth"
```

---

### Task 7: Home page (topic list)

**Files:**
- Create: `11.11/lib/db/queries.ts`
- Modify: `11.11/app/page.tsx` (replace default template content)
- Modify: `11.11/app/layout.tsx` (metadata title/description)

**Interfaces:**
- Consumes: `db`, `topics`, `cards` (Task 2).
- Produces: `TopicSummary`, `getTopicsWithCounts(): Promise<TopicSummary[]>` from `lib/db/queries.ts`, reused by Task 9's admin topics page.

- [ ] **Step 1: Write the topics-with-counts query**

Create `11.11/lib/db/queries.ts`:

```ts
import { asc, count, eq } from "drizzle-orm";
import { db } from "./index";
import { topics, cards } from "./schema";

export type TopicSummary = {
  id: string;
  name: string;
  cardCount: number;
};

export async function getTopicsWithCounts(): Promise<TopicSummary[]> {
  return db
    .select({
      id: topics.id,
      name: topics.name,
      cardCount: count(cards.id),
    })
    .from(topics)
    .leftJoin(cards, eq(cards.topicId, topics.id))
    .groupBy(topics.id)
    .orderBy(asc(topics.position));
}
```

- [ ] **Step 2: Replace the home page**

Replace the full contents of `11.11/app/page.tsx`:

```tsx
import Link from "next/link";
import { getTopicsWithCounts } from "@/lib/db/queries";

export default async function HomePage() {
  const topics = await getTopicsWithCounts();

  return (
    <div className="flex flex-1 flex-col bg-[#eef2f6]">
      <header className="bg-[#2E5A87] px-5 py-4 text-white shadow-md">
        <div className="text-[17px] font-bold">Sproochentest</div>
        <div className="mt-0.5 text-xs opacity-80">Flashcards · A1–A2</div>
      </header>
      <main className="flex-1 overflow-y-auto px-4 py-5">
        <h2 className="mb-3 px-0.5 text-sm font-semibold uppercase tracking-wide text-[#6c7a89]">
          Choose a topic
        </h2>
        {topics.length === 0 ? (
          <p className="mt-8 text-center text-sm text-[#6c7a89]">
            No topics yet.{" "}
            <Link href="/admin" className="font-semibold text-[#2E5A87] underline">
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
                className="flex items-center justify-between rounded-2xl border border-[#dbe3ec] bg-white px-[18px] py-[18px] shadow-sm transition-transform active:scale-[0.98]"
              >
                <div>
                  <div className="text-[19px] font-bold text-[#213f5e]">{topic.name}</div>
                  <div className="mt-0.5 text-[13px] text-[#6c7a89]">{topic.cardCount} cards</div>
                </div>
                <div className="text-[22px] text-[#2E5A87]">›</div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Update metadata**

In `11.11/app/layout.tsx`, replace:

```ts
export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};
```

with:

```ts
export const metadata: Metadata = {
  title: "Sproochentest",
  description: "Flashcards for language study",
};
```

- [ ] **Step 4: Verify manually**

Run: `npm run dev`, visit `http://localhost:3000/`.
Expected: a "Sproochentest" header, "Choose a topic" section, and a "Sproochen" card showing "44 cards" (or the count from Task 5's seed output). Clicking it 404s for now (the `/study/[topicId]` route doesn't exist until Task 8) — that's expected.

- [ ] **Step 5: Commit**

```bash
git add 11.11/lib/db/queries.ts 11.11/app/page.tsx 11.11/app/layout.tsx
git commit -m "feat: add home page listing topics from the database"
```

---

### Task 8: Study page (flashcards)

**Files:**
- Modify: `11.11/lib/db/queries.ts` (add a query)
- Modify: `11.11/app/globals.css` (add flip-card CSS)
- Create: `11.11/app/study/[topicId]/page.tsx`
- Create: `11.11/app/study/[topicId]/FlashcardStudy.tsx`

**Interfaces:**
- Consumes: `db`, `topics`, `cards` (Task 2).
- Produces: `StudyCard`, `getTopicWithCards(topicId): Promise<{ id, name, cards: StudyCard[] } | null>` from `lib/db/queries.ts`, used only by this task's page.

- [ ] **Step 1: Add the study query**

Append to `11.11/lib/db/queries.ts`:

```ts
export type StudyCard = {
  id: number;
  questionLu: string;
  questionRu: string;
  answerLu: string;
  answerRu: string;
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
    })
    .from(cards)
    .where(eq(cards.topicId, topicId))
    .orderBy(asc(cards.position));

  return { id: topic.id, name: topic.name, cards: topicCards };
}
```

- [ ] **Step 2: Add the flip-card CSS**

Append to `11.11/app/globals.css`:

```css
.flip-card {
  perspective: 1600px;
}
.flip-inner {
  position: relative;
  width: 100%;
  height: 100%;
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

- [ ] **Step 3: Write the FlashcardStudy client component**

Create `11.11/app/study/[topicId]/FlashcardStudy.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState, type TouchEvent } from "react";
import type { StudyCard } from "@/lib/db/queries";

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function FlashcardStudy({ cards }: { cards: StudyCard[] }) {
  const [shuffled, setShuffled] = useState(false);
  const [order, setOrder] = useState<number[]>(() => cards.map((_, i) => i));
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const touchStartX = useRef<number | null>(null);

  function setMode(rand: boolean) {
    setShuffled(rand);
    const base = cards.map((_, i) => i);
    setOrder(rand ? shuffle(base) : base);
    setPos(0);
    setFlipped(false);
  }

  function next() {
    setFlipped(false);
    if (pos < order.length - 1) {
      setPos(pos + 1);
    } else {
      if (shuffled) setOrder(shuffle(cards.map((_, i) => i)));
      setPos(0);
    }
  }

  function prev() {
    if (pos > 0) {
      setFlipped(false);
      setPos(pos - 1);
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
      }
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  function onTouchStart(e: TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function onTouchEnd(e: TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 60) {
      dx < 0 ? next() : prev();
    }
    touchStartX.current = null;
  }

  const current = cards[order[pos]];

  return (
    <>
      <div className="flex items-center justify-between px-4 pb-1 pt-3">
        <div className="flex rounded-[10px] bg-[#dde5ee] p-[3px]">
          <button
            onClick={() => setMode(false)}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold text-[#213f5e] ${
              !shuffled ? "bg-white shadow-sm" : ""
            }`}
          >
            In order
          </button>
          <button
            onClick={() => setMode(true)}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold text-[#213f5e] ${
              shuffled ? "bg-white shadow-sm" : ""
            }`}
          >
            Shuffle
          </button>
        </div>
        <div className="text-[13px] font-semibold text-[#6c7a89]">
          {pos + 1} / {order.length}
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 pb-1 pt-2.5">
        <div
          className="flip-card h-full w-full max-w-[520px] cursor-pointer"
          onClick={() => setFlipped((f) => !f)}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className={`flip-inner ${flipped ? "flip-flipped" : ""}`}>
            <div className="flip-face flex flex-col items-center justify-center rounded-[22px] border border-[#dbe3ec] bg-white p-7 text-center shadow-lg">
              <div className="absolute top-4 text-xs font-bold uppercase tracking-widest text-[#2E5A87]">
                Fro · Question
              </div>
              <div className="text-[26px] font-semibold leading-snug text-[#1a1a1a]">
                {current.questionLu}
              </div>
              <div className="mt-4 text-base italic leading-snug text-[#6c7a89]">
                {current.questionRu}
              </div>
              <div className="absolute bottom-4 text-xs text-[#a9b4c0]">Tap to see the answer</div>
            </div>
            <div className="flip-face flip-back flex flex-col items-center justify-center rounded-[22px] border border-[#dbe3ec] bg-white p-7 text-center shadow-lg">
              <div className="absolute top-4 text-xs font-bold uppercase tracking-widest text-[#c8702d]">
                Äntwert · Answer
              </div>
              <div className="text-[26px] font-semibold leading-snug text-[#213f5e]">
                {current.answerLu}
              </div>
              <div className="mt-4 text-base italic leading-snug text-[#6c7a89]">
                {current.answerRu}
              </div>
              <div className="absolute bottom-4 text-xs text-[#a9b4c0]">Tap to flip back</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3 px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3">
        <button
          onClick={prev}
          disabled={pos === 0}
          className="flex-1 rounded-[14px] bg-[#dde5ee] py-4 text-base font-bold text-[#213f5e] disabled:opacity-40"
        >
          ‹ Back
        </button>
        <button
          onClick={next}
          className="flex-1 rounded-[14px] bg-[#2E5A87] py-4 text-base font-bold text-white"
        >
          {pos === order.length - 1 ? "Restart ↻" : "Next ›"}
        </button>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Write the study page**

Create `11.11/app/study/[topicId]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTopicWithCards } from "@/lib/db/queries";
import { FlashcardStudy } from "./FlashcardStudy";

export default async function StudyPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const { topicId } = await params;
  const topic = await getTopicWithCards(topicId);
  if (!topic) notFound();

  return (
    <div className="flex flex-1 flex-col bg-[#eef2f6]">
      <header className="flex items-center justify-between bg-[#2E5A87] px-5 py-4 text-white shadow-md">
        <div>
          <div className="text-[17px] font-bold">{topic.name}</div>
          <div className="mt-0.5 text-xs opacity-80">Flashcards · A1–A2</div>
        </div>
        <Link href="/" className="rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold">
          Topics
        </Link>
      </header>
      {topic.cards.length === 0 ? (
        <p className="flex-1 p-6 text-center text-sm text-[#6c7a89]">
          This topic has no cards yet.
        </p>
      ) : (
        <FlashcardStudy cards={topic.cards} />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verify manually**

Run: `npm run dev`, visit `http://localhost:3000/study/sproochen`.
Expected: the first card's LU question + RU translation show on the front. Clicking/tapping the card flips it to show the LU/RU answer. "Next ›" advances; "‹ Back" is disabled on card 1. Toggling "Shuffle" re-randomizes order and resets to card 1/44. Left/right arrow keys and spacebar work (desktop). On a narrow/mobile viewport (browser dev tools device mode), swiping left/right on the card also navigates.

- [ ] **Step 6: Commit**

```bash
git add 11.11/lib/db/queries.ts 11.11/app/globals.css 11.11/app/study
git commit -m "feat: add flashcard study page"
```

---

### Task 9: Admin — manage topics

**Files:**
- Create: `11.11/lib/actions/topics.ts`
- Create: `11.11/app/admin/NewTopicForm.tsx`
- Create: `11.11/app/admin/ConfirmSubmitButton.tsx`
- Modify: `11.11/app/admin/page.tsx` (replace Task 6's placeholder)

**Interfaces:**
- Consumes: `db`, `topics` (Task 2); `getTopicsWithCounts` (Task 7); `logout` (Task 6).
- Produces: `createTopic`, `deleteTopic` server actions from `lib/actions/topics.ts`; `ConfirmSubmitButton` component, reused by Task 10's `CardRow`.

- [ ] **Step 1: Write the topic server actions**

Create `11.11/lib/actions/topics.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, max } from "drizzle-orm";
import { db } from "@/lib/db";
import { topics } from "@/lib/db/schema";

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function createTopic(
  _prevState: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Topic name is required." };

  const id = slugify(name);
  if (!id) return { error: "Topic name must contain at least one letter or number." };

  const [existing] = await db.select().from(topics).where(eq(topics.id, id));
  if (existing) return { error: `A topic with id "${id}" already exists.` };

  const [{ value: maxPosition }] = await db.select({ value: max(topics.position) }).from(topics);

  await db.insert(topics).values({
    id,
    name,
    position: (maxPosition ?? -1) + 1,
    createdAt: Date.now(),
  });

  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin");
}

export async function deleteTopic(topicId: string, _formData: FormData): Promise<void> {
  await db.delete(topics).where(eq(topics.id, topicId));
  revalidatePath("/");
  revalidatePath("/admin");
}
```

- [ ] **Step 2: Write the confirm-submit button**

Create `11.11/app/admin/ConfirmSubmitButton.tsx`:

```tsx
"use client";

export function ConfirmSubmitButton({
  label,
  confirmMessage,
}: {
  label: string;
  confirmMessage: string;
}) {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!confirm(confirmMessage)) e.preventDefault();
      }}
      className="rounded-lg px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50"
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 3: Write the new-topic form**

Create `11.11/app/admin/NewTopicForm.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { createTopic } from "@/lib/actions/topics";

export function NewTopicForm() {
  const [state, formAction, pending] = useActionState(createTopic, {});

  return (
    <form
      action={formAction}
      className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-[#dbe3ec] bg-white p-4"
    >
      <div className="flex-1">
        <label className="mb-1 block text-xs font-semibold uppercase text-[#6c7a89]">
          New topic name
        </label>
        <input
          name="name"
          required
          placeholder="e.g. Wunnen"
          className="w-full rounded-lg border border-[#dbe3ec] px-3 py-2 text-sm outline-none focus:border-[#2E5A87]"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[#2E5A87] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add topic"}
      </button>
      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
```

- [ ] **Step 4: Replace the admin page**

Replace the full contents of `11.11/app/admin/page.tsx`:

```tsx
import Link from "next/link";
import { getTopicsWithCounts } from "@/lib/db/queries";
import { deleteTopic } from "@/lib/actions/topics";
import { logout } from "@/lib/actions/auth";
import { NewTopicForm } from "./NewTopicForm";
import { ConfirmSubmitButton } from "./ConfirmSubmitButton";

export default async function AdminPage() {
  const topics = await getTopicsWithCounts();

  return (
    <div className="mx-auto flex max-w-2xl flex-1 flex-col p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#213f5e]">Admin · Topics</h1>
        <form action={logout}>
          <button type="submit" className="text-sm font-semibold text-[#6c7a89] underline">
            Log out
          </button>
        </form>
      </div>

      <NewTopicForm />

      <div className="flex flex-col gap-2">
        {topics.map((topic) => (
          <div
            key={topic.id}
            className="flex items-center justify-between rounded-xl border border-[#dbe3ec] bg-white px-4 py-3"
          >
            <div>
              <div className="font-semibold text-[#213f5e]">{topic.name}</div>
              <div className="text-xs text-[#6c7a89]">{topic.cardCount} cards</div>
            </div>
            <div className="flex items-center gap-3">
              <Link href={`/admin/${topic.id}`} className="text-sm font-semibold text-[#2E5A87] underline">
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
          <p className="text-sm text-[#6c7a89]">No topics yet — add one above.</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify manually**

Run: `npm run dev`, log into `/admin`.
Expected: "Sproochen · 44 cards" listed with a "Manage cards" link (404s until Task 10) and a "Delete" button. Type a new topic name (e.g. "Wunnen"), submit — expect it appears in the list with "0 cards". Click "Delete" on it, confirm the browser `confirm()` dialog — expect it disappears from both `/admin` and the home page `/`.

- [ ] **Step 6: Commit**

```bash
git add 11.11/lib/actions/topics.ts 11.11/app/admin/NewTopicForm.tsx 11.11/app/admin/ConfirmSubmitButton.tsx 11.11/app/admin/page.tsx
git commit -m "feat: add admin topic management"
```

---

### Task 10: Admin — manage cards

**Files:**
- Create: `11.11/lib/actions/cards.ts`
- Create: `11.11/lib/db/queries.ts` (add two queries — modify existing file)
- Create: `11.11/app/admin/[topicId]/NewCardForm.tsx`
- Create: `11.11/app/admin/[topicId]/CardRow.tsx`
- Create: `11.11/app/admin/[topicId]/page.tsx`

**Interfaces:**
- Consumes: `db`, `cards` (Task 2); `ConfirmSubmitButton` styling pattern (Task 9, not reused directly — inlined here since the button also needs a `formAction` override).
- Produces: `createCard`, `updateCard`, `deleteCard`, `moveCard` server actions from `lib/actions/cards.ts`; `AdminCard`, `getTopicCardsForAdmin`, `getTopicName` from `lib/db/queries.ts`.

- [ ] **Step 1: Add admin card queries**

Append to `11.11/lib/db/queries.ts`:

```ts
export type AdminCard = {
  id: number;
  questionLu: string;
  questionRu: string;
  answerLu: string;
  answerRu: string;
  position: number;
};

export async function getTopicCardsForAdmin(topicId: string): Promise<AdminCard[]> {
  return db
    .select({
      id: cards.id,
      questionLu: cards.questionLu,
      questionRu: cards.questionRu,
      answerLu: cards.answerLu,
      answerRu: cards.answerRu,
      position: cards.position,
    })
    .from(cards)
    .where(eq(cards.topicId, topicId))
    .orderBy(asc(cards.position));
}

export async function getTopicName(topicId: string): Promise<string | null> {
  const [topic] = await db.select({ name: topics.name }).from(topics).where(eq(topics.id, topicId));
  return topic?.name ?? null;
}
```

- [ ] **Step 2: Write the card server actions**

Create `11.11/lib/actions/cards.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { eq, max } from "drizzle-orm";
import { db } from "@/lib/db";
import { cards } from "@/lib/db/schema";

export async function createCard(
  topicId: string,
  _prevState: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  const questionLu = String(formData.get("questionLu") ?? "").trim();
  const questionRu = String(formData.get("questionRu") ?? "").trim();
  const answerLu = String(formData.get("answerLu") ?? "").trim();
  const answerRu = String(formData.get("answerRu") ?? "").trim();

  if (!questionLu || !questionRu || !answerLu || !answerRu) {
    return { error: "All four fields are required." };
  }

  const [{ value: maxPosition }] = await db
    .select({ value: max(cards.position) })
    .from(cards)
    .where(eq(cards.topicId, topicId));

  await db.insert(cards).values({
    topicId,
    questionLu,
    questionRu,
    answerLu,
    answerRu,
    position: (maxPosition ?? -1) + 1,
    createdAt: Date.now(),
  });

  revalidatePath(`/admin/${topicId}`);
  revalidatePath(`/study/${topicId}`);
  return {};
}

export async function updateCard(cardId: number, topicId: string, formData: FormData): Promise<void> {
  const questionLu = String(formData.get("questionLu") ?? "").trim();
  const questionRu = String(formData.get("questionRu") ?? "").trim();
  const answerLu = String(formData.get("answerLu") ?? "").trim();
  const answerRu = String(formData.get("answerRu") ?? "").trim();

  await db
    .update(cards)
    .set({ questionLu, questionRu, answerLu, answerRu })
    .where(eq(cards.id, cardId));

  revalidatePath(`/admin/${topicId}`);
  revalidatePath(`/study/${topicId}`);
}

export async function deleteCard(cardId: number, topicId: string, _formData: FormData): Promise<void> {
  await db.delete(cards).where(eq(cards.id, cardId));
  revalidatePath(`/admin/${topicId}`);
  revalidatePath(`/study/${topicId}`);
}

export async function moveCard(
  cardId: number,
  topicId: string,
  direction: "up" | "down",
  _formData: FormData
): Promise<void> {
  const topicCards = await db
    .select({ id: cards.id, position: cards.position })
    .from(cards)
    .where(eq(cards.topicId, topicId))
    .orderBy(cards.position);

  const index = topicCards.findIndex((c) => c.id === cardId);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= topicCards.length) return;

  const a = topicCards[index];
  const b = topicCards[swapWith];

  await db.update(cards).set({ position: b.position }).where(eq(cards.id, a.id));
  await db.update(cards).set({ position: a.position }).where(eq(cards.id, b.id));

  revalidatePath(`/admin/${topicId}`);
  revalidatePath(`/study/${topicId}`);
}
```

- [ ] **Step 3: Write the new-card form**

Create `11.11/app/admin/[topicId]/NewCardForm.tsx`:

```tsx
"use client";

import { useActionState, useRef } from "react";
import { createCard } from "@/lib/actions/cards";

export function NewCardForm({ topicId }: { topicId: string }) {
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
      className="mb-6 grid grid-cols-1 gap-2 rounded-xl border border-[#dbe3ec] bg-white p-4 sm:grid-cols-2"
    >
      <input
        name="questionLu"
        placeholder="Question (LU)"
        className="rounded-lg border border-[#dbe3ec] px-3 py-2 text-sm"
      />
      <input
        name="questionRu"
        placeholder="Question (RU)"
        className="rounded-lg border border-[#dbe3ec] px-3 py-2 text-sm"
      />
      <input
        name="answerLu"
        placeholder="Answer (LU)"
        className="rounded-lg border border-[#dbe3ec] px-3 py-2 text-sm"
      />
      <input
        name="answerRu"
        placeholder="Answer (RU)"
        className="rounded-lg border border-[#dbe3ec] px-3 py-2 text-sm"
      />
      <div className="col-span-full flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[#2E5A87] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add card"}
        </button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Write the card row**

Create `11.11/app/admin/[topicId]/CardRow.tsx`:

```tsx
"use client";

import { useState } from "react";
import { updateCard, deleteCard, moveCard } from "@/lib/actions/cards";
import type { AdminCard } from "@/lib/db/queries";

export function CardRow({
  card,
  topicId,
  isFirst,
  isLast,
}: {
  card: AdminCard;
  topicId: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [questionLu, setQuestionLu] = useState(card.questionLu);
  const [questionRu, setQuestionRu] = useState(card.questionRu);
  const [answerLu, setAnswerLu] = useState(card.answerLu);
  const [answerRu, setAnswerRu] = useState(card.answerRu);

  return (
    <div className="rounded-xl border border-[#dbe3ec] bg-white p-4">
      <form
        action={updateCard.bind(null, card.id, topicId)}
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        <input
          name="questionLu"
          value={questionLu}
          onChange={(e) => setQuestionLu(e.target.value)}
          placeholder="Question (LU)"
          className="rounded-lg border border-[#dbe3ec] px-3 py-2 text-sm"
        />
        <input
          name="questionRu"
          value={questionRu}
          onChange={(e) => setQuestionRu(e.target.value)}
          placeholder="Question (RU)"
          className="rounded-lg border border-[#dbe3ec] px-3 py-2 text-sm"
        />
        <input
          name="answerLu"
          value={answerLu}
          onChange={(e) => setAnswerLu(e.target.value)}
          placeholder="Answer (LU)"
          className="rounded-lg border border-[#dbe3ec] px-3 py-2 text-sm"
        />
        <input
          name="answerRu"
          value={answerRu}
          onChange={(e) => setAnswerRu(e.target.value)}
          placeholder="Answer (RU)"
          className="rounded-lg border border-[#dbe3ec] px-3 py-2 text-sm"
        />
        <div className="col-span-full flex items-center justify-between pt-1">
          <div className="flex gap-1">
            <button
              type="submit"
              formAction={moveCard.bind(null, card.id, topicId, "up")}
              disabled={isFirst}
              className="rounded-lg px-2 py-1 text-sm text-[#2E5A87] disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="submit"
              formAction={moveCard.bind(null, card.id, topicId, "down")}
              disabled={isLast}
              className="rounded-lg px-2 py-1 text-sm text-[#2E5A87] disabled:opacity-30"
            >
              ↓
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-lg bg-[#2E5A87] px-3 py-1.5 text-sm font-semibold text-white"
            >
              Save
            </button>
            <button
              type="submit"
              formAction={deleteCard.bind(null, card.id, topicId)}
              onClick={(e) => {
                if (!confirm("Delete this card?")) e.preventDefault();
              }}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-red-600"
            >
              Delete
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Write the admin topic-detail page**

Create `11.11/app/admin/[topicId]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTopicCardsForAdmin, getTopicName } from "@/lib/db/queries";
import { NewCardForm } from "./NewCardForm";
import { CardRow } from "./CardRow";

export default async function AdminTopicPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const { topicId } = await params;
  const topicName = await getTopicName(topicId);
  if (!topicName) notFound();

  const cards = await getTopicCardsForAdmin(topicId);

  return (
    <div className="mx-auto flex max-w-2xl flex-1 flex-col p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-[#6c7a89] underline">
            ‹ All topics
          </Link>
          <h1 className="mt-1 text-xl font-bold text-[#213f5e]">{topicName}</h1>
        </div>
        <Link href={`/study/${topicId}`} className="text-sm font-semibold text-[#2E5A87] underline">
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
        {cards.length === 0 && <p className="text-sm text-[#6c7a89]">No cards yet — add one above.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify manually**

Run: `npm run dev`, go to `/admin`, click "Manage cards" on Sproochen.
Expected: 44 editable rows. Add a new card via the top form — expect it appears at the bottom and the form clears. Edit a field in an existing row and click "Save" — expect the change persists on reload. Click "↑"/"↓" on a row — expect it swaps position with its neighbor (reload to confirm order changed). Click "Delete" on a row, confirm — expect it disappears and the count on `/admin` and `/` drops by one. Visit `/study/sproochen` and confirm an edited card's new text shows up there too.

- [ ] **Step 7: Commit**

```bash
git add 11.11/lib/actions/cards.ts 11.11/lib/db/queries.ts 11.11/app/admin/\[topicId\]
git commit -m "feat: add admin card management"
```

---

### Task 11: Deployment notes & final end-to-end pass

**Files:**
- Modify: `11.11/README.md`

**Interfaces:**
- Consumes: everything from Tasks 1–10.
- Produces: nothing new — this task documents deployment and does a full manual regression pass.

- [ ] **Step 1: Document Turso provisioning and Vercel deployment**

Append to `11.11/README.md`:

```markdown
## Database (Sproochen flashcards)

This app stores flashcard topics/cards in SQLite via Drizzle ORM + `@libsql/client`.

**Local development** uses a local file — no setup needed beyond `.env.local`
(see `.env.local.example`). Run `npm run db:migrate` then `npm run db:seed` once
to create and populate `local.db`.

**Production (Vercel)** needs a hosted Turso database, since Vercel's filesystem
is ephemeral:

1. Install the Turso CLI and sign in: see https://docs.turso.tech/cli/installation
2. Create a database: `turso db create sproochen`
3. Get the connection URL: `turso db show sproochen --url`
4. Create an auth token: `turso db tokens create sproochen`
5. In the Vercel project settings, add environment variables:
   - `DATABASE_URL` — the `libsql://...` URL from step 3
   - `DATABASE_AUTH_TOKEN` — the token from step 4
   - `ADMIN_PASSWORD` — your chosen admin password
   - `ADMIN_SECRET` — output of `openssl rand -hex 32`
6. Run migrations and seed against the Turso database from your machine, with
   those same values exported locally:
   ```bash
   export DATABASE_URL=libsql://...
   export DATABASE_AUTH_TOKEN=...
   npm run db:migrate
   npm run db:seed
   ```
7. Deploy. `/admin` is protected by `ADMIN_PASSWORD`; `/` and `/study/**` are public.
```

- [ ] **Step 2: Full manual regression pass**

Run: `npm run dev` and `npx tsc --noEmit` (expect no type errors). Then in the browser, walk through:
1. `/` shows the Sproochen topic with the correct card count.
2. `/study/sproochen`: flip, next/prev, shuffle toggle, swipe (mobile viewport), arrow keys + spacebar (desktop) all work as in the original HTML.
3. `/admin` requires login; wrong password shows an error; correct password logs in and stays logged in across reloads; logout works.
4. Create a topic, add a few cards to it, confirm it appears on `/` and is studyable at `/study/<id>`.
5. Edit and reorder cards in `/admin/<id>`, confirm changes reflect in the study view.
6. Delete a card and a topic, confirm both disappear everywhere (home page, admin, study — deleted topic's `/study/<id>` now 404s).

- [ ] **Step 3: Commit**

```bash
git add 11.11/README.md
git commit -m "docs: add Turso/Vercel deployment notes for the flashcards db"
```
