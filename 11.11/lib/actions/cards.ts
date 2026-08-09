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
