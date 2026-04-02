import { navigate } from "../hooks/useHashRouter.js";

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
    icon: "📊",
    title: "ガント工程管理",
    desc: "直感的なガントチャートで工程を可視化。担当者・進捗・依存関係を一目で把握。",
  },
  {
    icon: "💰",
    title: "AI見積",
    desc: "過去データを学習したAIが見積を自動生成。作業時間を大幅に削減します。",
  },
  {
    icon: "👷",
    title: "チーム管理",
    desc: "職人・協力会社・担当者を一元管理。タスクアサインもスムーズに。",
  },
  {
    icon: "📷",
    title: "日報・写真",
    desc: "現場からスマホで日報・写真を投稿。リアルタイムで進捗を共有。",
  },
];

const plans = [
  {
    name: "フリートライアル",
    price: "¥0",
    period: "14日間",
    desc: "全機能を無料でお試し",
    features: ["プロジェクト5件まで", "ガント・タスク管理", "日報・写真", "AI見積（10回/月）"],
    cta: "無料で始める",
    ctaAction: () => navigate("/signup"),
    highlight: false,
  },
  {
    name: "Basic",
    price: "¥9,800",
    period: "/月",
    desc: "小規模チーム向け",
    features: ["プロジェクト無制限", "チームメンバー10名", "ガント・タスク・日報", "AI見積（100回/月）", "メールサポート"],
    cta: "Basicを始める",
    ctaAction: () => navigate("/signup"),
    highlight: true,
  },
  {
    name: "Pro",
    price: "¥29,800",
    period: "/月",
    desc: "中規模〜大規模向け",
    features: ["プロジェクト無制限", "チームメンバー無制限", "全機能", "AI見積（無制限）", "優先サポート", "カスタム帳票"],
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
            建設DXプラットフォーム
          </div>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
            建設現場のDXを、
            <br />
            <span className="text-accent-400">シンプルに。</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-brand-200">
            工程管理からAI見積、日報・写真まで。現場で使えるオールインワンの建設プロジェクト管理ツール。
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
            <h2 className="text-3xl font-bold text-slate-900">現場に必要な機能が全部揃う</h2>
            <p className="mt-3 text-slate-500">煩雑な現場管理をデジタル化。チーム全員がリアルタイムで状況を把握できます。</p>
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

      {/* Social proof */}
      <section className="bg-white px-4 py-16 text-center sm:px-6">
        <div className="mx-auto max-w-3xl">
          <p className="mb-8 text-sm font-medium uppercase tracking-widest text-slate-400">現場の声</p>
          <blockquote className="text-xl font-medium text-slate-700">
            "ガント工程表の作成が半日から30分に。現場の状況がリアルタイムで把握できるので、事務所と現場のコミュニケーションが劇的に改善しました。"
          </blockquote>
          <p className="mt-4 text-sm text-slate-400">— 都内リノベーション会社 工事部長</p>
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
              <p className="mt-1 text-sm text-brand-400">建設現場のDXを、シンプルに。</p>
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
