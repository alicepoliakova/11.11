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
