const DEFAULT_TIMEOUT_MS = 8000;

export class TimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(label: string, timeoutMs: number) {
    super(`${label}がタイムアウトしました (${timeoutMs}ms)`);
    this.name = "TimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

type TimeoutOptions = {
  label?: string;
  timeoutMs?: number;
};

function getTimeoutOptions(options?: TimeoutOptions): Required<TimeoutOptions> {
  return {
    label: options?.label ?? "リクエスト",
    timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  };
}

export async function withTimeout<T>(
  operation: Promise<T>,
  options?: TimeoutOptions,
): Promise<T> {
  const { label, timeoutMs } = getTimeoutOptions(options);
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(label, timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: TimeoutOptions,
): Promise<Response> {
  const { label, timeoutMs } = getTimeoutOptions(options);
  const controller = new AbortController();
  const upstreamSignal = init?.signal;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let didTimeout = false;

  const abortFromUpstream = () => {
    controller.abort();
  };

  if (upstreamSignal?.aborted) {
    controller.abort();
  } else if (upstreamSignal) {
    upstreamSignal.addEventListener("abort", abortFromUpstream, { once: true });
  }

  timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (didTimeout) {
      throw new TimeoutError(label, timeoutMs);
    }
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    upstreamSignal?.removeEventListener("abort", abortFromUpstream);
  }
}
