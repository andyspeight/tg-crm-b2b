"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

/**
 * Dashboard "Ask Luna" box. It's a launcher, not a second assistant: a question
 * (typed or from a suggestion chip) opens the command palette straight into Ask
 * mode via the `luna:command-open` event, so all the answer rendering lives in
 * one place (the command bar).
 */

const SUGGESTIONS = [
  "Which customers have gone quiet?",
  "Which deals are stalling?",
  "What's my open pipeline worth?",
  "Who should I contact this week?",
];

function ask(query: string) {
  window.dispatchEvent(new CustomEvent("luna:command-open", { detail: { query } }));
}

export function AskLunaBox() {
  const [q, setQ] = useState("");

  function submit() {
    const query = q.trim();
    if (!query) {
      ask(""); // just open the palette
      return;
    }
    ask(query);
    setQ("");
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-card transition-shadow focus-within:border-accent focus-within:shadow-float">
        <Sparkles size={18} strokeWidth={1.9} className="shrink-0 text-accent-strong" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          aria-label="Ask Luna a question"
          placeholder="Ask Luna about your customers, deals or numbers…"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-fg placeholder:text-fg-subtle focus:outline-none"
        />
        <kbd className="hidden shrink-0 rounded-md border border-border bg-surface px-1.5 py-0.5 text-[11px] font-medium text-fg-subtle sm:inline-block">
          ⌘K
        </kbd>
      </div>
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => ask(s)}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-[12.5px] text-fg-muted transition-colors hover:border-accent hover:text-accent-strong"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
