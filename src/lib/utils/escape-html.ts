/**
 * Escapes special HTML characters in a value to prevent XSS.
 * Also strips ASCII control characters (\x00-\x1F, \x7F) to prevent
 * malformed output in PDF generators (jsPDF) and other HTML consumers.
 * Converts value to string via String() before escaping.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    // Strip control characters (NUL, BEL, BS, etc.) before HTML-escaping
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Escapes special XML characters in a value.
 * Uses &apos; for single quotes (XML spec) instead of &#39;.
 * Converts value to string via String() before escaping.
 */
export function escapeXml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
