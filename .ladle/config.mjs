/**
 * Ladle設定。認証・データ準備なしでコンポーネント単体を実ブラウザ表示するための開発用プレビュー環境。
 * viteConfigは本番のvite.config.tsをそのまま再利用し(react/tailwindcssプラグインを共有)、
 * 設定の二重管理を避ける。詳しい使い方は docs/component-preview.md を参照。
 * @type {import('@ladle/react').UserConfig}
 */
export default {
  viteConfig: "./vite.config.ts",
};
