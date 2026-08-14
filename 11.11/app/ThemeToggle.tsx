"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "flashcards-theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    /*
     * same justified SSR-sync pattern as useSound.ts's mount effect:
     * correcting React state to match the DOM attribute the blocking
     * script already set, before hydration renders anything visibly wrong.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (current === "light" || current === "dark") setTheme(current);
  }, []);

  function choose(next: "light" | "dark") {
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage unavailable — theme still applies for this page view
    }
  }

  return (
    <div className="flex rounded-[10px] bg-[var(--btn-secondary-bg)] p-[3px]">
      <button
        onClick={() => choose("light")}
        className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold ${
          theme === "light"
            ? "bg-[var(--accent-fill)] text-[var(--accent-ink)]"
            : "text-[var(--btn-secondary-ink)]"
        }`}
      >
        Light
      </button>
      <button
        onClick={() => choose("dark")}
        className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold ${
          theme === "dark"
            ? "bg-[var(--accent-fill)] text-[var(--accent-ink)]"
            : "text-[var(--btn-secondary-ink)]"
        }`}
      >
        Dark
      </button>
    </div>
  );
}
