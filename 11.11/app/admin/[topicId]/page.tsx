import { notFound } from "next/navigation";
import Link from "next/link";
import { getTopicCardsForAdmin, getTopicName } from "@/lib/db/queries";
import { NewCardForm } from "./NewCardForm";
import { CardRow } from "./CardRow";

export default async function AdminTopicPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const { topicId } = await params;
  const topicName = await getTopicName(topicId);
  if (!topicName) notFound();

  const cards = await getTopicCardsForAdmin(topicId);

  return (
    <div className="mx-auto flex max-w-2xl flex-1 flex-col bg-[var(--bg)] p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-[var(--ink-muted)] underline">
            ‹ All topics
          </Link>
          <h1 className="mt-1 text-xl font-bold text-[var(--ink)]">{topicName}</h1>
        </div>
        <Link href={`/study/${topicId}`} className="text-sm font-semibold text-[var(--accent-text)] underline">
          Preview study view
        </Link>
      </div>

      <NewCardForm topicId={topicId} />

      <div className="flex flex-col gap-3">
        {cards.map((card, index) => (
          <CardRow
            key={card.id}
            card={card}
            topicId={topicId}
            isFirst={index === 0}
            isLast={index === cards.length - 1}
          />
        ))}
        {cards.length === 0 && <p className="text-sm text-[var(--ink-muted)]">No cards yet — add one above.</p>}
      </div>
    </div>
  );
}
