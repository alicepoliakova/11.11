import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { cards } from "@/lib/db/schema";
import { synthesizeSpeech } from "@/lib/elevenlabs";

const FIELDS = ["question-lu", "question-ru", "answer-lu", "answer-ru"] as const;
type Field = (typeof FIELDS)[number];

function isField(value: string): value is Field {
  return (FIELDS as readonly string[]).includes(value);
}

// Only the text/audio column pair the requested field actually needs —
// selecting all four audio blobs (up to several hundred KB each) to serve
// one would waste bandwidth and DB round-trip time on every request.
function selectionFor(field: Field) {
  switch (field) {
    case "question-lu":
      return { text: cards.questionLu, audio: cards.questionLuAudio };
    case "question-ru":
      return { text: cards.questionRu, audio: cards.questionRuAudio };
    case "answer-lu":
      return { text: cards.answerLu, audio: cards.answerLuAudio };
    case "answer-ru":
      return { text: cards.answerRu, audio: cards.answerRuAudio };
  }
}

const inFlight = new Map<string, Promise<Buffer>>();

// Concurrent requests for the same uncached card/field share a single
// ElevenLabs call instead of each triggering its own (this route is
// public and unauthenticated, and eleven_v3 is slow enough that the race
// window for duplicate calls is wide).
async function generateAndCache(cardId: number, field: Field, text: string): Promise<Buffer> {
  const key = `${cardId}:${field}`;
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const audio = await synthesizeSpeech(text);
    await saveAudio(cardId, field, audio);
    return audio;
  })();

  inFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(key);
  }
}

async function saveAudio(cardId: number, field: Field, audio: Buffer): Promise<void> {
  switch (field) {
    case "question-lu":
      await db.update(cards).set({ questionLuAudio: audio }).where(eq(cards.id, cardId));
      return;
    case "question-ru":
      await db.update(cards).set({ questionRuAudio: audio }).where(eq(cards.id, cardId));
      return;
    case "answer-lu":
      await db.update(cards).set({ answerLuAudio: audio }).where(eq(cards.id, cardId));
      return;
    case "answer-ru":
      await db.update(cards).set({ answerRuAudio: audio }).where(eq(cards.id, cardId));
      return;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cardId: string; field: string }> }
) {
  const { cardId: cardIdParam, field: fieldParam } = await params;

  if (!isField(fieldParam)) {
    return NextResponse.json({ error: "Unknown field" }, { status: 404 });
  }
  const field = fieldParam;

  const cardId = Number(cardIdParam);
  if (!Number.isInteger(cardId)) {
    return NextResponse.json({ error: "Invalid card id" }, { status: 404 });
  }

  const { text: textColumn, audio: audioColumn } = selectionFor(field);
  const [row] = await db
    .select({ text: textColumn, audio: audioColumn })
    .from(cards)
    .where(eq(cards.id, cardId));
  if (!row) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  let audio = row.audio;

  if (!audio) {
    try {
      audio = await generateAndCache(cardId, field, row.text);
    } catch (err) {
      console.error("TTS generation failed", err);
      return NextResponse.json({ error: "TTS generation failed" }, { status: 502 });
    }
  }

  return new NextResponse(new Uint8Array(audio), {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
