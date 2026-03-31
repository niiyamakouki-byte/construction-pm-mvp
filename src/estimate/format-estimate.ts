import type { Estimate } from "./types";

/** 金額をカンマ区切りフォーマット */
function yen(n: number): string {
  return `¥${n.toLocaleString("ja-JP")}`;
}

/** 右寄せパディング */
function rpad(s: string, len: number): string {
  return s.padStart(len);
}

/** 見積書をテキスト形式にフォーマット */
export function formatEstimateText(est: Estimate): string {
  const w = 72;
  const sep = "─".repeat(w);
  const lines: string[] = [];

  lines.push("╔" + "═".repeat(w) + "╗");
  lines.push("║" + "御 見 積 書".padStart(w / 2 + 6).padEnd(w) + "║");
  lines.push("╚" + "═".repeat(w) + "╝");
  lines.push("");
  lines.push(`見積番号: ${est.id}`);
  lines.push(`作成日:   ${est.createdAt}`);
  lines.push(`有効期限: ${est.validUntil}`);
  lines.push("");
  lines.push(`物件名: ${est.propertyName}`);
  lines.push(`宛先:   ${est.clientName} 御中`);
  lines.push("");
  lines.push(
    `合計金額: ${yen(est.total)}（税込）`,
  );
  lines.push(sep);

  for (const section of est.sections) {
    lines.push("");
    lines.push(`■ ${section.categoryName}`);
    lines.push(
      "  コード     品名                           数量    単位    単価          金額",
    );
    lines.push("  " + "─".repeat(w - 2));

    for (const line of section.lines) {
      const code = line.code.padEnd(10);
      const name = line.name.padEnd(20);
      const qty = String(line.quantity).padStart(6);
      const unit = line.unit.padEnd(4);
      const price = rpad(yen(line.unitPrice), 12);
      const amount = rpad(yen(line.amount), 14);
      lines.push(`  ${code} ${name} ${qty} ${unit} ${price} ${amount}`);
    }

    lines.push("  " + "─".repeat(w - 2));
    lines.push(
      `  小計: ${rpad(yen(section.subtotal), 14)}`,
    );
  }

  lines.push("");
  lines.push(sep);
  lines.push(`直接工事費:                          ${rpad(yen(est.directCost), 14)}`);
  lines.push(
    `現場管理費 (${(est.managementFeeRate * 100).toFixed(0)}%):                     ${rpad(yen(est.managementFee), 14)}`,
  );
  lines.push(
    `一般管理費 (${(est.generalExpenseRate * 100).toFixed(0)}%):                      ${rpad(yen(est.generalExpense), 14)}`,
  );
  lines.push(sep);
  lines.push(`税抜合計:                            ${rpad(yen(est.subtotal), 14)}`);
  lines.push(
    `消費税 (${(est.taxRate * 100).toFixed(0)}%):                           ${rpad(yen(est.tax), 14)}`,
  );
  lines.push(sep);
  lines.push(`税込合計:                            ${rpad(yen(est.total), 14)}`);
  lines.push(sep);

  if (est.notes.length > 0) {
    lines.push("");
    lines.push("【備考】");
    for (const note of est.notes) {
      lines.push(`  ・${note}`);
    }
  }

  lines.push("");
  lines.push("株式会社ラポルタ");
  lines.push("東京都");
  lines.push("");

  return lines.join("\n");
}

/** 見積書をCSV形式にフォーマット */
export function formatEstimateCSV(est: Estimate): string {
  const rows: string[] = [];

  rows.push("見積番号,作成日,有効期限,物件名,宛先");
  rows.push(
    `${est.id},${est.createdAt},${est.validUntil},${est.propertyName},${est.clientName}`,
  );
  rows.push("");
  rows.push("カテゴリ,コード,品名,数量,単位,単価,金額,備考");

  for (const section of est.sections) {
    for (const line of section.lines) {
      rows.push(
        [
          section.categoryName,
          line.code,
          line.name,
          line.quantity,
          line.unit,
          line.unitPrice,
          line.amount,
          line.note,
        ].join(","),
      );
    }
  }

  rows.push("");
  rows.push(`直接工事費,,,,,,${est.directCost},`);
  rows.push(
    `現場管理費(${(est.managementFeeRate * 100).toFixed(0)}%),,,,,,${est.managementFee},`,
  );
  rows.push(
    `一般管理費(${(est.generalExpenseRate * 100).toFixed(0)}%),,,,,,${est.generalExpense},`,
  );
  rows.push(`税抜合計,,,,,,${est.subtotal},`);
  rows.push(`消費税(${(est.taxRate * 100).toFixed(0)}%),,,,,,${est.tax},`);
  rows.push(`税込合計,,,,,,${est.total},`);

  return rows.join("\n");
}

/** 見積書をJSON形式で出力 */
export function formatEstimateJSON(est: Estimate): string {
  return JSON.stringify(est, null, 2);
}
