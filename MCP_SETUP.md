# GenbaHub MCPサーバー セットアップ手順

## 概要

AIエージェント（Claude Code、Codexなど）がGenbaHubのSupabaseデータにアクセスできるMCPサーバーです。

## 利用可能なツール

| ツール名 | 説明 |
|---|---|
| `list_projects` | 全案件一覧を取得 |
| `get_project` | IDで案件を取得 |
| `create_project` | 新規案件を作成 |
| `update_project` | 案件を更新 |
| `list_tasks` | 案件のタスク一覧を取得 |
| `create_task` | タスクを作成 |
| `update_task` | タスクを更新 |
| `search_projects` | キーワードで案件を検索 |

## Claude Code への追加方法

`~/.claude/settings.json` を開き、`mcpServers` セクションに以下を追加してください：

```json
{
  "mcpServers": {
    "genbahub": {
      "type": "stdio",
      "command": "node",
      "args": ["--experimental-strip-types", "/Users/koki/construction-pm-mvp/src/mcp/genbahub-mcp-server.ts"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key"
      }
    }
  }
}
```

## 環境変数

| 変数名 | 説明 |
|---|---|
| `SUPABASE_URL` | SupabaseプロジェクトURL（Supabaseダッシュボード → Settings → API） |
| `SUPABASE_SERVICE_ROLE_KEY` | サービスロールキー（RLS をバイパスする管理者権限） |

> 注意: `SUPABASE_SERVICE_ROLE_KEY` は強力なキーです。外部に漏洩しないよう管理してください。

## ローカルでのテスト起動

```bash
cd ~/construction-pm-mvp
SUPABASE_URL=https://xxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your-key \
pnpm mcp:server
```

## pnpm での起動

```bash
pnpm mcp:server
```

（環境変数は事前に設定、または `.env` ファイル経由で注入してください）
