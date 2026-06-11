/**
 * PortalAccessPage — 施主向け共有リンクの失効・エラー状態表示
 *
 * 失効 / 期限切れ / 使用済み / IP制限 の4分岐を
 * 技術用語なしの日本語で表示する。
 */

import type { ReactNode } from "react";
import { AlarmClock, Ban, Globe, Lock, XCircle } from "lucide-react";

type AccessDeniedReason =
  | "expired"
  | "revoked"
  | "redeemed"
  | "ip_blocked"
  | "invalid";

type Props = {
  reason: AccessDeniedReason;
};

const MESSAGES: Record<
  AccessDeniedReason,
  { title: string; description: string; icon: ReactNode }
> = {
  expired: {
    icon: <AlarmClock className="h-12 w-12" aria-hidden="true" />,
    title: "このリンクは期限切れです",
    description:
      "共有リンクの有効期限（5分）を過ぎています。\n担当者に新しいリンクを発行してもらってください。",
  },
  revoked: {
    icon: <Ban className="h-12 w-12" aria-hidden="true" />,
    title: "このリンクは無効化されています",
    description:
      "このリンクはアクセスできない状態になっています。\n担当者にお問い合わせください。",
  },
  redeemed: {
    icon: <Lock className="h-12 w-12" aria-hidden="true" />,
    title: "このリンクは1回限りです",
    description:
      "このリンクはすでに使用済みです。\n担当者に新しいリンクを発行してもらってください。",
  },
  ip_blocked: {
    icon: <Globe className="h-12 w-12" aria-hidden="true" />,
    title: "アクセスが許可されていません",
    description:
      "現在のネットワーク環境からはアクセスできません。\n指定されたネットワークからご利用ください。",
  },
  invalid: {
    icon: <XCircle className="h-12 w-12" aria-hidden="true" />,
    title: "リンクが正しくありません",
    description:
      "URLが正しくないか、リンクが破損しています。\n担当者から送られたリンクをそのままお使いください。",
  },
};

export function PortalAccessPage({ reason }: Props) {
  const { icon, title, description } = MESSAGES[reason] ?? MESSAGES.invalid;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-sm">
        <div className="mb-4 flex justify-center text-slate-400" aria-hidden="true">
          {icon}
        </div>
        <h1 className="mb-3 text-lg font-bold text-slate-800">{title}</h1>
        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-500">
          {description}
        </p>
        <div className="mt-6 rounded-xl bg-slate-50 px-4 py-3">
          <p className="text-xs text-slate-400">
            お困りの場合は担当者までご連絡ください
          </p>
        </div>
      </div>
    </div>
  );
}
