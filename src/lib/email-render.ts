import { htmlToText } from "@/components/rich-text";

/**
 * Shared email-body rendering for the timelines (person 360 + company 360).
 * Sent emails are stored as HTML; this sanitises them (browser DOM allowlist)
 * for safe rendering, flattens plain/synced bodies to clean text, and identifies
 * the auto "📬 Opened …" notes we hide (the email's own Opened badge says it).
 */

export const looksLikeHtml = (s: string): boolean => /<[a-z][\s\S]*>/i.test(s);

// Tags removed entirely (content and all); anything else not allowed is unwrapped.
const DROP_TAGS = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "FORM", "INPUT", "BUTTON", "SVG"]);
const ALLOWED_TAGS = new Set([
  "A", "P", "BR", "DIV", "SPAN", "STRONG", "B", "EM", "I", "U", "UL", "OL", "LI", "BLOCKQUOTE",
  "H1", "H2", "H3", "H4", "H5", "H6", "HR", "IMG", "TABLE", "THEAD", "TBODY", "TFOOT", "TR", "TD", "TH",
  "PRE", "CODE", "SMALL", "SUB", "SUP", "FONT",
]);
const ALLOWED_ATTR = new Set(["href", "src", "alt", "title", "style", "width", "height", "align", "target", "rel", "colspan", "rowspan"]);

/** Sanitise email HTML in the browser (DOM allowlist) before rendering it. */
export function sanitizeEmailHtml(html: string): string {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") return "";
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    // Clean the body's CHILDREN only — never the <body> element itself, or we'd
    // unwrap it and then read innerHTML off a detached node.
    Array.from(doc.body.children).forEach((el) => clean(el));
    return doc.body.innerHTML;
  } catch {
    return "";
  }

  function clean(el: Element) {
    for (const child of Array.from(el.children)) clean(child);
    const tag = el.tagName;
    if (DROP_TAGS.has(tag)) {
      el.remove();
      return;
    }
    if (!ALLOWED_TAGS.has(tag)) {
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
      }
      return;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const val = attr.value;
      if (name.startsWith("on") || !ALLOWED_ATTR.has(name)) {
        el.removeAttribute(attr.name);
      } else if ((name === "href" || name === "src") && /^\s*(javascript|data:text\/html|vbscript):/i.test(val)) {
        el.removeAttribute(attr.name);
      } else if (name === "style" && /expression\(|javascript:|url\(/i.test(val)) {
        el.removeAttribute(attr.name);
      }
    }
    if (tag === "A") {
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noreferrer noopener");
    }
  }
}

/** Plain-text bodies (synced mail, notes): drop the sync header line, flatten stray HTML. */
export function readableEmailText(raw?: string): string {
  if (!raw) return "";
  const stripped = raw.replace(/^(Received from|Sent to)[^\n]*\n+/i, "");
  return (looksLikeHtml(stripped) ? htmlToText(stripped) : stripped).trim();
}

/** The auto "📬 Opened …" signal note — hidden from timelines (the Opened badge covers it). */
export function isOpenSignalNote(a: { type?: string; summary?: string }): boolean {
  return a.type === "Signal" && (a.summary ?? "").startsWith("📬 Opened");
}
