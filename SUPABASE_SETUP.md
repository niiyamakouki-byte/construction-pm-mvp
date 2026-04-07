# GenbaHub — Supabase セットアップ手順

帰宅後にこの手順を上から順番に実行するだけで接続完了します。エンジニアでなくても大丈夫です。

---

## 前提条件

- [Supabase](https://supabase.com) アカウント（無料プランで利用可能）
- Node.js 18 以上がインストール済み
- pnpm がインストール済み（未インストールなら `npm i -g pnpm`）

---

## ステップ 1：Supabase プロジェクトを作成する

1. [https://supabase.com/dashboard](https://supabase.com/dashboard) にアクセスしてログイン
2. 右上の **「New project」** ボタンをクリック
3. 以下を入力して **「Create new project」** をクリック
   - **Name**（プロジェクト名）: `genbahub` など任意
   - **Database Password**: 安全なパスワードを設定（メモしておく）
   - **Region**: `Northeast Asia (Tokyo)` を選択
4. 作成完了まで約 1〜2 分待つ（画面に緑のチェックが出たら完了）

---

## ステップ 2：データベースのスキーマを作成する

1. 左メニューの **「SQL Editor」** をクリック
2. **「New query」** をクリックして空のエディタを開く
3. このプロジェクトの `db/schema.sql` ファイルの内容を全選択してコピー
4. SQL エディタに貼り付けて **「Run」** ボタンをクリック
5. 「Success. No rows returned」と表示されれば完了

> 「already exists」エラーが出ても無視して OK。テーブルがすでに存在するだけです。

---

## ステップ 3：API キーをコピーする

1. 左メニュー下部の **「Project Settings」**（歯車アイコン）をクリック
2. **「API」** タブをクリック
3. 以下の 2 つをコピーしてメモ帳に貼り付けておく
   - **Project URL**（例: `https://abcdefg.supabase.co`）
   - **anon public** キー（長い文字列。`eyJ...` で始まる）

> `service_role` キーは使いません。**anon** キーのみ使用します。

---

## ステップ 4：.env.local ファイルを作成する

プロジェクトルート（`construction-pm-mvp/` フォルダ直下）に `.env.local` という名前のファイルを作成し、以下を記入します。

```env
USE_SUPABASE=true
SUPABASE_URL=（ステップ3でコピーした Project URL）
SUPABASE_ANON_KEY=（ステップ3でコピーした anon キー）
API_KEY=任意の長い文字列（例: my-secret-key-12345）

# フロントエンド用（同じ値を VITE_ プレフィックスでも設定）
VITE_SUPABASE_URL=（ステップ3でコピーした Project URL）
VITE_SUPABASE_ANON_KEY=（ステップ3でコピーした anon キー）
```

ターミナルで以下を実行してテンプレートをコピーしてから編集する方法でも OK：

```bash
cp .env.example .env.local
```

---

## ステップ 5：開発サーバーを起動して確認する

```bash
pnpm install
pnpm dev
```

ブラウザで `http://localhost:5173` を開き、案件一覧が表示されれば接続成功です。

> 環境変数が未設定の場合はローカルストレージモードで動作します（データはブラウザのみ保存）。

---

## ステップ 6（任意）：サンプルデータを投入する

実際の画面でデータの見え方を確認したい場合、`db/seed.sql` を実行します。

1. Supabase の **「SQL Editor」** を開く
2. `db/seed.sql` の内容をコピーして貼り付け
3. **「Run」** をクリック

サンプルの案件・タスク・チームメンバーが追加されます。

---

## トラブルシューティング

### 「Supabase environment variables are missing」エラー

→ `.env.local` が存在するか確認。変数名が `SUPABASE_URL` / `SUPABASE_ANON_KEY` になっているか確認（`VITE_` プレフィックスも必要）。

### ページを開いてもデータが表示されない

→ Supabase ダッシュボードの **「Table Editor」** でテーブルが存在するか確認。存在しない場合はステップ 2 のスキーマ実行をやり直す。

### `pnpm dev` でポート 5173 が使えないエラー

→ 他のアプリが使用中の可能性。`pnpm dev -- --port 3000` で別ポートを指定。

### SQL エディタで「permission denied」エラー

→ Supabase プロジェクトの作成が完了していない可能性。ダッシュボードに戻り「Project is ready」の表示を確認してから再実行。

---

## ファイル構成（参考）

```
construction-pm-mvp/
├── .env.example          # 環境変数テンプレート
├── .env.local            # 実際の環境変数（自分で作成・Git管理外）
├── db/
│   ├── schema.sql        # テーブル定義（ステップ2で使用）
│   └── seed.sql          # サンプルデータ（ステップ6で使用）
└── src/
```
