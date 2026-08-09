import Link from "next/link";
import { getTopicsWithCounts } from "@/lib/db/queries";

export default async function HomePage() {
  const topics = await getTopicsWithCounts();

  return (
    <div className="flex flex-1 flex-col bg-[#eef2f6]">
      <header className="bg-[#2E5A87] px-5 py-4 text-white shadow-md">
        <div className="text-[17px] font-bold">Sproochentest</div>
        <div className="mt-0.5 text-xs opacity-80">Flashcards · A1–A2</div>
      </header>
      <main className="flex-1 overflow-y-auto px-4 py-5">
        <h2 className="mb-3 px-0.5 text-sm font-semibold uppercase tracking-wide text-[#6c7a89]">
          Choose a topic
        </h2>
        {topics.length === 0 ? (
          <p className="mt-8 text-center text-sm text-[#6c7a89]">
            No topics yet.{" "}
            <Link href="/admin" className="font-semibold text-[#2E5A87] underline">
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
                className="flex items-center justify-between rounded-2xl border border-[#dbe3ec] bg-white px-[18px] py-[18px] shadow-sm transition-transform active:scale-[0.98]"
              >
                <div>
                  <div className="text-[19px] font-bold text-[#213f5e]">{topic.name}</div>
                  <div className="mt-0.5 text-[13px] text-[#6c7a89]">{topic.cardCount} cards</div>
                </div>
                <div className="text-[22px] text-[#2E5A87]">›</div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
