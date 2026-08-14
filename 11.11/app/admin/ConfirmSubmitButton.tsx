"use client";

export function ConfirmSubmitButton({
  label,
  confirmMessage,
}: {
  label: string;
  confirmMessage: string;
}) {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!confirm(confirmMessage)) e.preventDefault();
      }}
      className="rounded-lg px-3 py-1.5 text-sm font-semibold text-[var(--danger)] hover:bg-[var(--danger)]/10"
    >
      {label}
    </button>
  );
}
