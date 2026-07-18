import { navigate } from "../hooks/useHashRouter.js";

// 比較表データ: 内装業者が重視する観点でGenbaHub vs 汎用ツール(ANDPAD/kintoneなど)
const comparisonRows = [
  {
    feature: "内装工程テンプレ（LGS/ボード/クロス/床）",
    genbahub: true,
    generic: false,
    note: "LapoSite は内装工種ごとのテンプレを標準搭載",
  },
  {
    feature: "PDF見積からの自動積算・拾い出し",
    genbahub: true,
    generic: false,
    note: "業者PDFをアップロードするだけで金額を自動集計",
  },
  {
    feature: "AI写真自動分類・写真日報",
    genbahub: true,
    generic: false,
    note: "撮影写真を下地/仕上/検査に自動分類し日報を生成",
  },
  {
    feature: "粗利逆算・予実コスト管理",
    genbahub: true,
    generic: "△",
    note: "内装案件に特化した粗利ダッシュボードを標準搭載",
  },
  {
    feature: "月額料金（目安）",
    genbahub: "¥9,800〜",
    generic: "¥36,000〜",
    note: "汎用ツールの価格は各社公開情報の概算。詳細は各社へお問い合わせください",
  },
  {
    feature: "内装業務へのすぐ使えるカバー範囲",
    genbahub: true,
    generic: false,
    note: "汎用ツールは多業種向けのため、内装向けに別途カスタマイズが必要な場合があります",
  },
];

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function CellValue({ value }: { value: boolean | string }) {
  if (value === true) {
    return (
      <span className="inline-flex items-center justify-center">
        <CheckIcon className="h-5 w-5 text-brand-500" />
        <span className="sr-only">あり</span>
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex items-center justify-center">
        <XIcon className="h-5 w-5 text-slate-300" />
        <span className="sr-only">なし（標準外）</span>
      </span>
    );
  }
  // string value (e.g. price or "△")
  return <span className="text-sm font-medium text-slate-700">{value}</span>;
}

function LogoIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 100 100" aria-hidden="true">
      <rect x="10" y="60" width="80" height="35" rx="3" fill="#fff" opacity="0.9" />
      <rect x="20" y="30" width="60" height="35" rx="3" fill="#93c5fd" opacity="0.8" />
      <polygon points="50,5 15,35 85,35" fill="#fbbf24" />
    </svg>
  );
}

const features = [
  {
    icon: "📐",
    title: "内装特化の工程テンプレ",
    desc: "LGS・ボード・塗装・OA床など内装工種ごとの工程テンプレを即適用。ゼロからの工程作成が不要に。",
  },
  {
    icon: "💰",
    title: "PDF見積→自動積算",
    desc: "メーカー・業者のPDF見積をアップロードするだけで金額を自動集計。転記ミスと積算時間を削減。",
  },
  {
    icon: "📷",
    title: "AI写真日報",
    desc: "現場写真をスマホで撮るだけ。ファイル名からAIがカテゴリ（下地・仕上・検査）を自動分類して日報に反映。",
  },
  {
    icon: "📊",
    title: "粗利・予実管理",
    desc: "見積・発注・実費をリアルタイム比較。各案件の粗利率と予算超過アラートをダッシュボードに集約。",
  },
];

const plans = [
  {
    name: "フリートライアル",
    price: "¥0",
    period: "14日間",
    desc: "全機能を無料でお試し",
    features: ["案件5件まで", "内装工程テンプレ", "AI写真日報", "PDF見積自動積算（10回）"],
    cta: "無料で始める",
    ctaAction: () => navigate("/signup"),
    highlight: false,
  },
  {
    name: "Basic",
    price: "¥9,800",
    period: "/月",
    desc: "小〜中規模の内装施工会社向け",
    features: ["案件無制限", "チームメンバー10名", "内装工程テンプレ全種", "PDF見積自動積算（100回/月）", "粗利・予実ダッシュボード", "メールサポート"],
    cta: "Basicを始める",
    ctaAction: () => navigate("/signup"),
    highlight: true,
  },
  {
    name: "Pro",
    price: "¥29,800",
    period: "/月",
    desc: "複数現場を抱える内装会社向け",
    features: ["案件無制限", "チームメンバー無制限", "全機能＋カスタム帳票", "PDF積算無制限", "複数現場コックピット", "優先サポート"],
    cta: "Proを始める",
    ctaAction: () => navigate("/signup"),
    highlight: false,
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 hover:opacity-90"
          >
            <LogoIcon />
            <span className="text-lg text-brand-800 tracking-tight"><span className="font-bold">Lapo</span><span className="font-normal">Site</span></span>
          </button>
          <nav className="hidden items-center gap-6 sm:flex">
            <a href="#features" className="text-sm text-slate-600 hover:text-slate-900">機能</a>
            <a href="#comparison" className="text-sm text-slate-600 hover:text-slate-900">比較</a>
            <a href="#pricing" className="text-sm text-slate-600 hover:text-slate-900">料金</a>
            <button
              onClick={() => navigate("/login")}
              className="text-sm font-medium text-slate-700 hover:text-slate-900"
            >
              ログイン
            </button>
            <button
              onClick={() => navigate("/signup")}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              無料で始める
            </button>
          </nav>
          {/* Mobile */}
          <div className="flex items-center gap-2 sm:hidden">
            <button
              onClick={() => navigate("/login")}
              className="text-sm font-medium text-slate-700"
            >
              ログイン
            </button>
            <button
              onClick={() => navigate("/signup")}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white"
            >
              無料で始める
            </button>
          </div>
        </div>
      </header>

      {/* Hero — 統一コピー+副文+主CTA1本 */}
      <section className="bg-brand-800 px-4 py-20 text-center sm:py-28">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
            現場の面倒が、
            <br />
            <span className="text-accent-400">消えていく。</span>
          </h1>
          <p className="mx-auto mt-6 max-w-lg text-lg text-brand-200 break-keep">
            内装工事会社のための現場管理SaaS。工程・見積・写真を1画面に集約。
          </p>
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => navigate("/signup")}
              className="rounded-xl bg-accent-400 px-10 py-4 text-base font-bold text-brand-900 shadow-lg hover:bg-accent-500"
            >
              14日間 無料で始める
            </button>
          </div>
          <p className="mt-4 text-sm text-brand-400">クレジットカード不要 · 14日間無料 · 即日利用開始</p>
        </div>
      </section>

      {/* 実画面スクショ挿入枠 */}
      <section className="bg-slate-50 px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <p className="mb-8 text-center text-sm font-semibold tracking-[0.2em] text-slate-400 uppercase">実際の画面</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <img
                src="/lp/screen-dashboard.png"
                alt="LapoSite 今日のダッシュボード画面"
                loading="lazy"
                className="h-52 w-full object-cover object-top"
              />
              <div className="px-4 py-3">
                <p className="text-sm font-semibold text-slate-700">今日のダッシュボード</p>
                <p className="mt-0.5 text-xs text-slate-400">進行中案件・タスク・天気をひと目で確認</p>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <img
                src="/lp/screen-estimate.png"
                alt="LapoSite 見積作成画面（PDFから作成/手動で作成）"
                loading="lazy"
                className="h-52 w-full object-cover object-top"
              />
              <div className="px-4 py-3">
                <p className="text-sm font-semibold text-slate-700">PDF見積→自動積算</p>
                <p className="mt-0.5 text-xs text-slate-400">業者PDFをドロップするだけで金額を自動集計</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 月15時間が消える根拠 */}
      <section className="bg-white px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-slate-900">月15時間が消える</h2>
            <p className="mt-2 text-slate-500">1日30分の事務 × 20日 ＝ 人工0.5人分</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="py-3 pl-5 pr-4 text-left font-semibold text-slate-600">消える面倒</th>
                  <th className="py-3 px-4 text-right font-semibold text-slate-600 whitespace-nowrap w-px">削減時間</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["業者見積PDFの転記・集計", "月4時間"],
                  ["現場写真の整理・共有", "月3時間"],
                  ["工程表の更新・関係者への連絡", "月3時間"],
                  ["進捗確認の電話・LINEの往復", "月3時間"],
                  ["請求書の照合・原価入力", "月2時間"],
                ].map(([label, hours], i) => (
                  <tr key={label} className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}>
                    <td className="py-3 pl-5 pr-4 text-slate-700">{label}</td>
                    <td className="py-3 px-4 text-right font-semibold text-brand-700 whitespace-nowrap">{hours}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-brand-50">
                  <td className="py-3 pl-5 pr-4 font-bold text-slate-900">合計</td>
                  <td className="py-3 px-4 text-right font-extrabold text-brand-700 whitespace-nowrap">月15時間</td>
                </tr>
              </tfoot>
            </table>
            <p className="px-5 py-3 text-xs text-slate-400 bg-slate-50/80 border-t border-slate-100">
              ※内装工事業を営む自社（株式会社ラポルタ）の運用実測に基づく目安です
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-[#f8fafc] px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">内装工事に特化した4つの強み</h2>
            <p className="mt-3 text-slate-500">汎用ツールでは対応できない内装工種・積算・写真管理をカバー。内装工事会社のために作られています。</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="mb-3 text-3xl">{f.icon}</div>
                <h3 className="mb-2 text-base font-bold text-slate-900">{f.title}</h3>
                <p className="text-sm leading-relaxed text-slate-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section id="comparison" className="bg-white px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">内装工事会社に選ばれる理由</h2>
            <p className="mt-3 text-slate-500">
              汎用現場管理ツールは多業種向けのため、内装特有の工種・積算・写真管理に対応するには別途カスタマイズが必要です。
              LapoSite は内装工事向けに最初から設計されています。
            </p>
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 shadow-sm sm:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="py-4 pl-6 pr-4 font-semibold text-slate-600 w-1/2">比較ポイント</th>
                  <th className="py-4 px-4 font-semibold text-center text-brand-700 w-1/4">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="text-base">⚡</span>LapoSite
                    </span>
                  </th>
                  <th className="py-4 px-6 font-semibold text-center text-slate-500 w-1/4">
                    汎用ツール
                    <span className="block text-xs font-normal text-slate-400">（ANDPAD/kintone等・目安）</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, i) => (
                  <tr
                    key={row.feature}
                    className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}
                  >
                    <td className="py-3.5 pl-6 pr-4 text-slate-700">{row.feature}</td>
                    <td className="py-3.5 px-4 text-center">
                      <CellValue value={row.genbahub} />
                    </td>
                    <td className="py-3.5 px-6 text-center">
                      <CellValue value={row.generic} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-6 py-3 text-xs text-slate-400 bg-slate-50/80 border-t border-slate-100">
              ※ 汎用ツールの月額は各社公開情報の概算です。表の内容は2025年時点の公開情報に基づく比較であり、各ツールの詳細は各社サイトでご確認ください。
            </p>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 sm:hidden">
            {comparisonRows.map((row) => (
              <div key={row.feature} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="mb-3 text-sm font-semibold text-slate-800">{row.feature}</p>
                <div className="flex items-center justify-around gap-4">
                  <div className="flex flex-col items-center gap-1 text-center">
                    <span className="text-xs font-medium text-brand-600">LapoSite</span>
                    <CellValue value={row.genbahub} />
                  </div>
                  <div className="h-8 w-px bg-slate-200" aria-hidden="true" />
                  <div className="flex flex-col items-center gap-1 text-center">
                    <span className="text-xs font-medium text-slate-400">汎用ツール（目安）</span>
                    <CellValue value={row.generic} />
                  </div>
                </div>
              </div>
            ))}
            <p className="text-xs text-slate-400 px-1">
              ※ 汎用ツールの月額は各社公開情報の概算です。詳細は各社サイトでご確認ください。
            </p>
          </div>
          {/* Generic AI comparison */}
          <div className="mt-14">
            <div className="mb-8 text-center">
              <h3 className="text-2xl font-bold text-slate-900">ChatGPT等の汎用AIとの違い</h3>
              <p className="mt-3 text-slate-500">
                汎用AIは何でもできる代わりに、何をさせるかを言葉にできる人しか使いこなせません。
                LapoSiteは、AIを使いこなす能力が要らないAIです。
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
              {[
                ["要る能力が違う", "汎用AIは指示の上手さがそのまま成果の差になる。LapoSiteは写真を送る・喋るだけ。現場仕事をそのまま続けるだけでいい。"],
                ["残るものが違う", "チャットの返答は流れて消える。LapoSiteは工程表・日報・請求書という会社の資産として構造化されて残る。"],
                ["効く範囲が違う", "汎用AIは使った本人だけが楽になる。LapoSiteは全員が同じ画面を見る、会社の仕組みとして効く。"],
              ].map(([title, desc]) => (
                <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
                  <h4 className="mb-2 text-base font-bold text-slate-900">{title}</h4>
                  <p className="text-sm leading-relaxed text-slate-500">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="bg-white px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <p className="mb-10 text-center text-sm font-medium uppercase tracking-widest text-slate-400">内装工事会社からの声</p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <figure className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <blockquote className="text-sm leading-7 text-slate-700">
                "内装工程テンプレのおかげで、LGS〜クロス貼りまでの工程表が10分で完成。以前は Excel で2〜3時間かかっていました。"
              </blockquote>
              <figcaption className="mt-4 text-xs text-slate-400">— 都内内装施工会社 現場監督</figcaption>
            </figure>
            <figure className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <blockquote className="text-sm leading-7 text-slate-700">
                "業者からのPDF見積を貼るだけで積算できるのが助かる。転記ミスがなくなり、見積提出のスピードが倍になりました。"
              </blockquote>
              <figcaption className="mt-4 text-xs text-slate-400">— リノベーション会社 代表</figcaption>
            </figure>
            <figure className="rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:col-span-2 lg:col-span-1">
              <blockquote className="text-sm leading-7 text-slate-700">
                "現場写真がカテゴリ自動分類されて日報に入るのが便利。写真整理の時間がほぼゼロになり、若い現場監督にも好評です。"
              </blockquote>
              <figcaption className="mt-4 text-xs text-slate-400">— 内装工事会社 工事部長</figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-[#f8fafc] px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">シンプルな料金体系</h2>
            <p className="mt-3 text-slate-500">14日間の無料トライアルでお試しの後、チームに合ったプランをお選びください。</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-6 shadow-sm ${
                  plan.highlight
                    ? "border-2 border-brand-500 bg-brand-700 text-white"
                    : "border border-slate-200 bg-white"
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent-400 px-3 py-0.5 text-xs font-bold text-brand-900">
                    人気No.1
                  </span>
                )}
                <p className={`text-sm font-medium ${plan.highlight ? "text-brand-200" : "text-slate-500"}`}>
                  {plan.name}
                </p>
                <div className="mt-2 flex items-end gap-1">
                  <span className={`text-3xl sm:text-4xl font-extrabold ${plan.highlight ? "text-white" : "text-slate-900"}`}>
                    {plan.price}
                  </span>
                  <span className={`mb-1 text-sm ${plan.highlight ? "text-brand-300" : "text-slate-400"}`}>
                    {plan.period}
                  </span>
                </div>
                <p className={`mt-1 text-sm ${plan.highlight ? "text-brand-200" : "text-slate-500"}`}>
                  {plan.desc}
                </p>
                <ul className="mt-5 space-y-2.5">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-sm">
                      <svg
                        className={`mt-0.5 h-4 w-4 shrink-0 ${plan.highlight ? "text-accent-400" : "text-brand-500"}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className={plan.highlight ? "text-brand-100" : "text-slate-600"}>{feat}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={plan.ctaAction}
                  className={`mt-6 w-full rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                    plan.highlight
                      ? "bg-white text-brand-700 hover:bg-brand-50"
                      : "bg-brand-600 text-white hover:bg-brand-700"
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-slate-400">
            大規模案件・エンタープライズのご相談は{" "}
            <a href="mailto:info@laporta.co.jp" className="text-brand-500 hover:underline whitespace-nowrap">
              お問い合わせ
            </a>
            ください。
          </p>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="bg-brand-700 px-4 py-16 text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            今すぐ無料で始めよう
          </h2>
          <p className="mt-3 text-brand-200">14日間の無料トライアル。カード登録不要。</p>
          <button
            onClick={() => navigate("/signup")}
            className="mt-6 rounded-xl bg-accent-400 px-8 py-3.5 text-base font-bold text-brand-900 shadow-lg hover:bg-accent-500"
          >
            無料トライアルを開始する
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-brand-900 px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <LogoIcon />
                <span className="text-lg text-white"><span className="font-bold">Lapo</span><span className="font-normal">Site</span></span>
              </div>
              <p className="mt-1 text-sm text-brand-400">内装工事に特化した現場管理SaaS。</p>
              <p className="mt-2 text-xs text-brand-500">
                提供: 株式会社ラポルタ<br />
                〒156-0051 東京都世田谷区給田5-12-12<br />
                代表: 新山光輝
              </p>
            </div>
            <nav className="flex flex-col gap-2 text-sm">
              <button
                onClick={() => navigate("/legal#tokushoho")}
                className="text-left text-brand-400 hover:text-white"
              >
                特定商取引法に基づく表記
              </button>
              <button
                onClick={() => navigate("/legal#privacy")}
                className="text-left text-brand-400 hover:text-white"
              >
                プライバシーポリシー
              </button>
              <button
                onClick={() => navigate("/legal#tos")}
                className="text-left text-brand-400 hover:text-white"
              >
                利用規約
              </button>
              <a
                href="mailto:info@laporta.co.jp"
                className="text-brand-400 hover:text-white"
              >
                お問い合わせ
              </a>
            </nav>
          </div>
          <div className="mt-8 border-t border-brand-800 pt-6 text-center text-xs text-brand-600">
            &copy; {new Date().getFullYear()} 株式会社ラポルタ. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
