# invoice-ocr を claude CLI サブプロセス化する案 — 却下メモ

日付: 2026-04-19
対象: `api/invoice-ocr.ts` / `src/lib/invoice-ocr-handler.ts`
結論: **Vercel 本番では採用しない。現状の Anthropic Messages API 呼び出しを維持する。**

## 動機

ラポルタ運用ルール:
> AI機能はClaude Codeサブスク内処理、外部API課金禁止

これに沿って Anthropic Messages API (`x-api-key` による従量課金) を
`claude` CLI サブプロセス呼び出し (Max サブスク枠内) に置き換える案が
提起された。VW プラグイン (`/Users/koki/vw-plugin/vw_plugin/image_to_estimate.py`)
ではこのパターンが動作している。

## 技術的に Vercel Serverless では不可能

Vercel Serverless Function (Node.js) の実行環境には `claude` バイナリが
**存在しない**。バンドル/インストールする公式の導線も無い。

- `vercel.json` に `buildCommand` / `installCommand` はあるが、
  ランタイムへ任意バイナリを同梱する仕組みではない。
- `claude` CLI は対話認証 (`~/.claude/` にセッション) を前提にしており、
  ステートレスな Serverless 実行では毎回失敗する。
- ビルド時に `npm i -g @anthropic-ai/claude-code` しても、
  生成される関数バンドルには含まれない。
- `child_process.spawn("claude", ...)` は `ENOENT` で即死する。

つまり「Vercel serverless 関数から `claude -p` を実行する」は
アーキテクチャ的にブロックされている。

## 選択肢

| オプション | コスト | 実装難度 | 備考 |
|---|---|---|---|
| A. 現状維持（Messages API 従量） | 月数ドル程度（請求書 OCR の頻度次第） | 0 | 現行コードのまま。運用ルール違反だが小額。 |
| B. セルフホストAPIサーバ（光輝さんのMac等） | $0（Max枠内） | 中 | `/api/invoice-ocr` を別ホストに切り出し、フロントの向き先を切り替え。ノートPCが落ちると死ぬ。 |
| C. OCR を VW プラグイン側へ移設 | $0 | 中 | ブラウザから直接 VW プラグイン HTTP（ローカル）を叩く。社外配布時は不可。 |
| D. Vercel Sandbox / Fluid Compute で `claude` を同梱 | 要検証 | 高 | Firecracker microVM なら可能性あり。ただし `claude` の対話認証をどう通すかが未解決。 |

## 判断

**現時点では A（現状維持）。**

理由:
1. このアプリは社内業務用ではなくデプロイ先が Vercel 固定。
2. 請求書 OCR の実行頻度は 1 日数件程度で、Anthropic 従量課金も小さい。
3. B/C は UX を壊す（光輝さんの端末が起きてないと OCR が動かない）。
4. D は研究課題としては面白いが、MVP の優先度ではない。

運用ルール「API 課金禁止」を厳守したい場合は、
**OCR 機能を VW プラグイン（ローカル実行）側に移す**のが最も筋が良い。
その場合は本 API を廃止し、フロント側で「VW プラグイン必須」のガードを入れる。

## コード変更

**なし**。`api/invoice-ocr.ts` と `src/lib/invoice-ocr-handler.ts` は
現行の Messages API 呼び出しを維持する。
関連する認証 / レートリミット / サイズ上限の保護層も変更しない。

この判断は将来 Vercel Sandbox 等で覆る可能性があるため、
本ドキュメントを残して再検討の起点とする。
