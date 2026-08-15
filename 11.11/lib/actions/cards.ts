"use server";

import { revalidatePath } from "next/cache";
import { and, eq, max } from "drizzle-orm";
import { db } from "@/lib/db";
import { cards } from "@/lib/db/schema";
import { requireAdminSession } from "@/lib/auth";

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
  revalidatePath("/");
  revalidatePath("/admin");
  return {};
}

export async function updateCard(cardId: number, topicId: string, formData: FormData): Promise<void> {
  const questionLu = String(formData.get("questionLu") ?? "").trim();
  const questionRu = String(formData.get("questionRu") ?? "").trim();
  const answerLu = String(formData.get("answerLu") ?? "").trim();
  const answerRu = String(formData.get("answerRu") ?? "").trim();

  if (!questionLu || !questionRu || !answerLu || !answerRu) return;

  await db
    .update(cards)
    .set({
      questionLu,
      questionRu,
      answerLu,
      answerRu,
      questionLuAudio: null,
      questionRuAudio: null,
      answerLuAudio: null,
      answerRuAudio: null,
    })
    .where(and(eq(cards.id, cardId), eq(cards.topicId, topicId)));

  revalidatePath(`/admin/${topicId}`);
  revalidatePath(`/study/${topicId}`);
}

export async function deleteCard(cardId: number, topicId: string, _formData: FormData): Promise<void> {
  await db.delete(cards).where(and(eq(cards.id, cardId), eq(cards.topicId, topicId)));
  revalidatePath(`/admin/${topicId}`);
  revalidatePath(`/study/${topicId}`);
  revalidatePath("/");
  revalidatePath("/admin");
}

const MAX_REORDER_CARDS = 1000;

export async function reorderCards(topicId: string, orderedCardIds: number[]): Promise<void> {
  if (orderedCardIds.length === 0 || orderedCardIds.length > MAX_REORDER_CARDS) return;

  const updates = orderedCardIds.map((cardId, index) =>
    db
      .update(cards)
      .set({ position: index })
      .where(and(eq(cards.id, cardId), eq(cards.topicId, topicId)))
  );

  // Guaranteed non-empty at runtime by the length check above; db.batch()'s
  // type signature requires a non-empty tuple, which a dynamic-length
  // .map() result can't express structurally.
  await db.batch(updates as [(typeof updates)[number], ...(typeof updates)[number][]]);

  revalidatePath(`/admin/${topicId}`);
  revalidatePath(`/study/${topicId}`);
}

export async function markCardStatus(
  cardId: number,
  topicId: string,
  status: "known" | "unknown"
): Promise<void> {
  // `{ enum: [...] }` on the column is compile-time only — validate at
  // runtime too, since `status` is client-supplied and nothing else stops
  // a crafted call from writing garbage into known_status.
  if (status !== "known" && status !== "unknown") return;

  await db
    .update(cards)
    .set({ knownStatus: status })
    .where(and(eq(cards.id, cardId), eq(cards.topicId, topicId)));

  // Load-bearing for the CardList "K / N known" badge and the home page's
  // per-topic count: onBackToList only flips local state in FlashcardStudy,
  // it doesn't refetch, so these revalidations are what make the badges
  // reflect a mark after returning from a study session. Do not remove as
  // "redundant" without confirming that refresh path still works.
  revalidatePath(`/study/${topicId}`);
  revalidatePath("/");
}

export async function moveCard(
  cardId: number,
  topicId: string,
  direction: "up" | "down",
  _formData: FormData
): Promise<void> {
  if (!(await requireAdminSession())) return;

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
