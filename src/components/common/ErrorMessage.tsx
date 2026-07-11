/**
 * ErrorMessage — 構造化エラー表示コンポーネント
 *
 * 「何が起きた / 影響 / 次に押すボタン」の順で該当箇所に表示する。
 * kind により原因カテゴリを示すプレフィックスを付与する。
 */

export type ErrorKind = "input" | "network" | "permission" | "conflict" | "storage";

const kindLabel: Record<ErrorKind, string> = {
  input: "入力エラー",
  network: "通信エラー",
  permission: "権限エラー",
  conflict: "競合エラー",
  storage: "容量エラー",
};

type ErrorMessageProps = {
  /** エラー原因カテゴリ */
  kind: ErrorKind;
  /** 何が起きたか（人間向け短文） */
  cause: string;
  /** 影響範囲（省略可） */
  impact?: string;
  /** 次操作ボタンのラベル（省略時はボタン非表示） */
  action?: string;
  /** 次操作ボタンのハンドラ */
  onAction?: () => void;
  /** 閉じるボタンのハンドラ（省略時は閉じるボタン非表示） */
  onDismiss?: () => void;
};

export function ErrorMessage({ kind, cause, impact, action, onAction, onDismiss }: ErrorMessageProps) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 font-semibold">{kindLabel[kind]}:</span>
        <span className="flex-1">
          {cause}
          {impact && <span className="mt-1 block text-red-500">{impact}</span>}
        </span>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="エラーを閉じる"
            className="shrink-0 text-red-400 hover:text-red-600"
          >
            &times;
          </button>
        )}
      </div>
      {action && onAction && (
        <div className="mt-2 pl-[4.5rem]">
          <button
            type="button"
            onClick={onAction}
            className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 min-h-[44px] min-w-[44px]"
          >
            {action}
          </button>
        </div>
      )}
    </div>
  );
}
