# GenbaHub — Supabase セットアップ手順

このドキュメントでは、GenbaHub をローカル開発環境または本番環境で Supabase バックエンドに接続する手順を説明します。

---

## 前提条件

- [Supabase](https://supabase.com) アカウント（無料プランで利用可能）
- Node.js 18 以上
- pnpm（`npm i -g pnpm` でインストール）

---

## 1. Supabase プロジェクトを作成する

1. [https://supabase.com/dashboard](https://supabase.com/dashboard) にアクセスしてログイン
2. **"New project"** をクリック
3. プロジェクト名（例：`genbahub`）、データベースパスワード、リージョン（`Northeast Asia (Tokyo)`）を設定
4. **"Create new project"** をクリックして完了を待つ（約1〜2分）

---

## 2. 環境変数を設定する

プロジェクトルートに `.env.local` ファイルを作成し、以下を記入します。

```bash
cp .env.example .env.local
```

`.env.local` を編集：

```env
VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

**値の取得方法：**

1. Supabase ダッシュボードでプロジェクトを開く
2. 左メニュー → **"Project Settings"** → **"API"**
3. `Project URL` → `VITE_SUPABASE_URL` にコピー
4. `anon` `public` キー → `VITE_SUPABASE_ANON_KEY` にコピー

> ⚠️ `service_role` キーは絶対に `.env.local` に入れないでください。フロントエンドからは `anon` キーのみ使用します。

---

## 3. データベースのマイグレーションを実行する

Supabase ダッシュボードの **SQL エディタ** を使って、以下の順番でマイグレーションを実行します。

### ステップ 1：初期スキーマ

`supabase/migrations/001_initial_schema.sql` の内容をコピーして SQL エディタに貼り付け、**"Run"** をクリック。

作成されるテーブル：
- `projects` — 案件情報
- `tasks` — 工程タスク
- `resources` — リソース（人員・機材・資材）
- `cost_items` — コスト項目
- `set_updated_at` トリガー関数

### ステップ 2：GenbaHub 拡張スキーマ

`supabase/migrations/002_genba_hub_schema.sql` の内容をコピーして実行。

追加されるテーブル・カラム：
- `team_members` — チームメンバー
- `daily_reports` — 日報（写真URL対応）
- `estimates` — 見積明細
- `expenses` — 経費明細（承認ワークフロー付き）
- `projects` に `address`、`budget`、`latitude`、`longitude` カラムを追加
- `tasks` に `start_date`、`progress`、`dependencies` カラムを追加
- 全テーブルに Row Level Security (RLS) ポリシーを設定

---

## 4. 依存パッケージをインストールする

```bash
pnpm install
```

`@supabase/supabase-js` が `package.json` にすでに記載されているので、これだけで準備完了です。

---

## 5. 開発サーバーを起動する

```bash
pnpm dev
```

ブラウザで `http://localhost:5173` を開き、Supabase への接続を確認してください。

> **フォールバック動作について：**  
> `.env.local` に環境変数が設定されていない場合、アプリは自動的に `localStorage` ベースのストレージにフォールバックします（`src/infra/create-app-repository.ts` 参照）。Supabase なしでもローカルでの動作確認が可能です。

---

## テーブル構成の概要

| テーブル | 説明 | 主なカラム |
|---|---|---|
| `projects` | 案件（工事現場） | `name`, `status`, `start_date`, `end_date`, `address`, `budget` |
| `tasks` | 工程タスク | `project_id`, `name`, `status`, `assignee_id`, `due_date`, `progress` |
| `team_members` | チームメンバー | `name`, `role`, `email`, `phone` |
| `daily_reports` | 日報 | `project_id`, `report_date`, `weather`, `content`, `photo_urls` |
| `estimates` | 見積明細 | `project_id`, `item_name`, `quantity`, `unit_price`, `category` |
| `expenses` | 経費明細 | `project_id`, `expense_date`, `amount`, `category`, `approval_status` |

---

## RLS（行レベルセキュリティ）について

現在の設定（MVP段階）：

| ロール | 権限 |
|---|---|
| `authenticated`（ログイン済みユーザー） | 全テーブルの読み書き |
| `anon`（未認証） | `projects`, `tasks`, `daily_reports`, `estimates`, `expenses`, `team_members` の読み取りのみ |

本番運用時には、ユーザー単位の権限管理が必要な場合は `auth.uid()` を使ったポリシーへの変更を検討してください。

---

## トラブルシューティング

### 「Supabase environment variables are missing」エラーが出る

→ `.env.local` ファイルが存在するか、変数名が `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` になっているか確認してください。

### マイグレーション実行時に「already exists」エラーが出る

→ `CREATE TABLE IF NOT EXISTS` を使っているため無害です。エラーを無視して続行できます。

### データが保存されない / 読み込めない

→ Supabase ダッシュボードの **"Table Editor"** でテーブルが存在するか確認してください。存在しない場合はマイグレーションを再実行してください。

---

## 関連ファイル

```
construction-pm-mvp/
├── .env.example                        # 環境変数テンプレート
├── .env.local                          # 実際の環境変数（Git管理外）
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql      # 初期テーブル定義
│       └── 002_genba_hub_schema.sql    # GenbaHub 拡張スキーマ
└── src/infra/
    ├── supabase-client.ts              # Supabaseクライアント初期化・型定義
    ├── supabase-repository.ts          # Supabase対応リポジトリ実装
    ├── local-storage-repository.ts     # localStorageフォールバック
    ├── in-memory-repository.ts         # テスト用インメモリ実装
    └── create-app-repository.ts        # 環境に応じたリポジトリ自動選択
```
