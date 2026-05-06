/**
 * Custom template engine — KANNA-style high-customizability form/checklist/report templates.
 * Pure TypeScript, no external dependencies.
 */

import { escapeHtml } from "./utils/escape-html.js";
import { createRepository } from "./repository/index.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FieldType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "multiselect"
  | "checkbox"
  | "photo"
  | "signature"
  | "location"
  | "calculation";

export type FieldDefinition = {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  defaultValue?: unknown;
  placeholder?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
  calculationFormula?: string;
};

export type TemplateCategory =
  | "daily_report"
  | "inspection"
  | "safety"
  | "delivery"
  | "handover"
  | "custom";

export type CustomTemplate = {
  id: string;
  name: string;
  category: TemplateCategory;
  version: number;
  fields: FieldDefinition[];
  orgId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type TemplateRecord = {
  id: string;
  templateId: string;
  projectId: string;
  data: Record<string, unknown>;
  status: "draft" | "submitted" | "approved" | "rejected";
  submittedBy: string;
  submittedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
};

export type TemplateValidationResult = {
  valid: boolean;
  errors: { fieldId: string; fieldLabel: string; message: string }[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Safe stack-based arithmetic evaluator for +,-,*,/,() — no eval/Function */
function safeEvaluate(expr: string): number {
  const tokens: string[] = expr.match(/(\d+\.?\d*|\.\d+|[+\-*/()])/g) ?? [];
  if (tokens.length === 0) return 0;
  let pos = 0;
  function peek() { return tokens[pos]; }
  function consume() { return tokens[pos++]; }
  function parseExpr(): number {
    let left = parseTerm();
    while (pos < tokens.length && (peek() === "+" || peek() === "-")) {
      const op = consume();
      const right = parseTerm();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }
  function parseTerm(): number {
    let left = parseFactor();
    while (pos < tokens.length && (peek() === "*" || peek() === "/")) {
      const op = consume();
      const right = parseFactor();
      left = op === "*" ? left * right : right !== 0 ? left / right : 0;
    }
    return left;
  }
  function parseFactor(): number {
    if (peek() === "(") { consume(); const val = parseExpr(); if (peek() === ")") consume(); return val; }
    if (peek() === "-") { consume(); return -parseFactor(); }
    const t = consume();
    return t ? parseFloat(t) || 0 : 0;
  }
  return parseExpr();
}

function validateFieldDefinition(field: FieldDefinition): void {
  if (!field.id || typeof field.id !== "string") {
    throw new Error(`Field id must be a non-empty string`);
  }
  if (!field.label || typeof field.label !== "string") {
    throw new Error(`Field "${field.id}" must have a non-empty label`);
  }
  const validTypes: FieldType[] = [
    "text",
    "number",
    "date",
    "select",
    "multiselect",
    "checkbox",
    "photo",
    "signature",
    "location",
    "calculation",
  ];
  if (!validTypes.includes(field.type)) {
    throw new Error(`Field "${field.id}" has unknown type "${field.type}"`);
  }
  if (
    (field.type === "select" || field.type === "multiselect") &&
    (!field.options || field.options.length === 0)
  ) {
    throw new Error(
      `Field "${field.id}" of type "${field.type}" must have at least one option`,
    );
  }
  if (field.type === "calculation" && !field.calculationFormula) {
    throw new Error(
      `Field "${field.id}" of type "calculation" must have a calculationFormula`,
    );
  }
}

// ---------------------------------------------------------------------------
// Template CRUD
// ---------------------------------------------------------------------------

/**
 * Create a custom template with field definition validation.
 */
export function createTemplate(
  name: string,
  category: TemplateCategory,
  fields: FieldDefinition[],
  orgId: string,
  createdBy: string,
): CustomTemplate {
  if (!name || typeof name !== "string") {
    throw new Error("Template name must be a non-empty string");
  }
  for (const field of fields) {
    validateFieldDefinition(field);
  }
  const now = new Date();
  return {
    id: generateId(),
    name,
    category,
    version: 1,
    fields: fields.map((f) => ({ ...f })),
    orgId,
    createdBy,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Return the four pre-built built-in templates.
 */
export function getBuiltInTemplates(): CustomTemplate[] {
  const now = new Date();
  const base = {
    orgId: "system",
    createdBy: "system",
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  const dailyReport: CustomTemplate = {
    ...base,
    id: "builtin-daily-report",
    name: "日報",
    category: "daily_report",
    fields: [
      { id: "date", label: "日付", type: "date", required: true },
      {
        id: "weather",
        label: "天気",
        type: "select",
        required: true,
        options: ["晴れ", "曇り", "雨", "雪"],
      },
      { id: "work_content", label: "作業内容", type: "text", required: true },
      {
        id: "worker_count",
        label: "作業人数",
        type: "number",
        required: true,
        validation: { min: 0 },
      },
      {
        id: "progress_rate",
        label: "進捗率",
        type: "number",
        required: true,
        validation: { min: 0, max: 100 },
      },
      {
        id: "safety_notes",
        label: "安全事項",
        type: "text",
        required: false,
      },
      { id: "photos", label: "写真", type: "photo", required: false },
      {
        id: "supervisor_sign",
        label: "所長サイン",
        type: "signature",
        required: true,
      },
    ],
  };

  const inspectionChecklist: CustomTemplate = {
    ...base,
    id: "builtin-inspection",
    name: "検収チェックリスト",
    category: "inspection",
    fields: [
      {
        id: "work_type",
        label: "工種",
        type: "text",
        required: true,
      },
      {
        id: "inspection_items",
        label: "検査項目",
        type: "checkbox",
        required: true,
      },
      { id: "photos", label: "写真", type: "photo", required: false },
      {
        id: "judgment",
        label: "判定",
        type: "select",
        required: true,
        options: ["合格", "不合格", "条件付合格"],
      },
      {
        id: "inspector_sign",
        label: "検査者サイン",
        type: "signature",
        required: true,
      },
    ],
  };

  const materialReceipt: CustomTemplate = {
    ...base,
    id: "builtin-material-receipt",
    name: "材料受入記録",
    category: "delivery",
    fields: [
      { id: "date", label: "日付", type: "date", required: true },
      { id: "vendor", label: "業者", type: "text", required: true },
      { id: "item_name", label: "品目", type: "text", required: true },
      {
        id: "quantity",
        label: "数量",
        type: "number",
        required: true,
        validation: { min: 0 },
      },
      {
        id: "quality_ok",
        label: "品質OK",
        type: "checkbox",
        required: true,
      },
      { id: "photos", label: "写真", type: "photo", required: false },
      {
        id: "receiver_sign",
        label: "受入者サイン",
        type: "signature",
        required: true,
      },
    ],
  };

  const handover: CustomTemplate = {
    ...base,
    id: "builtin-handover",
    name: "引渡し書類",
    category: "handover",
    fields: [
      { id: "property_name", label: "物件名", type: "text", required: true },
      { id: "handover_date", label: "引渡日", type: "date", required: true },
      {
        id: "remaining_work",
        label: "残工事リスト",
        type: "text",
        required: false,
      },
      {
        id: "client_sign",
        label: "施主サイン",
        type: "signature",
        required: true,
      },
      {
        id: "contractor_sign",
        label: "施工者サイン",
        type: "signature",
        required: true,
      },
    ],
  };

  return [dailyReport, inspectionChecklist, materialReceipt, handover];
}

// ---------------------------------------------------------------------------
// Field operations
// ---------------------------------------------------------------------------

/**
 * Add a field to a template (returns a new template with incremented version).
 */
export function addField(
  template: CustomTemplate,
  field: FieldDefinition,
): CustomTemplate {
  validateFieldDefinition(field);
  return {
    ...template,
    version: template.version + 1,
    fields: [...template.fields, { ...field }],
    updatedAt: new Date(),
  };
}

/**
 * Remove a field from a template by fieldId (increments version).
 */
export function removeField(
  template: CustomTemplate,
  fieldId: string,
): CustomTemplate {
  return {
    ...template,
    version: template.version + 1,
    fields: template.fields.filter((f) => f.id !== fieldId),
    updatedAt: new Date(),
  };
}

/**
 * Reorder template fields by providing the new ordered array of field IDs.
 * Fields not present in fieldIds are appended at the end in their original order.
 */
export function reorderFields(
  template: CustomTemplate,
  fieldIds: string[],
): CustomTemplate {
  const fieldMap = new Map(template.fields.map((f) => [f.id, f]));
  const reordered: FieldDefinition[] = [];
  for (const id of fieldIds) {
    const f = fieldMap.get(id);
    if (f) {
      reordered.push(f);
      fieldMap.delete(id);
    }
  }
  // Append any remaining fields not in fieldIds
  for (const f of fieldMap.values()) {
    reordered.push(f);
  }
  return {
    ...template,
    version: template.version + 1,
    fields: reordered,
    updatedAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Record operations
// ---------------------------------------------------------------------------

/**
 * Create a new blank record for a template.
 */
export function createRecord(
  templateId: string,
  projectId: string,
  submittedBy: string,
): TemplateRecord {
  return {
    id: generateId(),
    templateId,
    projectId,
    data: {},
    status: "draft",
    submittedBy,
  };
}

/**
 * Fill a record with data (merges into existing data).
 */
export function fillRecord(
  record: TemplateRecord,
  data: Record<string, unknown>,
): TemplateRecord {
  return {
    ...record,
    data: { ...record.data, ...data },
  };
}

/**
 * Validate a record against its template definition.
 * Checks required fields, type constraints, and min/max/pattern validation.
 */
export function validateRecord(
  template: CustomTemplate,
  record: TemplateRecord,
): TemplateValidationResult {
  const errors: { fieldId: string; fieldLabel: string; message: string }[] = [];

  for (const field of template.fields) {
    const value = record.data[field.id];
    const isEmpty =
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0);

    if (field.required && isEmpty) {
      errors.push({
        fieldId: field.id,
        fieldLabel: field.label,
        message: `${field.label}は必須項目です`,
      });
      continue;
    }

    if (isEmpty) continue;

    if (field.type === "number" && field.validation) {
      const num = Number(value);
      if (isNaN(num)) {
        errors.push({
          fieldId: field.id,
          fieldLabel: field.label,
          message: `${field.label}は数値を入力してください`,
        });
        continue;
      }
      if (field.validation.min !== undefined && num < field.validation.min) {
        errors.push({
          fieldId: field.id,
          fieldLabel: field.label,
          message:
            field.validation.message ??
            `${field.label}は${field.validation.min}以上で入力してください`,
        });
      }
      if (field.validation.max !== undefined && num > field.validation.max) {
        errors.push({
          fieldId: field.id,
          fieldLabel: field.label,
          message:
            field.validation.message ??
            `${field.label}は${field.validation.max}以下で入力してください`,
        });
      }
    }

    if (
      field.type === "text" &&
      field.validation?.pattern &&
      typeof value === "string"
    ) {
      let re: RegExp | null = null;
      try {
        re = new RegExp(field.validation.pattern);
      } catch {
        // invalid regex pattern — skip validation rather than crash
      }
      if (re && !re.test(value)) {
        errors.push({
          fieldId: field.id,
          fieldLabel: field.label,
          message:
            field.validation.message ??
            `${field.label}の形式が正しくありません`,
        });
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Evaluate calculation fields using simple arithmetic formulas referencing other field values.
 * Supported: field_id references, +, -, *, / operators, parentheses, numeric literals.
 * Returns a new record with calculation field values populated.
 */
export function evaluateCalculationFields(
  template: CustomTemplate,
  record: TemplateRecord,
): TemplateRecord {
  const calcFields = template.fields.filter((f) => f.type === "calculation");
  if (calcFields.length === 0) return record;

  const newData = { ...record.data };

  for (const field of calcFields) {
    if (!field.calculationFormula) continue;
    try {
      let formula = field.calculationFormula;
      // Replace field references with their numeric values (escape field IDs for regex safety)
      for (const f of template.fields) {
        if (f.id === field.id) continue;
        const fieldVal = newData[f.id];
        const num = fieldVal !== undefined ? Number(fieldVal) : 0;
        const escapedId = f.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        formula = formula.replace(new RegExp(`\\b${escapedId}\\b`, "g"), String(isNaN(num) ? 0 : num));
      }
      // Safe stack-based evaluator for +,-,*,/,() on numeric tokens (no Function/eval)
      if (/^[\d\s+\-*/().]+$/.test(formula)) {
        const result = safeEvaluate(formula);
        newData[field.id] = typeof result === "number" && isFinite(result) ? result : 0;
      } else {
        newData[field.id] = 0;
      }
    } catch {
      newData[field.id] = 0;
    }
  }

  return { ...record, data: newData };
}

/**
 * Submit a record (transition to 'submitted').
 */
export function submitRecord(record: TemplateRecord): TemplateRecord {
  return {
    ...record,
    status: "submitted",
    submittedAt: new Date(),
  };
}

/**
 * Approve a record (transition to 'approved').
 */
export function approveRecord(
  record: TemplateRecord,
  approvedBy: string,
): TemplateRecord {
  return {
    ...record,
    status: "approved",
    approvedBy,
    approvedAt: new Date(),
  };
}

/**
 * Reject a record (transition to 'rejected').
 */
export function rejectRecord(record: TemplateRecord): TemplateRecord {
  return { ...record, status: "rejected" };
}

// ---------------------------------------------------------------------------
// Export / Output
// ---------------------------------------------------------------------------

/**
 * Generate a printable HTML form with field labels and filled data.
 */
export function buildRecordHtml(
  template: CustomTemplate,
  record: TemplateRecord,
): string {
  const rows = template.fields
    .map((field) => {
      const value = record.data[field.id];
      const displayValue =
        value === undefined || value === null ? "" : String(value);
      return `    <tr>
      <th>${escapeHtml(field.label)}</th>
      <td>${escapeHtml(displayValue)}</td>
    </tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(template.name)}</title>
  <style>
    body { font-family: sans-serif; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 8px 12px; text-align: left; }
    th { background: #f5f5f5; width: 30%; }
  </style>
</head>
<body>
  <h1>${escapeHtml(template.name)}</h1>
  <table>
${rows}
  </table>
</body>
</html>`;
}

/**
 * Export multiple records to CSV format. Columns match field labels.
 */
export function exportRecordsCSV(
  template: CustomTemplate,
  records: TemplateRecord[],
): string {
  const escapeCsvField = (value: unknown): string => {
    const s = value === undefined || value === null ? "" : String(value);
    // Wrap in quotes if contains comma, newline, or double-quote
    if (s.includes(",") || s.includes("\n") || s.includes('"')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const headers = template.fields.map((f) => escapeCsvField(f.label)).join(",");
  const dataRows = records.map((record) =>
    template.fields.map((f) => escapeCsvField(record.data[f.id])).join(","),
  );

  return [headers, ...dataRows].join("\n");
}

/**
 * Clone a template for customization (new id, new name, resets version to 1).
 */
export function cloneTemplate(
  template: CustomTemplate,
  newName: string,
): CustomTemplate {
  const now = new Date();
  return {
    ...template,
    id: generateId(),
    name: newName,
    version: 1,
    fields: template.fields.map((f) => ({ ...f })),
    createdAt: now,
    updatedAt: now,
  };
}

// Repository-pattern accessors (for gradual migration to Supabase)
export const templateRepository = createRepository<CustomTemplate>('custom_templates');
export const templateRecordRepository = createRepository<TemplateRecord>('template_records');
