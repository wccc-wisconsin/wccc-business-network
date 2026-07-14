/**
 * Turns an event title into a URL-safe slug for the QR check-in link
 * (e.g. "AI Tools for Small Business" -> "ai-tools-for-small-business").
 * Used by both the check-in route handler (to look up the event) and
 * the dashboard (to build the link that gets encoded into the QR code).
 */
export function slugifyEventTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}
