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
