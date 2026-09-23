/**
 * Capacitor がネイティブ WebView に注入するグローバルだけを見る。
 * Web ビルドでは @capacitor/* をバンドル依存にしない。
 */

export type CapacitorAppPlugin = {
  addListener?: (
    event: "appUrlOpen",
    callback: (event: { url: string }) => void,
  ) => Promise<{ remove: () => Promise<void> | void }> | { remove: () => Promise<void> | void };
  getLaunchUrl?: () => Promise<{ url?: string } | undefined> | { url?: string } | undefined;
};

export type CapacitorBrowserPlugin = {
  open?: (options: { url: string }) => Promise<void> | void;
  close?: () => Promise<void> | void;
};

export type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: {
    App?: CapacitorAppPlugin;
    Browser?: CapacitorBrowserPlugin;
  };
};

export function getCapacitor(): CapacitorGlobal | null {
  if (typeof window === "undefined") return null;
  const cap = (window as Window & { Capacitor?: CapacitorGlobal }).Capacitor;
  return cap ?? null;
}

export function isCapacitorNative(): boolean {
  try {
    return getCapacitor()?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}
