import { navigate } from "../hooks/useHashRouter.js";

// 比較表データ: 内装業者が重視する観点でGenbaHub vs 汎用ツール(ANDPAD/kintoneなど)
const comparisonRows = [
  {
    feature: "内装工程テンプレ（LGS/ボード/クロス/床）",
    genbahub: true,
    generic: false,
    note: "GenbaHub は内装工種ごとのテンプレを標準搭載",
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
    features: ["プロジェクト5件まで", "内装工程テンプレ", "AI写真日報", "PDF見積自動積算（10回）"],
    cta: "無料で始める",
    ctaAction: () => navigate("/signup"),
    highlight: false,
  },
  {
    name: "Basic",
    price: "¥9,800",
    period: "/月",
    desc: "小〜中規模の内装施工会社向け",
    features: ["プロジェクト無制限", "チームメンバー10名", "内装工程テンプレ全種", "PDF見積自動積算（100回/月）", "粗利・予実ダッシュボード", "メールサポート"],
    cta: "Basicを始める",
    ctaAction: () => navigate("/signup"),
    highlight: true,
  },
  {
    name: "Pro",
    price: "¥29,800",
    period: "/月",
    desc: "複数現場を抱える内装会社向け",
    features: ["プロジェクト無制限", "チームメンバー無制限", "全機能＋カスタム帳票", "PDF積算無制限", "複数現場コックピット", "優先サポート"],
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
            <span className="text-lg font-bold text-brand-800 tracking-tight">GenbaHub</span>
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

      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 px-4 py-20 text-center sm:py-32">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 inline-block rounded-full bg-brand-600/40 px-4 py-1.5 text-sm font-medium text-brand-200">
            内装工事特化の現場管理SaaS
          </div>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
            内装工事の現場管理を、
            <br />
            <span className="text-accent-400">もっとシンプルに。</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-brand-200">
            LGS・ボード・塗装・OA床など内装特化の工程テンプレ、PDF見積の自動積算、AI写真日報。内装工事会社のために設計されたプロジェクト管理ツール。
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={() => navigate("/signup")}
              className="w-full rounded-xl bg-accent-400 px-8 py-3.5 text-base font-bold text-brand-900 shadow-lg hover:bg-accent-500 sm:w-auto"
            >
              14日間 無料で始める
            </button>
            <button
              onClick={() => navigate("/login")}
              className="w-full rounded-xl border border-brand-500 px-8 py-3.5 text-base font-semibold text-white hover:bg-brand-700 sm:w-auto"
            >
              ログインする
            </button>
          </div>
          <p className="mt-4 text-sm text-brand-400">クレジットカード不要 · 14日間無料 · 即日利用開始</p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-[#f8fafc] px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-slate-900">内装工事に特化した4つの強み</h2>
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
            <h2 className="text-3xl font-bold text-slate-900">内装工事会社に選ばれる理由</h2>
            <p className="mt-3 text-slate-500">
              汎用現場管理ツールは多業種向けのため、内装特有の工種・積算・写真管理に対応するには別途カスタマイズが必要です。
              GenbaHub は内装工事向けに最初から設計されています。
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
                      <span className="text-base">⚡</span>GenbaHub
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
                    <span className="text-xs font-medium text-brand-600">GenbaHub</span>
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
            <h2 className="text-3xl font-bold text-slate-900">シンプルな料金体系</h2>
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
                  <span className={`text-4xl font-extrabold ${plan.highlight ? "text-white" : "text-slate-900"}`}>
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
            大規模プロジェクト・エンタープライズのご相談は{" "}
            <a href="mailto:niiyama@laporta.co.jp" className="text-brand-500 hover:underline">
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
                <span className="text-lg font-bold text-white">GenbaHub</span>
              </div>
              <p className="mt-1 text-sm text-brand-400">内装工事に特化した現場管理SaaS。</p>
              <p className="mt-2 text-xs text-brand-500">
                提供: 株式会社ラポルタ<br />
                〒107-0062 東京都港区南青山3丁目<br />
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
                href="mailto:niiyama@laporta.co.jp"
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
