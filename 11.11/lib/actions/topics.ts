"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, max } from "drizzle-orm";
import { db } from "@/lib/db";
import { topics, cards } from "@/lib/db/schema";
import { requireAdminSession } from "@/lib/auth";

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
  if (!(await requireAdminSession())) return { error: "Unauthorized" };

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
  if (!(await requireAdminSession())) return;

  // Explicitly delete cards then the topic in one atomic batch, rather than
  // relying on the `ON DELETE CASCADE` foreign key + `PRAGMA foreign_keys = ON`
  // — the pragma is set per-connection, and libsql's remote (Turso) transports
  // open a new stream per execute(), so it doesn't reliably persist there.
  await db.batch([
    db.delete(cards).where(eq(cards.topicId, topicId)),
    db.delete(topics).where(eq(topics.id, topicId)),
  ]);
  revalidatePath("/");
  revalidatePath("/admin");
}
