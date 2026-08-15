import { asc, count, eq, sql } from "drizzle-orm";
import { db } from "./index";
import { topics, cards } from "./schema";

export type TopicSummary = {
  id: string;
  name: string;
  cardCount: number;
  knownCount: number;
};

export async function getTopicsWithCounts(): Promise<TopicSummary[]> {
  return db
    .select({
      id: topics.id,
      name: topics.name,
      cardCount: count(cards.id),
      knownCount: sql<number>`coalesce(sum(case when ${cards.knownStatus} = 'known' then 1 else 0 end), 0)`,
    })
    .from(topics)
    .leftJoin(cards, eq(cards.topicId, topics.id))
    .groupBy(topics.id)
    .orderBy(asc(topics.position));
}

export type StudyCard = {
  id: number;
  questionLu: string;
  questionRu: string;
  answerLu: string;
  answerRu: string;
  knownStatus: "known" | "unknown" | null;
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
      knownStatus: cards.knownStatus,
    })
    .from(cards)
    .where(eq(cards.topicId, topicId))
    .orderBy(asc(cards.position));

  return { id: topic.id, name: topic.name, cards: topicCards };
}

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
