export function clone<T>(value: T): T {
  return structuredClone(value);
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
