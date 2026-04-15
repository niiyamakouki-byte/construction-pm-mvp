# freee 連携 Phase 2 設計書 — Invoice Repository フック追加

## 概要

Phase 1（本スケルトン）は freee API クライアントと照合ロジックを準備した。
Phase 2 では GenbaHub の既存 Invoice Repository / Project ストアに freee 連携フックを追加する。
**実APIキー取得後に着手すること。**

---

## 1. Invoice Repository フック

### 変更対象

`src/lib/invoice-store.ts`

### 追加フック

```ts
// 請求書作成時に freee の Invoice と照合する
export async function addInvoiceWithFreeeSync(
  data: Omit<Invoice, "id">,
  freeeClient: FreeeClient,
  companyId: number,
): Promise<{ invoice: Invoice; matchResult: MatchResult }> {
  const invoice = addInvoice(data);
  const [matchResult] = await matchInvoices(freeeClient, companyId, [invoice]);
  return { invoice, matchResult: matchResult! };
}
```

`addInvoiceWithFreeeSync` は `addInvoice` をラップする形で実装し、
既存の呼び出し側を壊さない。

### 照合結果の保存先

| matchType    | アクション                          |
|-------------|--------------------------------------|
| exact        | `updateInvoiceStatus(id, "振込済")` |
| amount_only  | 管理者 UI に候補として表示           |
| none         | 保留のまま（手動確認待ち）           |

---

## 2. Project Store フック

### 変更対象

`src/stores/projectStore.ts`（もしくは React Query mutation）

### 追加フック

```ts
// 案件作成時に freee へ Deal を自動同期する
async function createProjectWithFreeeSync(
  input: CreateProjectInput,
  freeeClient: FreeeClient,
  companyId: number,
): Promise<{ project: Project; syncResult: SyncResult }> {
  const project = await createProject(input);
  const syncResult = await syncProjectToFreee(freeeClient, companyId, project);
  return { project, syncResult };
}
```

### エラーハンドリング方針

- freee 側エラーでも GenbaHub 側のプロジェクト作成は成功させる（非同期・非ブロッキング）
- `SyncResult.status === "error"` の場合は Discord 通知 or UI バナーで警告

---

## 3. 経費レポート統合

### 呼び出し例

```ts
// 案件詳細ページの収支タブ
const report = await generateProjectExpenseReport(
  freeeClient,
  companyId,
  project.id,
  { from: new Date(project.startDate), to: new Date() },
);
```

### UI 表示案

```
売上高:   ¥1,000,000
原価合計: ¥  600,000
──────────────────
粗利:     ¥  400,000 (40.0%)

内訳:
  売上高      ¥1,000,000
  材料費      ¥  400,000
  外注費      ¥  200,000
```

---

## 4. 環境変数

| 変数名                | 説明                          | 取得方法                            |
|-----------------------|-------------------------------|-------------------------------------|
| `FREEE_ACCESS_TOKEN`  | OAuth2 アクセストークン        | freee Developer Console → アプリ登録 |
| `FREEE_COMPANY_ID`    | 事業所 ID（数値）              | getCompanies() で確認               |

Vercel の場合:

```bash
vercel env add FREEE_ACCESS_TOKEN production
vercel env add FREEE_COMPANY_ID production
```

---

## 5. テスト戦略（Phase 2）

- E2E: Vitest + MSW で freee API をモック
- 統合テスト: `addInvoiceWithFreeeSync` のゴールデンパステスト
- カオステスト: freee API タイムアウト、503 応答、重複 Deal の冪等性

---

## 6. Phase 2 実装順序

1. `FREEE_ACCESS_TOKEN` 環境変数をローカル `.env.local` に設定
2. `FreeeClient` の実動作確認（`getCompanies()` でIDを確認）
3. `addInvoiceWithFreeeSync` を `invoice-store.ts` に追加
4. `createProjectWithFreeeSync` を Project mutation に追加
5. 管理 UI に freee 同期状態バッジを追加
6. Vercel 本番環境に環境変数を設定してデプロイ
