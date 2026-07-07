# コンポーネント単体プレビュー(Ladle)

認証・Supabaseデータ準備なしで、UIコンポーネント単体を実ブラウザで確認するための開発用プレビュー環境。
[Ladle](https://www.ladle.dev/)（Storybook互換・Vite製で軽量）を使用。

## 起動

```bash
pnpm run preview:components
# = ladle serve (デフォルト http://localhost:61000/)
```

`vite.config.ts` をそのまま再利用する設定（`.ladle/config.mjs`）なので、react/tailwindcssプラグインは本番と共通。

## story の置き場所

対象コンポーネントと同じディレクトリに `ComponentName.stories.tsx` を置くと自動検出される
(`src/**/*.stories.{ts,tsx}`)。1ファイル内の named export = 1つのstory。

現状のstory:
- `src/components/PdfAnnotationLayer.stories.tsx` — 赤入れ描画レイヤー単体(マウスでドラッグして線を引ける)
- `src/components/PdfCanvasPreview.stories.tsx`
  - `Default` — PDFプレビュー本体(テスト用fixture PDFを表示)
  - `AnnotateToolbar` — 「赤入れ」を開いた状態(ペン種/色/消しゴム行を初期表示)

## 注意点

- 本番ビルド(`pnpm run build`)には story ファイル・Ladle設定は含まれない(エントリの import グラフに乗らないため)。ビルド後の `dist/` に `stories`/`ladle` の文字列が出ないことを確認済み。
- 認証コンテキストが必要なコンポーネントを追加する場合は `.ladle/components.tsx` の `Provider` に最小限のモックを足す(現状の3storyはどちらも認証contextを使わないため素通し)。
