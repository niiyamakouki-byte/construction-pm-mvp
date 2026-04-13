/**
 * Escapes a value for safe inclusion in a CSV cell.
 * Wraps the value in double-quotes if it contains commas, double-quotes, or newlines.
 * Converts value to string via String() before escaping.
 */
export function csvEscape(value: string | number): string {
  const s = String(value);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}
