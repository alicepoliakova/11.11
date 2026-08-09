import { db } from "../lib/db";
import { topics, cards } from "../lib/db/schema";
import { seedTopics } from "../data/seed-sproochen";

(async () => {
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
})();
