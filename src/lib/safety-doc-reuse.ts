/**
 * 安全書類の現場間再利用モジュール（Buildee蒸留）
 * 作業員名簿・新規入場教育・作業計画書・KYシート・リスクアセスメント等の
 * テンプレートを現場をまたいで再利用する機能を提供する。
 */
import { escapeHtml } from "./utils/escape-html";

// ── Types ──────────────────────────────────────────

/** 安全書類の種別 */
export type SafetyDocType =
  | "worker-roster"         // 作業員名簿
  | "new-entry-education"   // 新規入場教育記録
  | "work-plan"             // 作業計画書
  | "ky-sheet"              // KYシート（危険予知活動）
  | "risk-assessment";      // リスクアセスメント

/** 安全書類テンプレートのフィールド（キーバリュー形式） */
export type SafetyDocFields = Record<string, string | string[] | boolean | number>;

/**
 * 安全書類テンプレート
 * reusable=true のドキュメントは他の現場でひな形として利用できる。
 */
export type SafetyDocTemplate = {
  id: string;
  type: SafetyDocType;
  projectId: string;   // 作成元現場ID
  orgId: string;       // 組織ID（協力会社・元請）
  fields: SafetyDocFields;
  createdAt: string;   // ISO datetime
  reusable: boolean;
};

/** バリデーションエラー情報 */
export type SafetyDocValidationError = {
  field: string;
  message: string;
};

// ── 必須フィールド定義 ────────────────────────────

/**
 * 書類種別ごとの必須フィールド名。
 */
const REQUIRED_FIELDS: Record<SafetyDocType, string[]> = {
  "worker-roster": ["projectName", "companyName", "workerName", "role"],
  "new-entry-education": ["projectName", "workerName", "educationDate", "instructor"],
  "work-plan": ["projectName", "workDescription", "startDate", "supervisor"],
  "ky-sheet": ["projectName", "workDate", "hazards", "countermeasures"],
  "risk-assessment": ["projectName", "assessmentDate", "riskItems", "approvedBy"],
};

/**
 * 工事種別ごとに必要な安全書類の種別リスト。
 */
const REQUIRED_DOCS_BY_PROJECT_TYPE: Record<string, SafetyDocType[]> = {
  "内装": ["worker-roster", "new-entry-education", "ky-sheet"],
  "新築": ["worker-roster", "new-entry-education", "work-plan", "ky-sheet", "risk-assessment"],
  "リノベーション": ["worker-roster", "new-entry-education", "ky-sheet", "risk-assessment"],
  "解体": ["worker-roster", "new-entry-education", "work-plan", "risk-assessment"],
  "設備": ["worker-roster", "new-entry-education", "ky-sheet"],
  "default": ["worker-roster", "new-entry-education"],
};

// ── In-memory store ────────────────────────────────

const templates: SafetyDocTemplate[] = [];
let templateCounter = 0;

// ── Functions ──────────────────────────────────────

/**
 * テンプレートを元に新しい現場用の安全書類を作成する。
 * projectId を上書きし、projectName フィールドをクリアして返す。
 */
export function createSafetyDocFromTemplate(
  templateId: string,
  targetProjectId: string,
): SafetyDocTemplate {
  const tmpl = templates.find((t) => t.id === templateId);
  if (!tmpl) throw new Error(`テンプレートが見つかりません: id=${templateId}`);
  if (!tmpl.reusable) throw new Error(`このテンプレートは再利用不可です: id=${templateId}`);
  if (!targetProjectId) throw new Error("targetProjectId は必須です");

  templateCounter += 1;
  const newDoc: SafetyDocTemplate = {
    ...tmpl,
    id: `safety-doc-${templateCounter}`,
    projectId: targetProjectId,
    // 現場固有フィールドをリセット（projectNameは転用先で設定する）
    fields: {
      ...tmpl.fields,
      projectName: "",
    },
    createdAt: new Date().toISOString(),
    reusable: false, // コピー先は再利用不可（意図的な再利用のみ許可）
  };
  templates.push(newDoc);
  return newDoc;
}

/**
 * 組織IDで再利用可能な安全書類テンプレート一覧を返す。
 * docType を指定すると種別でフィルタリングする。
 */
export function listReusableTemplates(
  orgId: string,
  docType?: SafetyDocType,
): SafetyDocTemplate[] {
  return templates.filter(
    (t) =>
      t.orgId === orgId &&
      t.reusable &&
      (docType === undefined || t.type === docType),
  );
}

/**
 * テンプレートのフィールドと上書き値をマージする。
 * override が優先される。
 */
export function mergeSafetyDocFields(
  template: SafetyDocTemplate,
  overrides: SafetyDocFields,
): SafetyDocFields {
  return { ...template.fields, ...overrides };
}

/**
 * 安全書類のHTMLを生成する（印刷用）。
 */
export function buildSafetyDocHtml(doc: SafetyDocTemplate): string {
  const titleMap: Record<SafetyDocType, string> = {
    "worker-roster": "作業員名簿",
    "new-entry-education": "新規入場者教育記録",
    "work-plan": "作業計画書",
    "ky-sheet": "KYシート（危険予知活動）",
    "risk-assessment": "リスクアセスメント",
  };

  const title = titleMap[doc.type];
  const generatedAt = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const fieldRows = Object.entries(doc.fields)
    .map(([key, value]) => {
      const displayValue = Array.isArray(value)
        ? value.join("、")
        : String(value ?? "");
      return `<tr>
  <th>${escapeHtml(key)}</th>
  <td>${escapeHtml(displayValue)}</td>
</tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: "Hiragino Sans", "Yu Gothic", sans-serif; margin: 20px; color: #333; font-size: 13px; }
    h1 { font-size: 1.4em; border-bottom: 2px solid #1e293b; padding-bottom: 6px; margin-bottom: 12px; }
    .meta { font-size: 0.85em; color: #64748b; margin-bottom: 14px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 12px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-weight: 600; width: 30%; }
    tr:nth-child(even) { background: #f8fafc; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">現場ID: ${escapeHtml(doc.projectId)} &nbsp;|&nbsp; 出力日: ${generatedAt}</div>
  <table>
    <tbody>
      ${fieldRows}
    </tbody>
  </table>
</body>
</html>`;
}

/**
 * 安全書類のバリデーション。
 * 種別ごとの必須フィールドが埋まっているか確認する。
 * エラーがなければ空配列を返す。
 */
export function validateSafetyDoc(doc: SafetyDocTemplate): SafetyDocValidationError[] {
  const required = REQUIRED_FIELDS[doc.type] ?? [];
  const errors: SafetyDocValidationError[] = [];

  for (const field of required) {
    const val = doc.fields[field];
    const isEmpty =
      val === undefined ||
      val === null ||
      val === "" ||
      (Array.isArray(val) && val.length === 0);
    if (isEmpty) {
      errors.push({ field, message: `${field} は必須です` });
    }
  }

  return errors;
}

/**
 * 工事種別から必要な安全書類の種別リストを返す。
 * 未定義の工事種別は "default" にフォールバックする。
 */
export function getRequiredDocTypes(projectType: string): SafetyDocType[] {
  return REQUIRED_DOCS_BY_PROJECT_TYPE[projectType] ?? REQUIRED_DOCS_BY_PROJECT_TYPE["default"];
}

// ── Template store helpers ─────────────────────────

/**
 * テンプレートを登録する（テスト・セットアップ用）。
 */
export function addSafetyDocTemplate(
  template: Omit<SafetyDocTemplate, "id" | "createdAt">,
): SafetyDocTemplate {
  templateCounter += 1;
  const newTemplate: SafetyDocTemplate = {
    ...template,
    id: `safety-doc-${templateCounter}`,
    createdAt: new Date().toISOString(),
  };
  templates.push(newTemplate);
  return newTemplate;
}

// ── Reset (for testing) ────────────────────────────

export function _resetSafetyDocStore(): void {
  templates.length = 0;
  templateCounter = 0;
}
