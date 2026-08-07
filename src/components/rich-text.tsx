"use client";

import { useEffect, useRef } from "react";
import { Bold, Heading, Italic, Link2, List, ListOrdered, Quote, RemoveFormatting, Underline } from "lucide-react";
import { cn } from "@/components/ui";

/**
 * A lightweight contenteditable rich-text editor with a formatting toolbar,
 * for email bodies (templates and one-off sends). Value in/out is HTML.
 *
 * It uses document.execCommand — deprecated but universally supported, and it
 * keeps this dependency-free and CSP-clean (no bundled editor framework), which
 * is the right trade for an internal composer.
 */

/** Turn AI/plain text (with line breaks) into simple paragraph HTML. */
export function plainToHtml(text: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .split(/\n{2,}/)
    .map((para) => `<p>${esc(para).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Plain-text preview of an HTML body (for list cards). */
export function htmlToText(html: string): string {
  return html
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type Cmd = { icon: typeof Bold; label: string; run: (exec: (c: string, a?: string) => void) => void };

const COMMANDS: Cmd[] = [
  { icon: Bold, label: "Bold", run: (e) => e("bold") },
  { icon: Italic, label: "Italic", run: (e) => e("italic") },
  { icon: Underline, label: "Underline", run: (e) => e("underline") },
  { icon: Heading, label: "Heading", run: (e) => e("formatBlock", "H2") },
  { icon: List, label: "Bulleted list", run: (e) => e("insertUnorderedList") },
  { icon: ListOrdered, label: "Numbered list", run: (e) => e("insertOrderedList") },
  { icon: Quote, label: "Quote", run: (e) => e("formatBlock", "BLOCKQUOTE") },
  { icon: RemoveFormatting, label: "Clear formatting", run: (e) => e("removeFormat") },
];

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = 320,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Sync external value in only when it differs, so typing never jumps the caret.
  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== (value || "")) el.innerHTML = value || "";
  }, [value]);

  function emit() {
    onChange(ref.current?.innerHTML ?? "");
  }

  function exec(command: string, arg?: string) {
    ref.current?.focus();
    document.execCommand("styleWithCSS", false, "false");
    document.execCommand(command, false, arg);
    emit();
  }

  function addLink() {
    const url = window.prompt("Link URL");
    if (!url) return;
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    exec("createLink", href);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface focus-within:border-accent focus-within:ring-2 focus-within:ring-accent">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border-soft bg-muted/40 px-1.5 py-1">
        {COMMANDS.slice(0, 4).map((c) => (
          <ToolbarButton key={c.label} icon={c.icon} label={c.label} onClick={() => c.run(exec)} />
        ))}
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        {COMMANDS.slice(4, 6).map((c) => (
          <ToolbarButton key={c.label} icon={c.icon} label={c.label} onClick={() => c.run(exec)} />
        ))}
        <ToolbarButton icon={Link2} label="Insert link" onClick={addLink} />
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        {COMMANDS.slice(6).map((c) => (
          <ToolbarButton key={c.label} icon={c.icon} label={c.label} onClick={() => c.run(exec)} />
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Email body"
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={emit}
        className="rt-editor rt-body w-full overflow-y-auto px-3.5 py-3 text-[14px] text-fg focus:outline-none"
        style={{ minHeight, maxHeight: "50vh" }}
      />
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Bold;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      // onMouseDown (not onClick) so the editor keeps its selection when the
      // button is pressed.
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-card hover:text-fg",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
      )}
    >
      <Icon size={16} strokeWidth={1.85} />
    </button>
  );
}
