/**
 * 契約条項と見積の整合性チェック（DDC Phase 2）
 * 瑕疵担保/遅延損害金/追加工事条項/支払条件の4ポイントを確認する
 */

export type ContractClause = {
  defectWarrantyMonths: number;    // 瑕疵担保期間（月）
  delayPenaltyRatePct: number;     // 遅延損害金率（%/日）
  changeOrderClause: boolean;      // 追加工事条項の有無
  paymentTermDays: number;         // 支払条件（日）
};

export type EstimateForCheck = {
  totalAmount: number;             // 見積金額（円）
  warrantyMonths?: number;         // 見積書記載の保証期間
  paymentTermDays?: number;        // 見積書記載の支払条件
};

export type ClauseCheckResult = {
  defectWarranty: { ok: boolean; message: string };
  delayPenalty: { ok: boolean; message: string };
  changeOrder: { ok: boolean; message: string };
  paymentTerm: { ok: boolean; message: string };
  allOk: boolean;
};

/**
 * 請負契約の4重要条項と見積内容の整合性をチェックする
 */
export function checkContractClauses(
  clause: ContractClause,
  estimate: EstimateForCheck,
): ClauseCheckResult {
  // 瑕疵担保: 建設業法上、住宅は10年・一般工事は1年が基準
  const defectOk = clause.defectWarrantyMonths >= 12;
  const defectWarranty = {
    ok: defectOk,
    message: defectOk
      ? `瑕疵担保${clause.defectWarrantyMonths}ヶ月: 問題なし`
      : `瑕疵担保${clause.defectWarrantyMonths}ヶ月: 12ヶ月未満は要確認`,
  };

  // 遅延損害金: 0.1%/日超は施主有利すぎ、0%は請負側が無防備
  const penaltyOk =
    clause.delayPenaltyRatePct > 0 && clause.delayPenaltyRatePct <= 0.1;
  const delayPenalty = {
    ok: penaltyOk,
    message: penaltyOk
      ? `遅延損害金${clause.delayPenaltyRatePct}%/日: 適正範囲`
      : clause.delayPenaltyRatePct === 0
        ? "遅延損害金: 0%設定は請負側に不利"
        : `遅延損害金${clause.delayPenaltyRatePct}%/日: 0.1%超は高すぎ要交渉`,
  };

  // 追加工事条項: 存在しない場合、変更工事の費用回収が困難
  const changeOrder = {
    ok: clause.changeOrderClause,
    message: clause.changeOrderClause
      ? "追加工事条項: あり（問題なし）"
      : "追加工事条項: なし（追加工事時に費用回収リスク）",
  };

  // 支払条件: 見積書と契約書の整合確認
  const estimatePayment = estimate.paymentTermDays;
  let paymentOk = true;
  let paymentMessage = `支払条件${clause.paymentTermDays}日: 問題なし`;
  if (estimatePayment !== undefined && estimatePayment !== clause.paymentTermDays) {
    paymentOk = false;
    paymentMessage = `支払条件不一致: 見積${estimatePayment}日 vs 契約${clause.paymentTermDays}日`;
  } else if (clause.paymentTermDays > 60) {
    paymentOk = false;
    paymentMessage = `支払条件${clause.paymentTermDays}日: 60日超は資金繰りリスク`;
  }

  const allOk =
    defectWarranty.ok && delayPenalty.ok && changeOrder.ok && paymentOk;

  return { defectWarranty, delayPenalty, changeOrder, paymentTerm: { ok: paymentOk, message: paymentMessage }, allOk };
}
