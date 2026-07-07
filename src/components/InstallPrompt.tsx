import { useEffect, useState } from "react";

const DISMISS_KEY = "pwa-install-dismissed-until";
const DISMISS_DAYS = 7;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isDismissed(): boolean {
  try {
    const until = localStorage.getItem(DISMISS_KEY);
    if (!until) return false;
    return Date.now() < Number(until);
  } catch {
    return false;
  }
}

function setDismissed(): void {
  try {
    const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, String(until));
  } catch {
    // ignore storage errors
  }
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode(): boolean {
  return (
    ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true) ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isDismissed() || isInStandaloneMode()) return;

    if (isIOS()) {
      setShowIOSGuide(true);
      setVisible(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => {
      setDeferredPrompt(null);
      setVisible(false);
    });
  }

  function handleDismiss() {
    setDismissed();
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="banner"
      className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-slate-200 shadow-lg px-4 py-3 flex items-start gap-3"
    >
      <div className="flex-1 min-w-0">
        {showIOSGuide ? (
          <>
            <p className="text-sm font-semibold text-slate-800">ホーム画面に追加</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Safari の共有ボタン（
              <span aria-label="共有ボタン">
                <svg className="inline w-3 h-3" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 3v12M7 7l5-5 5 5M5 17h14a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v0a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              ）をタップして「ホーム画面に追加」を選択してください。
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-slate-800">GenbaHub をインストール</p>
            <p className="text-xs text-slate-500 mt-0.5">ホーム画面に追加してオフラインでも使えます。</p>
          </>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!showIOSGuide && (
          <button
            type="button"
            onClick={handleInstall}
            className="text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg px-3 py-1.5"
          >
            追加
          </button>
        )}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="閉じる"
          className="p-1 text-slate-400"
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
