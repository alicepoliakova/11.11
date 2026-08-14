import Link from "next/link";
import { getTopicsWithCounts } from "@/lib/db/queries";
import { deleteTopic } from "@/lib/actions/topics";
import { logout } from "@/lib/actions/auth";
import { NewTopicForm } from "./NewTopicForm";
import { ConfirmSubmitButton } from "./ConfirmSubmitButton";

export default async function AdminPage() {
  const topics = await getTopicsWithCounts();

  return (
    <div className="mx-auto flex max-w-2xl flex-1 flex-col bg-[var(--bg)] p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-[var(--ink)]">Admin · Topics</h1>
        <form action={logout}>
          <button type="submit" className="text-sm font-semibold text-[var(--ink-muted)] underline">
            Log out
          </button>
        </form>
      </div>

      <NewTopicForm />

      <div className="flex flex-col gap-2">
        {topics.map((topic) => (
          <div
            key={topic.id}
            className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3"
          >
            <div>
              <div className="font-semibold text-[var(--ink)]">{topic.name}</div>
              <div className="text-xs text-[var(--ink-muted)]">{topic.cardCount} cards</div>
            </div>
            <div className="flex items-center gap-3">
              <Link href={`/admin/${topic.id}`} className="text-sm font-semibold text-[var(--accent-text)] underline">
                Manage cards
              </Link>
              <form action={deleteTopic.bind(null, topic.id)}>
                <ConfirmSubmitButton
                  label="Delete"
                  confirmMessage={`Delete topic "${topic.name}" and all its cards?`}
                />
              </form>
            </div>
          </div>
        ))}
        {topics.length === 0 && (
          <p className="text-sm text-[var(--ink-muted)]">No topics yet — add one above.</p>
        )}
      </div>
    </div>
  );
}
