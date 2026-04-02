import { useEffect } from "react";
import { navigate } from "../hooks/useHashRouter.js";

type Section = "tokushoho" | "privacy" | "tos";

type Props = {
  section?: Section;
};

function BackButton() {
  return (
    <button
      onClick={() => navigate("/")}
      className="mb-6 inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-800"
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      トップへ戻る
    </button>
  );
}

function SectionNav({ current }: { current?: Section }) {
  const items: { id: Section; label: string }[] = [
    { id: "tokushoho", label: "特定商取引法に基づく表記" },
    { id: "privacy", label: "プライバシーポリシー" },
    { id: "tos", label: "利用規約" },
  ];
  return (
    <nav className="mb-8 flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => navigate(`/legal#${item.id}`)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            current === item.id
              ? "bg-brand-600 text-white"
              : "border border-slate-200 text-slate-600 hover:border-brand-400 hover:text-brand-700"
          }`}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function Tokushoho() {
  return (
    <article>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">特定商取引法に基づく表記</h1>
      <dl className="space-y-4">
        {[
          ["販売業者", "株式会社ラポルタ"],
          ["代表者", "新山光輝"],
          ["所在地", "〒107-0062 東京都港区南青山3丁目"],
          ["電話番号", "お問い合わせフォームまたはメールにてご連絡ください"],
          ["メールアドレス", "niiyama@laporta.co.jp"],
          ["販売価格", "各プランのページに表示された金額（税込）"],
          ["支払方法", "クレジットカード（Visa / Mastercard / American Express）"],
          ["支払時期", "ご登録月から月次にて自動引き落とし"],
          ["サービス提供時期", "お申し込み完了後、即時"],
          ["返品・キャンセル", "サービスの性質上、月途中のキャンセルによる日割り返金は行いません。次回更新日までサービスをご利用いただけます。"],
          ["動作環境", "最新バージョンのChrome / Safari / Firefox / Edge 推奨"],
        ].map(([label, value]) => (
          <div key={label} className="grid gap-1 sm:grid-cols-[200px_1fr]">
            <dt className="text-sm font-semibold text-slate-700">{label}</dt>
            <dd className="text-sm text-slate-600">{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function Privacy() {
  return (
    <article className="prose prose-slate max-w-none">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">プライバシーポリシー</h1>
      <p className="text-sm text-slate-500">最終更新日: 2024年4月1日</p>

      <div className="mt-6 space-y-6 text-sm leading-relaxed text-slate-700">
        <section>
          <h2 className="mb-2 text-base font-bold text-slate-900">1. はじめに</h2>
          <p>
            株式会社ラポルタ（以下「当社」）は、GenbaHub（以下「本サービス」）を提供するにあたり、
            お客様の個人情報の取り扱いについて、以下のとおりプライバシーポリシーを定めます。
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-slate-900">2. 収集する情報</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>氏名・会社名・メールアドレス等の登録情報</li>
            <li>本サービスの利用状況・操作ログ</li>
            <li>お問い合わせ内容</li>
            <li>決済に関する情報（カード番号は決済代行会社が管理し、当社は保持しません）</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-slate-900">3. 利用目的</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>本サービスの提供・運営</li>
            <li>お問い合わせへの対応</li>
            <li>サービスの改善・新機能開発</li>
            <li>利用規約違反への対応</li>
            <li>マーケティング・サービスに関するご案内（オプトアウト可）</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-slate-900">4. 第三者提供</h2>
          <p>
            当社は、法令に基づく場合を除き、お客様の同意なく個人情報を第三者に提供しません。
            ただし、サービス運営に必要な業務委託先（クラウドサービス事業者等）に対しては、
            必要最小限の情報を提供する場合があります。
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-slate-900">5. セキュリティ</h2>
          <p>
            当社は、個人情報の漏洩・滅失・毀損を防止するため、適切なセキュリティ対策を実施します。
            データはSupabase（米国）のサーバーに保存され、通信はTLS暗号化により保護されます。
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-slate-900">6. Cookie・アクセス解析</h2>
          <p>
            本サービスはサービス改善のためにアクセス解析ツールを利用する場合があります。
            収集されるデータは匿名化されており、個人を特定するものではありません。
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-slate-900">7. 開示・訂正・削除</h2>
          <p>
            お客様は、ご自身の個人情報の開示・訂正・削除を求める権利があります。
            お申し出は niiyama@laporta.co.jp までご連絡ください。
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-slate-900">8. ポリシーの変更</h2>
          <p>
            本ポリシーは必要に応じて変更する場合があります。重要な変更の場合はサービス内でお知らせします。
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-slate-900">9. お問い合わせ</h2>
          <p>
            個人情報に関するお問い合わせ: <a href="mailto:niiyama@laporta.co.jp" className="text-brand-600 hover:underline">niiyama@laporta.co.jp</a>
          </p>
        </section>
      </div>
    </article>
  );
}

function Tos() {
  return (
    <article>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">利用規約</h1>
      <p className="text-sm text-slate-500">最終更新日: 2024年4月1日</p>

      <div className="mt-6 space-y-6 text-sm leading-relaxed text-slate-700">
        <section>
          <h2 className="mb-2 text-base font-bold text-slate-900">第1条（適用）</h2>
          <p>
            本規約は、株式会社ラポルタ（以下「当社」）が提供するクラウドサービス「GenbaHub」（以下「本サービス」）の
            利用条件を定めるものです。ユーザーは本規約に同意した上で本サービスを利用するものとします。
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-slate-900">第2条（アカウント）</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>ユーザーは正確な情報を登録し、常に最新の状態に保つ責任があります。</li>
            <li>アカウントの不正利用はユーザーの責任となります。</li>
            <li>1人のユーザーが複数のアカウントを作成することは禁止します。</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-slate-900">第3条（料金）</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>有料プランの料金は当社が別途定める料金表に従います。</li>
            <li>支払いは月次の前払いとします。</li>
            <li>料金の変更は1ヶ月前までにお知らせします。</li>
            <li>月途中のキャンセルによる返金は行いません。</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-slate-900">第4条（禁止事項）</h2>
          <p>ユーザーは以下の行為を行ってはなりません。</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>法令または公序良俗に違反する行為</li>
            <li>他のユーザーまたは第三者への迷惑行為・権利侵害</li>
            <li>本サービスの不正アクセス・リバースエンジニアリング</li>
            <li>虚偽の情報の登録</li>
            <li>商業目的での無断転用・再販</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-slate-900">第5条（知的財産権）</h2>
          <p>
            本サービスに関する知的財産権は当社または正当な権利者に帰属します。
            ユーザーが本サービスに投稿・登録したデータの権利はユーザーに帰属します。
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-slate-900">第6条（免責事項）</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>当社は本サービスの中断・データ消失について、故意または重過失がある場合を除き責任を負いません。</li>
            <li>当社の損害賠償責任は、過去1ヶ月分の利用料金を上限とします。</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-slate-900">第7条（サービスの変更・終了）</h2>
          <p>
            当社は事前に通知の上、本サービスの内容を変更または終了することができます。
            サービス終了の場合は、少なくとも30日前にお知らせします。
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-slate-900">第8条（準拠法・管轄）</h2>
          <p>
            本規約は日本法に準拠し、東京地方裁判所を第一審の専属的合意管轄裁判所とします。
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-slate-900">第9条（お問い合わせ）</h2>
          <p>
            本規約に関するお問い合わせ:{" "}
            <a href="mailto:niiyama@laporta.co.jp" className="text-brand-600 hover:underline">
              niiyama@laporta.co.jp
            </a>
          </p>
        </section>
      </div>
    </article>
  );
}

export function LegalPages({ section }: Props) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [section]);

  const renderSection = () => {
    switch (section) {
      case "privacy":
        return <Privacy />;
      case "tos":
        return <Tos />;
      default:
        return <Tokushoho />;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <BackButton />
        <SectionNav current={section ?? "tokushoho"} />
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {renderSection()}
        </div>
      </div>
    </div>
  );
}
