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
      className="rounded-lg px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50"
    >
      {label}
    </button>
  );
}
