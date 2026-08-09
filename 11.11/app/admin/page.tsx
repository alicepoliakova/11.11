import { logout } from "@/lib/actions/auth";

export default function AdminPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <p className="text-sm text-[#6c7a89]">Logged in.</p>
      <form action={logout}>
        <button type="submit" className="text-sm font-semibold text-[#2E5A87] underline">
          Log out
        </button>
      </form>
    </div>
  );
}
