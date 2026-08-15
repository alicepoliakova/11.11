import { sqliteTable, text, integer, blob } from "drizzle-orm/sqlite-core";

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
  questionLuAudio: blob("question_lu_audio", { mode: "buffer" }),
  questionRuAudio: blob("question_ru_audio", { mode: "buffer" }),
  answerLuAudio: blob("answer_lu_audio", { mode: "buffer" }),
  answerRuAudio: blob("answer_ru_audio", { mode: "buffer" }),
  position: integer("position").notNull(),
  knownStatus: text("known_status", { enum: ["known", "unknown"] }),
  createdAt: integer("created_at").notNull(),
});

export type Topic = typeof topics.$inferSelect;
export type NewTopic = typeof topics.$inferInsert;
export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
