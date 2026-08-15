import { notFound } from "next/navigation";
import Link from "next/link";
import { getTopicWithCards } from "@/lib/db/queries";
import { StudySession } from "./StudySession";

export default async function StudyPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const { topicId } = await params;
  const topic = await getTopicWithCards(topicId);
  if (!topic) notFound();

  return (
    <div className="flex flex-1 flex-col bg-[var(--bg)]">
      <header className="flex items-center justify-between bg-[var(--btn-secondary-bg)] px-5 py-4 text-[var(--btn-secondary-ink)] shadow-md">
        <div>
          <div className="text-[17px] font-bold">{topic.name}</div>
          <div className="mt-0.5 text-xs opacity-80">Flashcards · A1–A2</div>
        </div>
        <Link href="/" className="rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold">
          Topics
        </Link>
      </header>
      <StudySession cards={topic.cards} topicId={topicId} />
    </div>
  );
}
