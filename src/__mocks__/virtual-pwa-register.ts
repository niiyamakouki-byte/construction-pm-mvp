// Stub for virtual:pwa-register used in vitest (vite-plugin-pwa virtual module)
export function registerSW(_options?: {
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegistered?: (registration: unknown) => void;
  onRegisterError?: (error: unknown) => void;
}): (reloadPage?: boolean) => Promise<void> {
  return (_reloadPage?: boolean) => Promise.resolve();
}
