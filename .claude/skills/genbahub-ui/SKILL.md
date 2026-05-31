---
name: genbahub-ui
description: GenbaHub の UI/フロントエンドを書くときの設計憲法。セージグリーン単色アクセントのエディトリアル・ミニマリズム。装飾を引き算し、余白とフォント階層で見せる。グラデ・濃い影・装飾絵文字を禁止。Laporta adaptation of taste-skill/minimalist-skill (MIT, Leonxlnx).
---

# GenbaHub UI 設計憲法（Premium Minimalism × 和の引き算）

GenbaHub（内装特化の施工管理SaaS）の画面を書く・直す・設計するときは必ずこのルールに従う。
判断基準: **「光輝さんがスマホで見て3秒で意図が伝わるか」**。伝わらないなら情報を削る。

base: taste-skill `minimalist-skill`（MIT, Leonxlnx）をラポルタの v2-cozy 方針に合わせて改変。
最大の改変点 = **アクセントは「セージグリーン1色」のみ**。元スキルの4パステル多色運用は禁止。

## 1. 絶対禁止（Banned）
- グラデーション、ネオン色、3D glassmorphism（ナビバーの微ブラーのみ可）
- Tailwind 既定の濃い影（`shadow-md`/`lg`/`xl`）。影は実質ゼロか、極薄（opacity < 0.05）に限る
- 大きな要素・セクションへの原色ベタ塗り背景（青/緑/赤のヒーロー塗りつぶし禁止）
- 大きなコンテナ・カード・主要ボタンの `rounded-full`（pill）。pillはタグ/バッジだけ
- **本文・コード・見出し・alt の装飾絵文字**（✨🌿🎨等）。アイコン or SVGに置換。絵文字はヘッダー集中の最小限のみ
- AI臭いコピー: 「Elevate」「Seamless」「Unleash」「Next-Gen」「Game-changer」/ 日本語の冗長敬語「〜していただけます」。短く具体的に書く
- `John Doe`/`Acme`/`Lorem Ipsum` 等のダミー名。現場・施主・工程の文脈に沿った実データ調で

## 2. カラー（セージ単色 + ウォームモノクローム）
色は希少資源。意味のある用途だけに使う。
- 背景: 純白 `#FFFFFF` or ウォームオフホワイト `#F7F6F3` / `#FBFBFA`
- カード面: `#FFFFFF` or `#F9F9F8`
- 境界線/区切り: 極薄グレー `#EAEAEA` or `rgba(0,0,0,0.06)`
- **アクセント = セージグリーン 1色のみ**:
  - 淡セージ背景: `#EDF3EC`（文字/アイコン: `#346538`）
  - これをタグ・インラインコード背景・アイコン下地・選択状態に使う
  - 赤/青/黄の他パステルは**使わない**（ステータス色分けが本当に必要な箇所だけ例外、最小限）
- 本文文字: 絶対黒(`#000`)禁止。チャコール `#2F3437`、`line-height: 1.6`。補助テキストは `#787774`

## 3. タイポグラフィ（極端なコントラストで魅せる）
- 本文/UI/ボタン: `'SF Pro Display','Geist Sans','Helvetica Neue', sans-serif`（Inter/Roboto/Open Sans 禁止）
- 見出し/引用(エディトリアル): `'Newsreader','Instrument Serif', serif`、`letter-spacing:-0.02em〜-0.04em`、`line-height:1.1`
- 数値/工程ID/金額/コード: `'Geist Mono','SF Mono', monospace`

## 4. コンポーネント
- Bentoグリッド: 非対称CSS Grid。カードは `border:1px solid #EAEAEA`、`border-radius:8〜12px`、内側padding `24〜40px`
- 主CTAボタン: 背景 `#111111` / 文字 `#FFF`、`border-radius:4〜6px`、影なし。hoverは `#333` か `scale(0.98)`
- タグ/バッジ: pill(`border-radius:9999px`)、`text-xs`、大文字＋`letter-spacing:0.05em`、下地は淡セージ
- アコーディオン(FAQ等): 箱を剥がし `border-bottom:1px solid #EAEAEA` だけで区切る。トグルは `+`/`-` アイコン
- アイコン: Phosphor(Bold/Fill) or Radix。線幅を全体で統一（細線Lucide/Feather 既定は避ける）

## 5. モーション（v2-cozy基準で短く）
- スクロール入場: `translateY(12px)`+`opacity:0` → `200ms`程度（元スキルの600msは重いので短縮）、`cubic-bezier(0.16,1,0.3,1)`、`IntersectionObserver`使用
- hover: カードは極薄影 `0 2px 8px rgba(0,0,0,0.04)` を `150〜200ms`。ボタンは `:active` で `scale(0.98)`
- アニメは `transform`/`opacity` のみ（layout誘発プロパティ禁止）。重さの原因なら即削除

## 6. 実装プロトコル
1. まずマクロ余白を確保（セクション間 `py-24`〜`py-32`）
2. 本文幅を `max-w-4xl`〜`max-w-5xl` に制約
3. タイポ階層とモノクローム+セージのカラー変数を最初に適用
4. 全カード/区切り/境界を `1px solid #EAEAEA` で統一
5. 主要ブロックにスクロール入場（短め）を付与
6. 空っぽに見えるフラット背景は避けるが、装飾は最小限で
