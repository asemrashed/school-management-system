import { JSDOM } from "jsdom";
import createDOMPurify from "dompurify";

const window = new JSDOM("").window;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DOMPurify = createDOMPurify(window as any);

/** Run on EVERY user-generated HTML string before it is written to the DB. */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "em", "u", "ul", "ol", "li", "a", "h1", "h2", "h3",
      "blockquote", "img", "span",
    ],
    ALLOWED_ATTR: ["href", "src", "alt", "target", "rel", "class"],
  });
}

/** Escapes text for interpolation into an HTML email body (names typed by the public). */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
