# Codex Review — PR作成前の自動レビュー

## トリガー
タスク実装が完了し、CI green を確認した後、PR を作成する **前** にこのスキルを実行する。

## 手順

### Step 1: Codex にレビューを依頼
`--base main` とカスタムプロンプトは併用不可。`--base main` でデフォルトレビューを実行する。
```bash
codex exec review --base main --full-auto 2>&1 | tee /tmp/codex-review-result.txt
```

### Step 2: 結果を読んで判定
- `/tmp/codex-review-result.txt` を Read ツールで読む
- **重大なバグ・セキュリティ問題**の指摘がある → 修正して CI を再度 green にしてから Step 1 に戻る
- **軽微な改善提案**のみ → ユーザーに報告し、修正するか確認
- **問題なし** → そのまま PR 作成に進む

### Step 3: クリーンアップ
```bash
rm -f /tmp/codex-review-result.txt
```

## 注意事項
- `codex` CLI v0.98.0+ がインストール済みであること
- レビュー結果はユーザーに必ず表示すること（自動スキップ禁止）
- codex はリポジトリ全体にアクセスするので diff サイズの心配は不要
