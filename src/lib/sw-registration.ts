import { registerSW } from "virtual:pwa-register";

export function registerServiceWorker(): void {
  if (typeof window === "undefined") return;

  const updateSW = registerSW({
    onNeedRefresh() {
      console.log("[SW] New content available, updating...");
      updateSW(true);
    },
    onOfflineReady() {
      console.log("[SW] App ready to work offline.");
    },
    onRegistered(registration) {
      console.log("[SW] Service worker registered:", registration?.scope);
    },
    onRegisterError(error) {
      console.error("[SW] Service worker registration failed:", error);
    },
  });
}
