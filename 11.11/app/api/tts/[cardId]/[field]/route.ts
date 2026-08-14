import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { cards, type Card } from "@/lib/db/schema";
import { synthesizeSpeech } from "@/lib/elevenlabs";

const FIELDS = ["question-lu", "question-ru", "answer-lu", "answer-ru"] as const;
type Field = (typeof FIELDS)[number];

function isField(value: string): value is Field {
  return (FIELDS as readonly string[]).includes(value);
}

function textFor(card: Card, field: Field): string {
  switch (field) {
    case "question-lu":
      return card.questionLu;
    case "question-ru":
      return card.questionRu;
    case "answer-lu":
      return card.answerLu;
    case "answer-ru":
      return card.answerRu;
  }
}

function audioFor(card: Card, field: Field): Buffer | null {
  switch (field) {
    case "question-lu":
      return card.questionLuAudio;
    case "question-ru":
      return card.questionRuAudio;
    case "answer-lu":
      return card.answerLuAudio;
    case "answer-ru":
      return card.answerRuAudio;
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

  const [card] = await db.select().from(cards).where(eq(cards.id, cardId));
  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  let audio = audioFor(card, field);

  if (!audio) {
    try {
      audio = await synthesizeSpeech(textFor(card, field));
    } catch (err) {
      console.error("TTS generation failed", err);
      return NextResponse.json({ error: "TTS generation failed" }, { status: 502 });
    }
    await saveAudio(cardId, field, audio);
  }

  return new NextResponse(new Uint8Array(audio), {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
