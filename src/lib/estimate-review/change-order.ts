/**
 * 追加変更工事処理（DDC Phase 2）
 * 元見積との差分計算と変更理由の構造化記録
 */

export type EstimateItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

export type ChangeOrderItem = {
  type: "add" | "modify" | "delete";
  itemId: string;
  name: string;
  originalAmount: number;
  newAmount: number;
};

export type ChangeOrderRecord = {
  id: string;
  baseEstimateId: string;
  reason: string;
  requestedBy: string;
  requestedAt: string;
  items: ChangeOrderItem[];
  status: "draft" | "pending_approval" | "approved" | "rejected";
};

export type ChangeOrderDiff = {
  items: ChangeOrderItem[];
  totalOriginal: number;
  totalNew: number;
  delta: number;
  deltaPct: number;
};

/**
 * 元見積と変更後見積を比較して差分を計算する
 */
export function calcChangeOrderDiff(
  originalItems: EstimateItem[],
  updatedItems: EstimateItem[],
): ChangeOrderDiff {
  const originalMap = new Map(originalItems.map((i) => [i.id, i]));
  const updatedMap = new Map(updatedItems.map((i) => [i.id, i]));

  const changeItems: ChangeOrderItem[] = [];

  // 変更・削除の検出
  for (const orig of originalItems) {
    const updated = updatedMap.get(orig.id);
    if (!updated) {
      changeItems.push({
        type: "delete",
        itemId: orig.id,
        name: orig.name,
        originalAmount: orig.amount,
        newAmount: 0,
      });
    } else if (updated.amount !== orig.amount) {
      changeItems.push({
        type: "modify",
        itemId: orig.id,
        name: orig.name,
        originalAmount: orig.amount,
        newAmount: updated.amount,
      });
    }
  }

  // 追加の検出
  for (const updated of updatedItems) {
    if (!originalMap.has(updated.id)) {
      changeItems.push({
        type: "add",
        itemId: updated.id,
        name: updated.name,
        originalAmount: 0,
        newAmount: updated.amount,
      });
    }
  }

  const totalOriginal = originalItems.reduce((s, i) => s + i.amount, 0);
  const totalNew = updatedItems.reduce((s, i) => s + i.amount, 0);
  const delta = totalNew - totalOriginal;
  const deltaPct =
    totalOriginal > 0 ? Math.round((delta / totalOriginal) * 10000) / 100 : 0;

  return { items: changeItems, totalOriginal, totalNew, delta, deltaPct };
}

/**
 * 変更工事記録を生成する（承認ワークフロー用）
 */
export function createChangeOrderRecord(
  id: string,
  baseEstimateId: string,
  reason: string,
  requestedBy: string,
  requestedAt: string,
  diff: ChangeOrderDiff,
): ChangeOrderRecord {
  return {
    id,
    baseEstimateId,
    reason,
    requestedBy,
    requestedAt,
    items: diff.items,
    status: "pending_approval",
  };
}
