/**
 * バックエンド(Postgres/Supabase)の生エラー文言をUIにそのまま出さないためのフィルタ。
 * bead f1xi2: organization_members重複時のトリガー例外がUIへ生露出していた。
 */
const RAW_BACKEND_ERROR_PATTERNS: RegExp[] = [
  /organization membership/i,
  /duplicate key value violates/i,
  /violates foreign key constraint/i,
  /violates row-level security policy/i,
  /violates check constraint/i,
  /permission denied for/i,
];

export function toFriendlyErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const isRawBackendError = RAW_BACKEND_ERROR_PATTERNS.some((pattern) => pattern.test(err.message));
  return isRawBackendError ? fallback : err.message;
}
