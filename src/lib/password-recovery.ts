const PASSWORD_RECOVERY_STORAGE_KEY = "genbahub_password_recovery";

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function markPasswordRecoveryMode(): void {
  getSessionStorage()?.setItem(PASSWORD_RECOVERY_STORAGE_KEY, "1");
}

export function isPasswordRecoveryMode(): boolean {
  return getSessionStorage()?.getItem(PASSWORD_RECOVERY_STORAGE_KEY) === "1";
}

export function clearPasswordRecoveryMode(): void {
  getSessionStorage()?.removeItem(PASSWORD_RECOVERY_STORAGE_KEY);
}
