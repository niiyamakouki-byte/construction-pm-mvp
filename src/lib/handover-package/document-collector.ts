/**
 * document-collector — 設備リストから自動でドキュメント雛形を生成する。
 *
 * Sprint 17-C: 引渡しパッケージ自動生成
 */

import type { HandoverDocument, HandoverDocumentKind } from "./types.js";

// ── Equipment dictionary ───────────────────────────────────────────────────

type EquipmentEntry = {
  /** 設備名 (部分一致検索用) */
  namePatterns: string[];
  /** 生成するドキュメント種別一覧 */
  documentKinds: HandoverDocumentKind[];
  /** 保証期間 (月) */
  warrantyMonths: number;
};

const EQUIPMENT_DICTIONARY: EquipmentEntry[] = [
  {
    namePatterns: ["エアコン", "空調", "エアーコンディショナー"],
    documentKinds: ["equipment_manual", "warranty_certificate"],
    warrantyMonths: 12,
  },
  {
    namePatterns: ["給湯器", "給湯機", "ガス湯沸し"],
    documentKinds: ["equipment_manual", "warranty_certificate"],
    warrantyMonths: 24,
  },
  {
    namePatterns: ["換気扇", "レンジフード", "換気"],
    documentKinds: ["equipment_manual", "warranty_certificate"],
    warrantyMonths: 12,
  },
  {
    namePatterns: ["IHコンロ", "IHクッキングヒーター", "電磁調理器"],
    documentKinds: ["equipment_manual", "warranty_certificate"],
    warrantyMonths: 12,
  },
  {
    namePatterns: ["ユニットバス", "バスユニット", "システムバス"],
    documentKinds: ["equipment_manual", "warranty_certificate"],
    warrantyMonths: 24,
  },
  {
    namePatterns: ["トイレ", "便器", "ウォシュレット", "温水洗浄便座"],
    documentKinds: ["equipment_manual", "warranty_certificate"],
    warrantyMonths: 12,
  },
  {
    namePatterns: ["インターホン", "インターフォン", "玄関子機"],
    documentKinds: ["equipment_manual", "warranty_certificate"],
    warrantyMonths: 12,
  },
  {
    namePatterns: ["洗面台", "洗面化粧台", "洗面ユニット"],
    documentKinds: ["equipment_manual", "warranty_certificate"],
    warrantyMonths: 12,
  },
  {
    namePatterns: ["システムキッチン", "キッチン", "台所"],
    documentKinds: ["equipment_manual", "warranty_certificate"],
    warrantyMonths: 24,
  },
  {
    namePatterns: ["床暖房", "床暖"],
    documentKinds: ["equipment_manual", "warranty_certificate"],
    warrantyMonths: 24,
  },
  {
    namePatterns: ["電気温水器", "エコキュート", "ヒートポンプ給湯"],
    documentKinds: ["equipment_manual", "warranty_certificate"],
    warrantyMonths: 24,
  },
  {
    namePatterns: ["太陽光発電", "ソーラーパネル", "PV"],
    documentKinds: ["equipment_manual", "warranty_certificate"],
    warrantyMonths: 120,
  },
  {
    namePatterns: ["蓄電池", "ホームバッテリー"],
    documentKinds: ["equipment_manual", "warranty_certificate"],
    warrantyMonths: 120,
  },
  {
    namePatterns: ["照明", "ダウンライト", "シーリングライト"],
    documentKinds: ["equipment_manual"],
    warrantyMonths: 12,
  },
  {
    namePatterns: ["鍵", "キー", "スマートロック", "電子錠"],
    documentKinds: ["key_handover_record"],
    warrantyMonths: 0,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function matchEquipment(equipmentName: string): EquipmentEntry | null {
  const lower = equipmentName.toLowerCase();
  for (const entry of EQUIPMENT_DICTIONARY) {
    if (entry.namePatterns.some((p) => lower.includes(p.toLowerCase()))) {
      return entry;
    }
  }
  return null;
}

let _docCounter = 0;

function newDocId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++_docCounter}`;
}

// ── Public API ─────────────────────────────────────────────────────────────

export type EquipmentInput = {
  name: string;
  maker?: string;
  model?: string;
};

/**
 * 設備リストから HandoverDocument[] の雛形を自動生成する。
 * completedAt: 工事完成日 (ISO 8601)
 */
export function collectDocumentsFromEquipment(
  equipment: EquipmentInput[],
  completedAt: string,
): HandoverDocument[] {
  const docs: HandoverDocument[] = [];
  const seen = new Set<string>();

  // Always add the base documents
  const baseKinds: HandoverDocumentKind[] = [
    "completion_inspection",
    "as_built_drawing",
    "aftercare_contact",
    "maintenance_schedule",
  ];

  for (const kind of baseKinds) {
    const key = `base:${kind}`;
    if (!seen.has(key)) {
      seen.add(key);
      docs.push({
        id: newDocId(kind),
        kind,
        titleJa: _baseTitleJa(kind),
        contentJa: _baseContentJa(kind),
      });
    }
  }

  for (const eq of equipment) {
    const entry = matchEquipment(eq.name);
    if (!entry) {
      // Unknown equipment — create a generic manual entry
      docs.push({
        id: newDocId("equipment_manual"),
        kind: "equipment_manual",
        titleJa: `${eq.name} 取扱説明書`,
        contentJa: `メーカー: ${eq.maker ?? "不明"}\nモデル: ${eq.model ?? "不明"}`,
      });
      continue;
    }

    for (const kind of entry.documentKinds) {
      const key = `${eq.name}:${kind}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const doc: HandoverDocument = {
        id: newDocId(kind),
        kind,
        titleJa: _equipmentDocTitle(eq, kind),
        contentJa: _equipmentDocContent(eq, entry, kind),
      };

      if (kind === "warranty_certificate" && entry.warrantyMonths > 0) {
        const completedDate = new Date(completedAt);
        const expiresDate = new Date(completedDate);
        expiresDate.setMonth(expiresDate.getMonth() + entry.warrantyMonths);
        doc.expiresAt = expiresDate.toISOString();
      }

      docs.push(doc);
    }
  }

  return docs;
}

function _baseTitleJa(kind: HandoverDocumentKind): string {
  switch (kind) {
    case "completion_inspection": return "完成検査報告書";
    case "as_built_drawing": return "竣工図面";
    case "aftercare_contact": return "アフターサービス連絡先一覧";
    case "maintenance_schedule": return "メンテナンススケジュール表";
    default: return kind;
  }
}

function _baseContentJa(kind: HandoverDocumentKind): string {
  switch (kind) {
    case "completion_inspection":
      return "完成検査を実施し、施工品質を確認しました。";
    case "as_built_drawing":
      return "施工後の実測に基づく竣工図面です。";
    case "aftercare_contact":
      return "工事担当者: 株式会社ラポルタ\n電話: 03-XXXX-XXXX\nメール: info@laporta.co.jp";
    case "maintenance_schedule":
      return "別途メンテナンススケジュール表をご参照ください。";
    default:
      return "";
  }
}

function _equipmentDocTitle(eq: EquipmentInput, kind: HandoverDocumentKind): string {
  switch (kind) {
    case "equipment_manual":
      return `${eq.name} 取扱説明書`;
    case "warranty_certificate":
      return `${eq.name} 保証書`;
    case "key_handover_record":
      return `${eq.name} 引渡し記録`;
    default:
      return `${eq.name} — ${kind}`;
  }
}

function _equipmentDocContent(
  eq: EquipmentInput,
  entry: EquipmentEntry,
  kind: HandoverDocumentKind,
): string {
  const lines: string[] = [];
  lines.push(`設備名: ${eq.name}`);
  if (eq.maker) lines.push(`メーカー: ${eq.maker}`);
  if (eq.model) lines.push(`型番: ${eq.model}`);

  if (kind === "warranty_certificate" && entry.warrantyMonths > 0) {
    lines.push(`保証期間: ${entry.warrantyMonths}ヶ月`);
  }

  return lines.join("\n");
}
