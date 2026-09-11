/**
 * Removes the markdown markers a model adds to prose that is shown as plain
 * text.
 *
 * The Coach, the toolkit documents and the Decision Grill's questions all
 * render the model's reply as text, not HTML. Asked for a numbered list or a
 * heading, the model writes `**Seller's permit**` and `# Action List`, and the
 * member saw the asterisks and hashes literally. That was first noticed on the
 * WCCC Support Brief (whose brief in data/modules.ts shows its headings in
 * bold) and found on 2026-09-11 in ordinary Coach replies and the Licences &
 * Permits Action List too.
 *
 * Done at render rather than in the routes, for three reasons:
 *
 * - The Coach streams. A marker can arrive split across two chunks, so a
 *   server-side pass would have to buffer the stream to be correct.
 * - Documents and conversations already saved with markers in them are
 *   cleaned too, without a migration.
 * - The saved copy stays exactly what the model returned, so if this ever
 *   strips something it should not, nothing has been lost.
 *
 * Rendering the markdown properly was the alternative. It was rejected because
 * it means either a dependency or hand-built HTML from model output, and plain
 * text with its line breaks kept already reads well: a bold heading on its own
 * line still looks like a heading.
 *
 * Deliberately conservative — it only removes markers it can identify without
 * guessing:
 *
 * - `**bold**` and `__bold__`, only when both markers are on the same line. A
 *   stray unclosed `**` must not pair with one five lines later.
 * - `#` to `######` at the start of a line, followed by a space.
 * - `*` or `+` bullets at the start of a line, which become `•`. `-` bullets
 *   and numbered lists are left alone — they already read as lists.
 *
 * Single asterisks are never touched. "20 * $40" is arithmetic this portal's
 * answers genuinely contain, and `*italic*` cannot be told apart from it.
 */
export function toPlainText(text: string): string {
  return text
    .split("\n")
    .map((line) =>
      line
        .replace(/^(\s*)#{1,6}[ \t]+/, "$1")
        .replace(/^(\s*)[*+][ \t]+/, "$1• ")
        .replace(/\*\*(?=\S)([^\n]*?\S)\*\*/g, "$1")
        .replace(/__(?=\S)([^\n]*?\S)__/g, "$1"),
    )
    .join("\n");
}
