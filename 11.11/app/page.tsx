import Link from "next/link";
import { getTopicsWithCounts } from "@/lib/db/queries";
import { ThemeToggle } from "./ThemeToggle";

export default async function HomePage() {
  const topics = await getTopicsWithCounts();

  return (
    <div className="flex flex-1 flex-col bg-[var(--bg)]">
      <header className="flex items-center justify-between bg-[var(--btn-secondary-bg)] px-5 py-4 text-[var(--btn-secondary-ink)] shadow-md">
        <div>
          <div className="text-[17px] font-bold">Sproochentest</div>
          <div className="mt-0.5 text-xs opacity-80">Flashcards · A1–A2</div>
        </div>
        <ThemeToggle />
      </header>
      <main className="flex-1 overflow-y-auto px-4 py-5">
        <h2 className="mb-3 px-0.5 text-sm font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
          Choose a topic
        </h2>
        {topics.length === 0 ? (
          <p className="mt-8 text-center text-sm text-[var(--ink-muted)]">
            No topics yet.{" "}
            <Link href="/admin" className="font-semibold text-[var(--accent-text)] underline">
              Add one in the admin panel
            </Link>
            .
          </p>
        ) : (
          <div className="flex flex-col gap-3.5">
            {topics.map((topic) => (
              <Link
                key={topic.id}
                href={`/study/${topic.id}`}
                className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-[18px] py-[18px] shadow-sm transition-transform active:scale-[0.98]"
              >
                <div>
                  <div className="text-[19px] font-bold text-[var(--ink)]">{topic.name}</div>
                  <div className="mt-0.5 text-[13px] text-[var(--ink-muted)]">
                    {topic.cardCount} cards
                    {topic.cardCount > 0 && ` · ${topic.knownCount} / ${topic.cardCount} known`}
                  </div>
                </div>
                <div className="text-[22px] text-[var(--accent-text)]">›</div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
