/**
 * Escapes a value for safe inclusion in a CSV cell.
 * Prevents formula injection by prefixing dangerous characters (=, +, -, @, tab, CR)
 * with a single quote, then wraps in double-quotes if the value contains
 * commas, double-quotes, newlines, or was formula-guarded.
 * Converts value to string via String() before escaping.
 */
export function csvEscape(value: string | number): string {
  const s = String(value);
  // Prevent formula injection: prefix with single quote if starts with =, +, -, @, \t, \r
  const needsFormulaGuard = /^[=+\-@\t\r]/.test(s);
  const escaped = needsFormulaGuard ? `'${s}` : s;
  // Wrap in quotes if contains comma, quote, newline, or was formula-guarded
  if (/[",\n\r]/.test(escaped) || needsFormulaGuard) {
    return `"${escaped.replace(/"/g, '""')}"`;
  }
  return escaped;
}
