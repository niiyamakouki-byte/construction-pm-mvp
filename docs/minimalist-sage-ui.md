# GenbaHub Minimalist Sage UI

作成日: 2026-06-01
対象: GenbaHub / construction-pm-mvp

## 目的

GenbaHubのUIを「情報が3秒で入る」方向へ固定する。装飾で見せるのではなく、余白・文字階層・一貫した単色アクセントで見せる。

## 基本原則

- アクセント色はセージ1系統のみ使う。
- ブランド基準色は `#EDF3EC` と `#346538` を中心に組む。
- グラデーションは禁止。
- glassmorphism、重いぼかし、濃い影は禁止。
- 絵文字を本文、見出し、コード、ラベルで使わない。
- コピーは平文優先にし、AI臭い表現を避ける。
- 強調は色数ではなく、余白、太さ、サイズ差で作る。

## 許可トークン

- Primary background tint: `#EDF3EC`
- Primary text/accent: `#346538`
- Brand scale: `--color-brand-50` から `--color-brand-900`
- Neutral surfaces: `white`, `slate`, `zinc` 系の低彩度のみ

## 禁止パターン

- `bg-[linear-gradient(...)]`
- `bg-gradient-*`
- `backdrop-blur-*`
- `shadow-xl`, `shadow-2xl`
- 複数の装飾アクセントを同一カードに重ねること
- 青を主役にした CTA、警告以外の黄、意味のない紫

## 実装ルール

- セクション間余白は `py-24` から `py-32` を基準に考える。
- カードは原則 `border + bg-white`。影は `shadow-sm` まで。
- CTA は `brand-700` を基準にし、hover も濃淡差だけで見せる。
- 状態色は例外として保持してよいが、情報強調の主役には使わない。
- 新規ページ追加時は、まず単色・無グラデ・低影で組み、後から装飾を足さない。

## 導入メモ

今回の導入では、まず `src/index.css` のブランド基準色をセージへ変更した。既存ページに残る青・黄・紫やグラデーションは、画面単位で順次解消する。
