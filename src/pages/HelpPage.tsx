import { useState } from "react";

type FaqItem = {
  id: string;
  question: string;
  answer: string;
  icon: string;
};

const FAQ_ITEMS: FaqItem[] = [
  {
    id: "create-gantt",
    question: "工程表の作り方を教えてください",
    answer:
      "上のナビ「工程表」タブを開きます。「＋追加」ボタンからタスクを追加してください。工事名・開始日・終了日を入力すると、ガントチャートに表示されます。テンプレートを使うと内装/外構/設備工事の基本工程が一括で入ります。",
    icon: "📊",
  },
  {
    id: "add-task",
    question: "タスクを追加するにはどうすればいいですか？",
    answer:
      "工程表ページで「＋追加」ボタンをタップします。タスク名・担当業者・開始日・終了日を入力して「追加」を押してください。タスクはガントチャートのバーとして表示されます。",
    icon: "➕",
  },
  {
    id: "register-contractor",
    question: "業者を登録する方法は？",
    answer:
      "下のナビ（またはデスクトップは上のナビ）から「業者」タブを開きます。「業者を追加」ボタンから会社名・担当者名・電話番号・メールアドレスを入力して登録できます。登録後は工程表のタスクに担当業者として割り当てられます。",
    icon: "🏢",
  },
  {
    id: "change-duration",
    question: "工期（日数）を変更するには？",
    answer:
      "工程表のタスクバーをドラッグして変更できます。バーの右端をドラッグすると終了日が変わり、バー全体をドラッグすると開始日・終了日が一緒に動きます。または、タスクをタップして編集画面から日付を直接入力することもできます。",
    icon: "↔️",
  },
  {
    id: "print",
    question: "工程表を印刷・PDFで保存するには？",
    answer:
      "工程表ページ右上の「印刷」ボタン（プリンターアイコン）をタップします。ブラウザの印刷ダイアログが開くので、「PDFに保存」を選ぶとPDFとして保存できます。印刷前に「ページの向き：横向き」を選択すると見やすくなります。",
    icon: "🖨️",
  },
  {
    id: "today-dashboard",
    question: "今日やるべき作業を確認するには？",
    answer:
      "「今日」タブを開くと、今日が期日または進行中のタスクが一覧表示されます。現場でスマートフォンから確認するのに便利です。タスクをタップするとステータスを「完了」に変更できます。",
    icon: "📋",
  },
  {
    id: "weather",
    question: "天気予報はどうやって見ますか？",
    answer:
      "プロジェクト作成時に現場住所を入力しておくと、プロジェクト詳細ページで現場周辺の天気予報が表示されます。雨天の日は作業に影響するため、前日に確認することをおすすめします。",
    icon: "🌤️",
  },
  {
    id: "project-status",
    question: "プロジェクトのステータスを変更するには？",
    answer:
      "「案件」タブからプロジェクト一覧を表示し、変更したいプロジェクトをタップします。プロジェクト詳細ページの「ステータス」欄から「計画中」「進行中」「完了」「保留」を選択できます。",
    icon: "🔄",
  },
  {
    id: "multiple-projects",
    question: "複数のプロジェクトを同時に管理できますか？",
    answer:
      "はい、プロジェクト数に制限はありません。「案件」タブから複数のプロジェクトを登録・管理できます。工程表では全プロジェクトのタスクが一覧表示されるため、現場をまたいだ日程の調整もできます。",
    icon: "📁",
  },
  {
    id: "notifications",
    question: "通知はどのように届きますか？",
    answer:
      "タスクの期日が近づくと「通知」タブに一覧表示されます。期日超過・当日・翌日のタスクがアラートとして表示されます。アプリをこまめに確認するか、定期的に通知ページを確認することをおすすめします。",
    icon: "🔔",
  },
];

export function HelpPage() {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">ヘルプ</h2>
        <p className="mt-1 text-sm text-slate-500">
          よくあるご質問・使い方のガイドです
        </p>
      </div>

      {/* Search hint */}
      <div className="rounded-xl bg-brand-50 border border-brand-100 px-4 py-3 flex items-start gap-3">
        <span className="text-xl shrink-0 mt-0.5">💡</span>
        <p className="text-sm text-brand-800">
          質問をタップすると回答が展開されます。困ったことがあればお気軽に確認してください。
        </p>
      </div>

      {/* FAQ Accordion */}
      <section aria-label="よくある質問">
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {FAQ_ITEMS.map((item) => {
            const isOpen = openId === item.id;
            return (
              <div key={item.id}>
                <button
                  type="button"
                  onClick={() => toggle(item.id)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${item.id}`}
                  className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-slate-50 active:bg-slate-100 transition-colors min-h-[56px]"
                >
                  <span className="text-xl shrink-0">{item.icon}</span>
                  <span className="flex-1 text-sm font-semibold text-slate-900 leading-snug">
                    {item.question}
                  </span>
                  <span
                    className={`shrink-0 text-slate-400 transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                    aria-hidden="true"
                  >
                    ▼
                  </span>
                </button>
                {isOpen && (
                  <div
                    id={`faq-answer-${item.id}`}
                    className="px-4 pb-4 pt-0"
                    role="region"
                    aria-label={item.question}
                  >
                    <div className="rounded-xl bg-slate-50 px-4 py-3 border-l-4 border-brand-400">
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {item.answer}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Contact CTA */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm">
        <p className="text-sm font-semibold text-slate-900">
          解決しない場合は
        </p>
        <p className="mt-1 text-sm text-slate-500">
          お困りの際はサポートまでお問い合わせください
        </p>
        <a
          href="mailto:support@genbahub.jp"
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-sm font-bold text-white hover:bg-brand-600 active:bg-brand-700 transition-colors min-h-[48px]"
        >
          <span aria-hidden="true">✉️</span>
          サポートに連絡
        </a>
      </div>
    </div>
  );
}
