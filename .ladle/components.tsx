import type { GlobalProvider } from "@ladle/react";
import "../src/index.css";

// ponytail: 本番のTailwindエントリをそのまま読み込むだけ。認証/データ準備は
// この3コンポーネントがどちらも使わないため、Providerは素通しでよい。
export const Provider: GlobalProvider = ({ children }) => children;
