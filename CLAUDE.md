## コスト最適化ルール（必ず従うこと）

### CLI優先の原則
- ファイル内容の確認は必ず cat/head/tail/less を先に使う
- 検索は grep -r / find / ag / rg を使う。推測でファイルを開かない
- ディレクトリ構造は ls -la / tree で把握してから行動する
- git log / git diff / git status で状況把握してからコードに触る
- pnpm test / pnpm lint の結果を見てから修正方針を決める

### 最小変更の原則
- コード変更は最小パッチ。ファイル全体の書き直し禁止
- 1つの変更で1つの目的。複数の修正を混ぜない
- 既存コードのスタイル・パターンに合わせる

### トークン節約
- 大量ファイルの調査は Explore（Haikuサブエージェント）に委譲
- 不要な説明・確認は省略。変更内容だけ簡潔に報告
- 同じファイルを何度も読み直さない
- コンテキストが膨らんだら /compact する

### ローカルツール優先（APIコスト削減）
- CLIで完結できる作業は全てCLIで処理（sed/awk/jq/curl/git等）
- コード生成・リファクタリングはllama等のローカルLLMに委譲
- 自分（Claude）の役割は「交換手」＝判断・指示出し・最終確認のみ
- 可能な限りAPI呼び出しを減らす。実行はローカルツール任せ

## 開発ワークフロー全体のルーティング

### コスト前提
- Claude Code CLI（Opus/Sonnet）= Max定額 → 遠慮なく使う
- Codex CLI = ChatGPT Plus定額 → 遠慮なく使う
- Gemini CLI = 無料枠 → 遠慮なく使う
- **OpenClaw API（Sonnet従量）= ここだけコスト注意**

### Phase 0: 調査・状況把握
- CLI直接: grep, find, git, tree, cat, pnpm test
- 全作業の起点。必ずここから始める

### Phase 1: 設計・アイデア出し
- AI会議: claude.ai壁打ち、方針・アーキテクチャ決定
- Claude Code Opus: 設計レビュー、アーキテクチャ判断
- Gemini CLI: セカンドオピニオン、別視点
- Explore（Haiku）: ファイル横断調査

### Phase 2: 実装
- **Codex CLI**: 新規ファイル、大量コード生成、テスト生成
- **Claude Code Opus**: 既存コードの理解と修正、複雑なロジック
- 使い分け:
  - ゴリゴリ新規で書く → Codex
  - 既存コード理解して直す → Claude Code

### Phase 3: 検証・レビュー
- CLI: pnpm test, lint, typecheck
- Claude Code Opus: コードレビュー（定額だから遠慮不要）
- Gemini: セカンドオピニオンレビュー
- Codex: テスト追加

### Phase 4: 自動パイプライン（OpenClaw経由）
※ここだけSonnet API従量課金
- Lobster workflow → 最小限のAPI呼び出しで完結させる
- taskctl CLIステップは Layer 0（コスト0）で処理
