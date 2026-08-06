import { useState, type FormEvent } from "react";
import { Check, X } from "lucide-react";
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
  return <Check className={className} strokeWidth={2.25} aria-hidden="true" />;
}

function XIcon({ className }: { className?: string }) {
  return <X className={className} strokeWidth={2.25} aria-hidden="true" />;
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

function HeroEmailCta() {
  const [email, setEmail] = useState("");

  const handleSubmit = (e: FormEvent) => {
    // ponytail: type="email" required の native validation が空/不正形式を弾くため、
    // ここに到達する時点で email は常に妥当な非空文字列
    e.preventDefault();
    navigate(`/signup?email=${encodeURIComponent(email.trim())}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row"
    >
      <label htmlFor="hero-email" className="sr-only">
        メールアドレス
      </label>
      <input
        id="hero-email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="メールアドレスを入力"
        className="w-full rounded-xl border-0 px-4 py-4 text-base text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-400 sm:flex-1"
      />
      <button
        type="submit"
        className="shrink-0 rounded-xl bg-accent-400 px-6 py-4 text-base font-bold text-brand-900 hover:bg-accent-500"
      >
        無料で始める
      </button>
    </form>
  );
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
    title: "内装特化の工程テンプレ",
    desc: "LGS・ボード・塗装・OA床など内装工種ごとの工程テンプレを即適用。ゼロからの工程作成が不要に。",
  },
  {
    title: "PDF見積→自動積算",
    desc: "メーカー・業者のPDF見積をアップロードするだけで金額を自動集計。転記ミスと積算時間を削減。",
  },
  {
    title: "AI写真日報",
    desc: "現場写真をスマホで撮るだけ。ファイル名からAIがカテゴリ（下地・仕上・検査）を自動分類して日報に反映。",
  },
  {
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
    // laporta-beads-4on5a / Codex: LPの実画面訴求とセクション階層をv2-cozyへ整理。
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

      <main>
      {/* Hero: 統一コピー+副文+主CTA1本 */}
      <section className="bg-brand-800 px-4 py-20 text-center sm:py-28">
        <div className="mx-auto max-w-2xl">
          {/* ponytail: hero h1はLCP候補要素のため、editorial webfont(Shippori Mincho)は
              適用しない。display:swap でもLCP計測がフォント読込完了まで遅延する実測を確認
              (laporta-beads-c6skn, 6728ms→8250ms)。見出しエディトリアル化は below-the-fold
              セクションのみに留める。 */}
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
            現場の面倒が、
            <br />
            <span className="text-accent-400">消えていく。</span>
          </h1>
          <p className="mx-auto mt-6 max-w-lg text-lg text-brand-200 break-keep">
            内装工事会社のための現場管理SaaS。工程・見積・写真を1画面に集約。
          </p>
          <HeroEmailCta />
          <p className="mt-4 text-sm text-brand-300">クレジットカード不要 / 14日間無料 / 即日利用開始</p>
        </div>
      </section>

      {/* 実画面スクショ挿入枠。LCP画像(fetchPriority=high, 票995h2で最適化済み)を含むため
          余白は変更しない(py-12のまま)。上下paddingを動かすとLCP画像のfold内可視面積が
          変わりLCPが悪化する実測を確認(laporta-beads-c6skn, 6728ms→8090ms)。 */}
      <section className="bg-slate-50 px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 max-w-2xl">
            <p className="text-sm font-semibold text-brand-600">実際の画面</p>
            <h2 className="lp-editorial-heading mt-2 text-2xl text-slate-900 sm:text-3xl">現場の情報を、見える形に。</h2>
            <p className="mt-3 text-slate-500">デモではなく、日々の案件管理と見積作成に使う画面です。</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <figure className="overflow-hidden rounded-2xl border border-brand-200 bg-white genba-flat-card">
              <img
                src="/lp/screen-dashboard.png"
                alt="LapoSite 今日のダッシュボード画面"
                fetchPriority="high"
                className="aspect-[16/15] w-full bg-brand-50 object-contain object-top"
              />
              <figcaption className="border-t border-brand-100 px-5 py-4">
                <p className="font-semibold text-slate-700">今日のダッシュボード</p>
                <p className="mt-1 text-sm text-slate-500">進行中案件・タスク・天気をひと目で確認</p>
              </figcaption>
            </figure>
            <figure className="overflow-hidden rounded-2xl border border-brand-200 bg-white genba-flat-card">
              <img
                src="/lp/screen-estimate.png"
                alt="LapoSite 見積作成画面（PDFから作成/手動で作成）"
                loading="lazy"
                className="aspect-[16/15] w-full bg-brand-50 object-contain object-top"
              />
              <figcaption className="border-t border-brand-100 px-5 py-4">
                <p className="font-semibold text-slate-700">PDF見積→自動積算</p>
                <p className="mt-1 text-sm text-slate-500">業者PDFをドロップするだけで金額を自動集計</p>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* 月15時間が消える根拠 */}
      <section className="bg-white px-4 py-editorial-md sm:px-6">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 text-center">
            <h2 className="lp-editorial-heading text-2xl text-slate-900">月15時間が消える</h2>
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
      <section id="features" className="bg-slate-50 px-4 py-editorial-xl sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 max-w-2xl">
            <h2 className="lp-editorial-heading text-2xl text-slate-900 sm:text-3xl">内装工事に特化した4つの強み</h2>
            <p className="mt-3 text-slate-500">汎用ツールでは対応できない内装工種・積算・写真管理をカバー。内装工事会社のために作られています。</p>
          </div>
          <div className="grid overflow-hidden rounded-2xl border border-brand-200 bg-white sm:grid-cols-2">
            {features.map((f, index) => (
              <article
                key={f.title}
                className={`grid grid-cols-[auto_1fr] gap-4 p-6 sm:p-8 ${
                  index < 2 ? "border-b border-brand-100" : ""
                } ${index % 2 === 0 ? "sm:border-r sm:border-brand-100" : ""}`}
              >
                <span className="figure-hero text-2xl font-semibold text-brand-300">0{index + 1}</span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{f.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section id="comparison" className="bg-white px-4 py-editorial-xl sm:px-6">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <h2 className="lp-editorial-heading text-2xl text-slate-900 sm:text-3xl">内装工事会社に選ばれる理由</h2>
            <p className="mt-3 text-slate-500">
              汎用現場管理ツールは多業種向けのため、内装特有の工種・積算・写真管理に対応するには別途カスタマイズが必要です。
              LapoSite は内装工事向けに最初から設計されています。
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-brand-200 bg-white genba-flat-card">
            <table className="min-w-[700px] w-full text-left text-sm">
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

          {/* Generic AI comparison */}
          <div className="mt-14">
            <div className="mb-8 max-w-2xl">
              <h3 className="lp-editorial-heading text-2xl text-slate-900">ChatGPT等の汎用AIとの違い</h3>
              <p className="mt-3 text-slate-500">
                汎用AIは何でもできる代わりに、何をさせるかを言葉にできる人しか使いこなせません。
                LapoSiteは、AIを使いこなす能力が要らないAIです。
              </p>
            </div>
            <div className="overflow-hidden rounded-2xl bg-brand-800 text-white">
              {[
                ["要る能力", "指示の上手さで成果が変わる", "写真を送る、喋るだけで使える"],
                ["残るもの", "返答がチャットに流れていく", "工程表・日報・請求書として残る"],
                ["効く範囲", "使った本人だけが楽になる", "全員が使う会社の仕組みになる"],
              ].map(([title, generic, genbahub], index) => (
                <div
                  key={title}
                  className={`grid gap-4 px-5 py-6 sm:grid-cols-[0.65fr_1fr_1fr] sm:items-center sm:px-8 ${
                    index > 0 ? "border-t border-brand-700" : ""
                  }`}
                >
                  <h4 className="font-semibold text-brand-200">{title}</h4>
                  <p className="text-sm leading-relaxed text-brand-300">汎用AI: {generic}</p>
                  <p className="text-sm font-medium leading-relaxed text-white">LapoSite: {genbahub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="bg-white px-4 py-editorial-md sm:px-6">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-sm font-medium text-brand-600">内装工事会社からの声</p>
          <h2 className="lp-editorial-heading mb-10 text-2xl text-slate-900 sm:text-3xl">導入後に変わったこと</h2>
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <figure className="rounded-2xl bg-brand-50 p-8 sm:p-10">
              <blockquote className="lp-editorial-heading text-xl leading-9 text-slate-800 sm:text-2xl">
                "内装工程テンプレのおかげで、LGS〜クロス貼りまでの工程表が10分で完成。以前は Excel で2〜3時間かかっていました。"
              </blockquote>
              <figcaption className="mt-6 text-sm text-brand-700">都内内装施工会社 現場監督</figcaption>
            </figure>
            <div className="divide-y divide-brand-100 border-y border-brand-100">
              <figure className="py-6 lg:pt-2">
                <blockquote className="text-sm leading-7 text-slate-700">"PDF見積を貼るだけで積算でき、転記ミスがなくなりました。見積提出も早くなっています。"</blockquote>
                <figcaption className="mt-3 text-xs text-slate-400">リノベーション会社 代表</figcaption>
              </figure>
              <figure className="py-6">
                <blockquote className="text-sm leading-7 text-slate-700">"現場写真が自動分類されて日報に入るので、写真整理に追われなくなりました。"</blockquote>
                <figcaption className="mt-3 text-xs text-slate-400">内装工事会社 工事部長</figcaption>
              </figure>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-slate-50 px-4 py-editorial-xl sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 max-w-2xl">
            <h2 className="lp-editorial-heading text-2xl text-slate-900 sm:text-3xl">シンプルな料金体系</h2>
            <p className="mt-3 text-slate-500">14日間の無料トライアルでお試しの後、チームに合ったプランをお選びください。</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            {plans.filter((plan) => plan.highlight).map((plan) => (
              <div
                key={plan.name}
                className="relative rounded-2xl bg-brand-700 p-8 text-white sm:p-10"
              >
                <p className="text-sm font-medium text-brand-200">おすすめ / {plan.name}</p>
                <div className="mt-2 flex items-end gap-1">
                  <span className="text-4xl font-extrabold text-white sm:text-5xl">{plan.price}</span>
                  <span className="mb-1 text-sm text-brand-200">{plan.period}</span>
                </div>
                <p className="mt-2 text-sm text-brand-200">{plan.desc}</p>
                <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-sm">
                      <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent-400" />
                      <span className="text-brand-100">{feat}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={plan.ctaAction}
                  className="mt-8 w-full rounded-xl bg-white px-4 py-3 text-sm font-bold text-brand-700 hover:bg-brand-50"
                >
                  {plan.cta}
                </button>
              </div>
            ))}
            <div className="overflow-hidden rounded-2xl border border-brand-200 bg-white">
              {plans.filter((plan) => !plan.highlight).map((plan, index) => (
                <section key={plan.name} className={`p-6 sm:p-8 ${index > 0 ? "border-t border-brand-100" : ""}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-slate-500">{plan.name}</p>
                      <p className="mt-1 text-sm text-slate-500">{plan.desc}</p>
                    </div>
                    <p className="shrink-0 text-right">
                      <span className="text-2xl font-extrabold text-slate-900">{plan.price}</span>
                      <span className="block text-xs text-slate-400">{plan.period}</span>
                    </p>
                  </div>
                  <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                    {plan.features.slice(0, 4).map((feat) => (
                      <li key={feat} className="flex items-start gap-2 text-xs text-slate-600">
                        <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={plan.ctaAction}
                    className="mt-5 rounded-xl border border-brand-300 px-4 py-2.5 text-sm font-bold text-brand-700 hover:bg-brand-50"
                  >
                    {plan.cta}
                  </button>
                </section>
              ))}
            </div>
          </div>
          <p className="mt-6 text-center text-sm text-slate-400">
            大規模案件・エンタープライズのご相談は{" "}
            <a href="mailto:info@laporta.co.jp" className="text-brand-600 underline whitespace-nowrap">
              お問い合わせ
            </a>
            ください。
          </p>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="bg-brand-700 px-4 py-editorial-md text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="lp-editorial-heading text-2xl text-white sm:text-3xl">
            今すぐ無料で始めよう
          </h2>
          <p className="mt-3 text-brand-200">14日間の無料トライアル。カード登録不要。</p>
          <button
            onClick={() => navigate("/signup")}
            className="mt-6 rounded-xl bg-accent-400 px-8 py-3.5 text-base font-bold text-brand-900 hover:bg-accent-500"
          >
            無料トライアルを開始する
          </button>
        </div>
      </section>
      </main>

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
              <p className="mt-2 text-xs text-brand-400">
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
          <div className="mt-8 border-t border-brand-800 pt-6 text-center text-xs text-brand-400">
            &copy; {new Date().getFullYear()} 株式会社ラポルタ. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
