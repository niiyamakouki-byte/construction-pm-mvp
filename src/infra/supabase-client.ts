// ── DB型定義（Supabaseテーブルのsnake_caseカラム） ──────────
export type DbProject = {
  id: string;
  name: string;
  description: string;
  status: "planning" | "active" | "completed" | "on_hold";
  start_date: string;
  end_date: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  budget: number | null;
  created_at: string;
  updated_at: string;
};

export type DbTask = {
  id: string;
  project_id: string;
  name: string;
  description: string;
  status: "todo" | "in_progress" | "done";
  assignee_id: string | null;
  start_date: string | null;
  due_date: string | null;
  progress: number;
  dependencies: string[];
  created_at: string;
  updated_at: string;
};

export type DbTeamMember = {
  id: string;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
};

export type DbDailyReport = {
  id: string;
  project_id: string;
  report_date: string;
  weather: string | null;
  content: string;
  photo_urls: string[];
  author_id: string | null;
  created_at: string;
  updated_at: string;
};

export type DbEstimate = {
  id: string;
  project_id: string;
  item_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  amount: number;
  category: string;
  created_at: string;
  updated_at: string;
};

export type DbExpense = {
  id: string;
  project_id: string;
  expense_date: string;
  description: string;
  amount: number;
  category: string;
  receipt_url: string | null;
  approval_status: "pending" | "approved" | "rejected";
  created_at: string;
  updated_at: string;
};

type SupabaseRow = Record<string, unknown>;

type SupabaseQueryResult = {
  data: SupabaseRow | SupabaseRow[] | null;
  error: { message: string } | null;
};

type SupabaseQueryBuilder = {
  select(columns?: string): SupabaseQueryBuilder;
  insert(values: SupabaseRow | SupabaseRow[]): SupabaseQueryBuilder;
  update(values: SupabaseRow): SupabaseQueryBuilder;
  delete(): SupabaseQueryBuilder;
  eq(column: string, value: unknown): SupabaseQueryBuilder;
  order(column: string, options?: { ascending?: boolean }): SupabaseQueryBuilder;
  single(): Promise<SupabaseQueryResult>;
  maybeSingle(): Promise<SupabaseQueryResult>;
  then<TResult1 = SupabaseQueryResult, TResult2 = never>(
    onfulfilled?: ((value: SupabaseQueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2>;
};

type SupabaseUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

type SupabaseSession = {
  user: SupabaseUser;
  access_token: string;
};

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

type AuthChangeEvent =
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "TOKEN_REFRESHED"
  | "USER_UPDATED"
  | "PASSWORD_RECOVERY";

type SupabaseAuthClient = {
  getSession(): Promise<{ data: { session: SupabaseSession | null }; error: { message: string } | null }>;
  signInWithPassword(credentials: { email: string; password: string }): Promise<{ data: { session: SupabaseSession | null }; error: { message: string } | null }>;
  signInWithOtp(credentials: { email: string }): Promise<{ data: { session: SupabaseSession | null }; error: { message: string } | null }>;
  signInWithOAuth(options: { provider: string; options?: { redirectTo?: string } }): Promise<{ data: unknown; error: { message: string } | null }>;
  signUp(credentials: { email: string; password: string; options?: { data?: Record<string, unknown> } }): Promise<{ data: { session: SupabaseSession | null }; error: { message: string } | null }>;
  signOut(): Promise<{ error: { message: string } | null }>;
  onAuthStateChange(callback: (event: AuthChangeEvent, session: SupabaseSession | null) => void): { data: { subscription: { unsubscribe(): void } } };
};

export type SupabaseClientLike = {
  from(table: string): SupabaseQueryBuilder;
  auth: SupabaseAuthClient;
};

type SupabaseModule = {
  createClient(
    url: string,
    anonKey: string,
    options?: {
      auth?: {
        persistSession?: boolean;
        storage?: StorageLike;
        storageKey?: string;
      };
    },
  ): SupabaseClientLike;
};

let clientPromise: Promise<SupabaseClientLike> | null = null;

const REMEMBER_LOGIN_STORAGE_KEY = "genbahub_remember_login";
const AUTH_STORAGE_KEY = "genbahub_auth_token";

function getBrowserStorage(kind: "localStorage" | "sessionStorage"): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window[kind];
  } catch {
    return null;
  }
}

function getRememberPreferenceStorage(): Storage | null {
  return getBrowserStorage("localStorage");
}

function readStorageValue(storage: Storage | null, key: string): string | null {
  if (!storage) {
    return null;
  }

  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorageValue(storage: Storage | null, key: string, value: string): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(key, value);
  } catch {
    // Ignore storage write failures and keep auth in memory for this session.
  }
}

function removeStorageValue(storage: Storage | null, key: string): void {
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage removal failures.
  }
}

export function getRememberLoginPreference(): boolean {
  const storedValue = readStorageValue(getRememberPreferenceStorage(), REMEMBER_LOGIN_STORAGE_KEY);
  return storedValue !== "0";
}

export function setRememberLoginPreference(remember: boolean): void {
  writeStorageValue(
    getRememberPreferenceStorage(),
    REMEMBER_LOGIN_STORAGE_KEY,
    remember ? "1" : "0",
  );

  const localStorageRef = getBrowserStorage("localStorage");
  const sessionStorageRef = getBrowserStorage("sessionStorage");
  const sourceStorage = remember ? sessionStorageRef : localStorageRef;
  const targetStorage = remember ? localStorageRef : sessionStorageRef;
  const existingSession = readStorageValue(sourceStorage, AUTH_STORAGE_KEY);

  if (existingSession) {
    writeStorageValue(targetStorage, AUTH_STORAGE_KEY, existingSession);
    removeStorageValue(sourceStorage, AUTH_STORAGE_KEY);
  }
}

const authStorage: StorageLike = {
  getItem(key) {
    const storage = getRememberLoginPreference()
      ? getBrowserStorage("localStorage")
      : getBrowserStorage("sessionStorage");
    return readStorageValue(storage, key);
  },
  setItem(key, value) {
    const useLocalStorage = getRememberLoginPreference();
    const primaryStorage = getBrowserStorage(useLocalStorage ? "localStorage" : "sessionStorage");
    const secondaryStorage = getBrowserStorage(useLocalStorage ? "sessionStorage" : "localStorage");
    writeStorageValue(primaryStorage, key, value);
    removeStorageValue(secondaryStorage, key);
  },
  removeItem(key) {
    removeStorageValue(getBrowserStorage("localStorage"), key);
    removeStorageValue(getBrowserStorage("sessionStorage"), key);
  },
};

export function getSupabaseEnv() {
  return {
    url: import.meta.env.VITE_SUPABASE_URL?.trim(),
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY?.trim(),
  };
}

export function hasSupabaseEnv(): boolean {
  const { url, anonKey } = getSupabaseEnv();
  return Boolean(url && anonKey);
}

export async function getSupabaseClient(): Promise<SupabaseClientLike> {
  if (!hasSupabaseEnv()) {
    throw new Error("Supabase environment variables are missing");
  }

  clientPromise ??= (async () => {
    const { createClient } = (await import("@supabase/supabase-js")) as unknown as SupabaseModule;
    const { url, anonKey } = getSupabaseEnv();
    return createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        storage: authStorage,
        storageKey: AUTH_STORAGE_KEY,
      },
    });
  })();

  return clientPromise;
}
