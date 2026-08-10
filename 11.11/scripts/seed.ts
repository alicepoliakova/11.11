import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { eq, count } from "drizzle-orm";
import { topics, cards } from "../lib/db/schema";
import { seedTopics as sproochenTopics } from "../data/seed-sproochen";
import { seedTopics as summerWanterTopics } from "../data/seed-summer-wanter";
import { seedTopics as transportTopics } from "../data/seed-transport";

const seedTopics = [...sproochenTopics, ...summerWanterTopics, ...transportTopics];

(async () => {
  const client = createClient({
    url: process.env.DATABASE_URL ?? "file:./local.db",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

  // SQLite/libSQL does not enforce foreign keys (our `onDelete: "cascade"`)
  // unless this pragma is set on the connection.
  await client.execute("PRAGMA foreign_keys = ON;");

  const db = drizzle(client, { schema: { topics, cards } });

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

    const [{ value: existingCardCount }] = await db
      .select({ value: count() })
      .from(cards)
      .where(eq(cards.topicId, topic.id));

    if (existingCardCount > 0) {
      console.log(`Skipping cards for topic "${topic.id}": ${existingCardCount} card(s) already exist.`);
      continue;
    }

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

  client.close();
})();
