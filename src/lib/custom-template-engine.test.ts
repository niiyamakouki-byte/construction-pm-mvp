import { describe, expect, it } from "vitest";
import {
  createTemplate,
  getBuiltInTemplates,
  addField,
  removeField,
  reorderFields,
  createRecord,
  fillRecord,
  validateRecord,
  evaluateCalculationFields,
  submitRecord,
  approveRecord,
  rejectRecord,
  buildRecordHtml,
  exportRecordsCSV,
  cloneTemplate,
  type FieldDefinition,
  type CustomTemplate,
  type TemplateRecord,
} from "./custom-template-engine.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTextField(overrides: Partial<FieldDefinition> = {}): FieldDefinition {
  return {
    id: "field_text",
    label: "テキスト",
    type: "text",
    required: true,
    ...overrides,
  };
}

function makeTemplate(overrides: Partial<CustomTemplate> = {}): CustomTemplate {
  return createTemplate(
    overrides.name ?? "テストテンプレ",
    overrides.category ?? "custom",
    overrides.fields ?? [makeTextField()],
    overrides.orgId ?? "org-1",
    overrides.createdBy ?? "user-1",
  );
}

function makeRecord(templateId = "tmpl-1"): TemplateRecord {
  return createRecord(templateId, "proj-1", "user-1");
}

// ---------------------------------------------------------------------------
// createTemplate
// ---------------------------------------------------------------------------

describe("createTemplate", () => {
  it("creates a template with expected defaults", () => {
    const tmpl = makeTemplate();
    expect(tmpl.id).toBeTruthy();
    expect(tmpl.name).toBe("テストテンプレ");
    expect(tmpl.category).toBe("custom");
    expect(tmpl.version).toBe(1);
    expect(tmpl.orgId).toBe("org-1");
    expect(tmpl.createdBy).toBe("user-1");
    expect(tmpl.fields).toHaveLength(1);
    expect(tmpl.createdAt).toBeInstanceOf(Date);
    expect(tmpl.updatedAt).toBeInstanceOf(Date);
  });

  it("throws on empty name", () => {
    expect(() =>
      createTemplate("", "custom", [], "org-1", "user-1"),
    ).toThrow("Template name");
  });

  it("throws on field with empty id", () => {
    const badField: FieldDefinition = { id: "", label: "X", type: "text", required: false };
    expect(() =>
      createTemplate("T", "custom", [badField], "org-1", "user-1"),
    ).toThrow("id");
  });

  it("throws on field with empty label", () => {
    const badField: FieldDefinition = { id: "f1", label: "", type: "text", required: false };
    expect(() =>
      createTemplate("T", "custom", [badField], "org-1", "user-1"),
    ).toThrow("label");
  });

  it("throws on select field without options", () => {
    const badField: FieldDefinition = {
      id: "f1",
      label: "選択",
      type: "select",
      required: false,
    };
    expect(() =>
      createTemplate("T", "custom", [badField], "org-1", "user-1"),
    ).toThrow("option");
  });

  it("throws on multiselect field without options", () => {
    const badField: FieldDefinition = {
      id: "f1",
      label: "複数選択",
      type: "multiselect",
      required: false,
    };
    expect(() =>
      createTemplate("T", "custom", [badField], "org-1", "user-1"),
    ).toThrow("option");
  });

  it("throws on calculation field without formula", () => {
    const badField: FieldDefinition = {
      id: "f1",
      label: "計算",
      type: "calculation",
      required: false,
    };
    expect(() =>
      createTemplate("T", "custom", [badField], "org-1", "user-1"),
    ).toThrow("calculationFormula");
  });

  it("accepts valid select field with options", () => {
    const field: FieldDefinition = {
      id: "f1",
      label: "天気",
      type: "select",
      required: true,
      options: ["晴れ", "雨"],
    };
    const tmpl = createTemplate("T", "custom", [field], "org-1", "user-1");
    expect(tmpl.fields[0].options).toEqual(["晴れ", "雨"]);
  });

  it("accepts valid calculation field with formula", () => {
    const field: FieldDefinition = {
      id: "total",
      label: "合計",
      type: "calculation",
      required: false,
      calculationFormula: "qty * price",
    };
    const tmpl = createTemplate("T", "custom", [field], "org-1", "user-1");
    expect(tmpl.fields[0].calculationFormula).toBe("qty * price");
  });
});

// ---------------------------------------------------------------------------
// getBuiltInTemplates
// ---------------------------------------------------------------------------

describe("getBuiltInTemplates", () => {
  it("returns exactly 4 built-in templates", () => {
    const templates = getBuiltInTemplates();
    expect(templates).toHaveLength(4);
  });

  it("includes 日報 with required fields", () => {
    const templates = getBuiltInTemplates();
    const daily = templates.find((t) => t.category === "daily_report");
    expect(daily).toBeDefined();
    expect(daily!.name).toBe("日報");
    const fieldIds = daily!.fields.map((f) => f.id);
    expect(fieldIds).toContain("date");
    expect(fieldIds).toContain("weather");
    expect(fieldIds).toContain("work_content");
    expect(fieldIds).toContain("worker_count");
    expect(fieldIds).toContain("progress_rate");
    expect(fieldIds).toContain("supervisor_sign");
  });

  it("includes 検収チェックリスト", () => {
    const templates = getBuiltInTemplates();
    const inspection = templates.find((t) => t.category === "inspection");
    expect(inspection).toBeDefined();
    expect(inspection!.name).toBe("検収チェックリスト");
    const fieldIds = inspection!.fields.map((f) => f.id);
    expect(fieldIds).toContain("work_type");
    expect(fieldIds).toContain("judgment");
    expect(fieldIds).toContain("inspector_sign");
  });

  it("includes 材料受入記録", () => {
    const templates = getBuiltInTemplates();
    const delivery = templates.find((t) => t.category === "delivery");
    expect(delivery).toBeDefined();
    expect(delivery!.name).toBe("材料受入記録");
    const fieldIds = delivery!.fields.map((f) => f.id);
    expect(fieldIds).toContain("vendor");
    expect(fieldIds).toContain("quantity");
    expect(fieldIds).toContain("receiver_sign");
  });

  it("includes 引渡し書類", () => {
    const templates = getBuiltInTemplates();
    const handover = templates.find((t) => t.category === "handover");
    expect(handover).toBeDefined();
    expect(handover!.name).toBe("引渡し書類");
    const fieldIds = handover!.fields.map((f) => f.id);
    expect(fieldIds).toContain("property_name");
    expect(fieldIds).toContain("handover_date");
    expect(fieldIds).toContain("client_sign");
    expect(fieldIds).toContain("contractor_sign");
  });

  it("all built-in templates have version 1", () => {
    const templates = getBuiltInTemplates();
    for (const t of templates) {
      expect(t.version).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// addField / removeField / reorderFields
// ---------------------------------------------------------------------------

describe("addField", () => {
  it("adds a field and increments version", () => {
    const tmpl = makeTemplate();
    expect(tmpl.version).toBe(1);
    const newField: FieldDefinition = {
      id: "field_extra",
      label: "追加フィールド",
      type: "text",
      required: false,
    };
    const updated = addField(tmpl, newField);
    expect(updated.version).toBe(2);
    expect(updated.fields).toHaveLength(2);
    expect(updated.fields[1].id).toBe("field_extra");
  });

  it("does not mutate the original template", () => {
    const tmpl = makeTemplate();
    const newField: FieldDefinition = { id: "f2", label: "F2", type: "text", required: false };
    addField(tmpl, newField);
    expect(tmpl.fields).toHaveLength(1);
    expect(tmpl.version).toBe(1);
  });

  it("throws when adding invalid field", () => {
    const tmpl = makeTemplate();
    expect(() => addField(tmpl, { id: "", label: "X", type: "text", required: false })).toThrow();
  });
});

describe("removeField", () => {
  it("removes the field with the given id and increments version", () => {
    const tmpl = createTemplate(
      "T",
      "custom",
      [
        makeTextField({ id: "f1", label: "F1" }),
        makeTextField({ id: "f2", label: "F2" }),
      ],
      "org-1",
      "user-1",
    );
    const updated = removeField(tmpl, "f1");
    expect(updated.version).toBe(2);
    expect(updated.fields).toHaveLength(1);
    expect(updated.fields[0].id).toBe("f2");
  });

  it("does nothing if fieldId not found (still increments version)", () => {
    const tmpl = makeTemplate();
    const updated = removeField(tmpl, "nonexistent");
    expect(updated.version).toBe(2);
    expect(updated.fields).toHaveLength(1);
  });

  it("does not mutate the original template", () => {
    const tmpl = makeTemplate();
    removeField(tmpl, "field_text");
    expect(tmpl.fields).toHaveLength(1);
  });
});

describe("reorderFields", () => {
  it("reorders fields according to provided ids and increments version", () => {
    const tmpl = createTemplate(
      "T",
      "custom",
      [
        makeTextField({ id: "a", label: "A" }),
        makeTextField({ id: "b", label: "B" }),
        makeTextField({ id: "c", label: "C" }),
      ],
      "org-1",
      "user-1",
    );
    const updated = reorderFields(tmpl, ["c", "a", "b"]);
    expect(updated.version).toBe(2);
    expect(updated.fields.map((f) => f.id)).toEqual(["c", "a", "b"]);
  });

  it("appends fields not in the list at the end", () => {
    const tmpl = createTemplate(
      "T",
      "custom",
      [
        makeTextField({ id: "a", label: "A" }),
        makeTextField({ id: "b", label: "B" }),
        makeTextField({ id: "c", label: "C" }),
      ],
      "org-1",
      "user-1",
    );
    const updated = reorderFields(tmpl, ["b"]);
    expect(updated.fields[0].id).toBe("b");
    // a and c appended in original order
    const remaining = updated.fields.slice(1).map((f) => f.id);
    expect(remaining).toContain("a");
    expect(remaining).toContain("c");
  });
});

// ---------------------------------------------------------------------------
// createRecord / fillRecord
// ---------------------------------------------------------------------------

describe("createRecord", () => {
  it("creates a blank draft record", () => {
    const rec = makeRecord("tmpl-1");
    expect(rec.id).toBeTruthy();
    expect(rec.templateId).toBe("tmpl-1");
    expect(rec.projectId).toBe("proj-1");
    expect(rec.status).toBe("draft");
    expect(rec.data).toEqual({});
    expect(rec.submittedBy).toBe("user-1");
  });
});

describe("fillRecord", () => {
  it("merges data into record", () => {
    const rec = makeRecord();
    const filled = fillRecord(rec, { field_text: "Hello" });
    expect(filled.data["field_text"]).toBe("Hello");
  });

  it("does not mutate original record", () => {
    const rec = makeRecord();
    fillRecord(rec, { field_text: "Hello" });
    expect(rec.data).toEqual({});
  });

  it("merges additional fields without overwriting existing ones", () => {
    const rec = fillRecord(makeRecord(), { a: 1 });
    const rec2 = fillRecord(rec, { b: 2 });
    expect(rec2.data).toEqual({ a: 1, b: 2 });
  });

  it("overwrites when same key provided again", () => {
    const rec = fillRecord(makeRecord(), { a: 1 });
    const rec2 = fillRecord(rec, { a: 99 });
    expect(rec2.data["a"]).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// validateRecord
// ---------------------------------------------------------------------------

describe("validateRecord", () => {
  it("returns valid when all required fields are filled", () => {
    const tmpl = makeTemplate();
    const rec = fillRecord(makeRecord(tmpl.id), { field_text: "入力済み" });
    const result = validateRecord(tmpl, rec);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns error when required field is missing", () => {
    const tmpl = makeTemplate();
    const rec = makeRecord(tmpl.id);
    const result = validateRecord(tmpl, rec);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].fieldId).toBe("field_text");
  });

  it("validates number min constraint", () => {
    const tmpl = createTemplate(
      "T",
      "custom",
      [
        {
          id: "count",
          label: "人数",
          type: "number",
          required: true,
          validation: { min: 1 },
        },
      ],
      "org-1",
      "user-1",
    );
    const rec = fillRecord(makeRecord(tmpl.id), { count: 0 });
    const result = validateRecord(tmpl, rec);
    expect(result.valid).toBe(false);
    expect(result.errors[0].fieldId).toBe("count");
  });

  it("validates number max constraint", () => {
    const tmpl = createTemplate(
      "T",
      "custom",
      [
        {
          id: "progress",
          label: "進捗率",
          type: "number",
          required: true,
          validation: { max: 100 },
        },
      ],
      "org-1",
      "user-1",
    );
    const rec = fillRecord(makeRecord(tmpl.id), { progress: 101 });
    const result = validateRecord(tmpl, rec);
    expect(result.valid).toBe(false);
    expect(result.errors[0].fieldId).toBe("progress");
  });

  it("validates text pattern constraint", () => {
    const tmpl = createTemplate(
      "T",
      "custom",
      [
        {
          id: "phone",
          label: "電話番号",
          type: "text",
          required: true,
          validation: { pattern: "^\\d{10,11}$", message: "電話番号の形式が違います" },
        },
      ],
      "org-1",
      "user-1",
    );
    const rec = fillRecord(makeRecord(tmpl.id), { phone: "abc" });
    const result = validateRecord(tmpl, rec);
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toBe("電話番号の形式が違います");
  });

  it("passes pattern validation when value matches", () => {
    const tmpl = createTemplate(
      "T",
      "custom",
      [
        {
          id: "phone",
          label: "電話番号",
          type: "text",
          required: true,
          validation: { pattern: "^\\d{10,11}$" },
        },
      ],
      "org-1",
      "user-1",
    );
    const rec = fillRecord(makeRecord(tmpl.id), { phone: "09012345678" });
    const result = validateRecord(tmpl, rec);
    expect(result.valid).toBe(true);
  });

  it("reports multiple errors", () => {
    const tmpl = createTemplate(
      "T",
      "custom",
      [
        makeTextField({ id: "f1", label: "F1", required: true }),
        makeTextField({ id: "f2", label: "F2", required: true }),
      ],
      "org-1",
      "user-1",
    );
    const rec = makeRecord(tmpl.id);
    const result = validateRecord(tmpl, rec);
    expect(result.errors).toHaveLength(2);
  });

  it("skips validation for non-required empty fields", () => {
    const tmpl = createTemplate(
      "T",
      "custom",
      [makeTextField({ id: "f1", label: "F1", required: false })],
      "org-1",
      "user-1",
    );
    const rec = makeRecord(tmpl.id);
    const result = validateRecord(tmpl, rec);
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// evaluateCalculationFields
// ---------------------------------------------------------------------------

describe("evaluateCalculationFields", () => {
  it("evaluates a multiplication formula", () => {
    const tmpl = createTemplate(
      "T",
      "custom",
      [
        { id: "qty", label: "数量", type: "number", required: true },
        { id: "price", label: "単価", type: "number", required: true },
        {
          id: "total",
          label: "合計",
          type: "calculation",
          required: false,
          calculationFormula: "qty * price",
        },
      ],
      "org-1",
      "user-1",
    );
    const rec = fillRecord(makeRecord(tmpl.id), { qty: 5, price: 1000 });
    const evaluated = evaluateCalculationFields(tmpl, rec);
    expect(evaluated.data["total"]).toBe(5000);
  });

  it("evaluates an addition formula", () => {
    const tmpl = createTemplate(
      "T",
      "custom",
      [
        { id: "a", label: "A", type: "number", required: true },
        { id: "b", label: "B", type: "number", required: true },
        {
          id: "sum",
          label: "合計",
          type: "calculation",
          required: false,
          calculationFormula: "a + b",
        },
      ],
      "org-1",
      "user-1",
    );
    const rec = fillRecord(makeRecord(tmpl.id), { a: 3, b: 7 });
    const evaluated = evaluateCalculationFields(tmpl, rec);
    expect(evaluated.data["sum"]).toBe(10);
  });

  it("defaults missing field values to 0 in formula", () => {
    const tmpl = createTemplate(
      "T",
      "custom",
      [
        { id: "qty", label: "数量", type: "number", required: false },
        {
          id: "total",
          label: "合計",
          type: "calculation",
          required: false,
          calculationFormula: "qty * 100",
        },
      ],
      "org-1",
      "user-1",
    );
    const rec = makeRecord(tmpl.id); // qty not filled
    const evaluated = evaluateCalculationFields(tmpl, rec);
    expect(evaluated.data["total"]).toBe(0);
  });

  it("returns 0 on unsafe formula", () => {
    const tmpl = createTemplate(
      "T",
      "custom",
      [
        {
          id: "hack",
          label: "ハック",
          type: "calculation",
          required: false,
          calculationFormula: "process.exit(1)",
        },
      ],
      "org-1",
      "user-1",
    );
    const rec = makeRecord(tmpl.id);
    const evaluated = evaluateCalculationFields(tmpl, rec);
    expect(evaluated.data["hack"]).toBe(0);
  });

  it("does not mutate original record", () => {
    const tmpl = createTemplate(
      "T",
      "custom",
      [
        { id: "x", label: "X", type: "number", required: false },
        {
          id: "y",
          label: "Y",
          type: "calculation",
          required: false,
          calculationFormula: "x + 1",
        },
      ],
      "org-1",
      "user-1",
    );
    const rec = fillRecord(makeRecord(tmpl.id), { x: 5 });
    evaluateCalculationFields(tmpl, rec);
    expect(rec.data["y"]).toBeUndefined();
  });

  it("returns the same record if no calculation fields", () => {
    const tmpl = makeTemplate();
    const rec = makeRecord(tmpl.id);
    const result = evaluateCalculationFields(tmpl, rec);
    expect(result).toBe(rec);
  });
});

// ---------------------------------------------------------------------------
// Approval workflow
// ---------------------------------------------------------------------------

describe("approval workflow", () => {
  it("draft -> submitted via submitRecord", () => {
    const rec = makeRecord();
    expect(rec.status).toBe("draft");
    const submitted = submitRecord(rec);
    expect(submitted.status).toBe("submitted");
    expect(submitted.submittedAt).toBeInstanceOf(Date);
  });

  it("submitted -> approved via approveRecord", () => {
    const rec = submitRecord(makeRecord());
    const approved = approveRecord(rec, "manager-1");
    expect(approved.status).toBe("approved");
    expect(approved.approvedBy).toBe("manager-1");
    expect(approved.approvedAt).toBeInstanceOf(Date);
  });

  it("submitted -> rejected via rejectRecord", () => {
    const rec = submitRecord(makeRecord());
    const rejected = rejectRecord(rec);
    expect(rejected.status).toBe("rejected");
  });

  it("does not mutate the original record", () => {
    const rec = makeRecord();
    submitRecord(rec);
    expect(rec.status).toBe("draft");
  });
});

// ---------------------------------------------------------------------------
// buildRecordHtml
// ---------------------------------------------------------------------------

describe("buildRecordHtml", () => {
  it("generates HTML with template name", () => {
    const tmpl = makeTemplate({ name: "日報テスト" });
    const rec = fillRecord(makeRecord(tmpl.id), { field_text: "本日の作業" });
    const html = buildRecordHtml(tmpl, rec);
    expect(html).toContain("日報テスト");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<table>");
  });

  it("includes field labels and values", () => {
    const tmpl = makeTemplate();
    const rec = fillRecord(makeRecord(tmpl.id), { field_text: "テスト値" });
    const html = buildRecordHtml(tmpl, rec);
    expect(html).toContain("テキスト");
    expect(html).toContain("テスト値");
  });

  it("escapes HTML special characters in field values", () => {
    const tmpl = makeTemplate();
    const rec = fillRecord(makeRecord(tmpl.id), {
      field_text: "<script>alert('XSS')</script>",
    });
    const html = buildRecordHtml(tmpl, rec);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes HTML in field labels", () => {
    const tmpl = createTemplate(
      "T",
      "custom",
      [{ id: "f1", label: "<b>太字</b>", type: "text", required: false }],
      "org-1",
      "user-1",
    );
    const rec = makeRecord(tmpl.id);
    const html = buildRecordHtml(tmpl, rec);
    expect(html).not.toContain("<b>太字</b>");
    expect(html).toContain("&lt;b&gt;太字&lt;/b&gt;");
  });

  it("renders empty string for missing values", () => {
    const tmpl = makeTemplate();
    const rec = makeRecord(tmpl.id);
    const html = buildRecordHtml(tmpl, rec);
    // Should have <td></td> for empty field
    expect(html).toContain("<td></td>");
  });
});

// ---------------------------------------------------------------------------
// exportRecordsCSV
// ---------------------------------------------------------------------------

describe("exportRecordsCSV", () => {
  it("generates CSV with header row from field labels", () => {
    const tmpl = createTemplate(
      "T",
      "custom",
      [
        makeTextField({ id: "name", label: "名前" }),
        makeTextField({ id: "note", label: "備考" }),
      ],
      "org-1",
      "user-1",
    );
    const rec = fillRecord(makeRecord(tmpl.id), { name: "山田", note: "なし" });
    const csv = exportRecordsCSV(tmpl, [rec]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("名前,備考");
    expect(lines[1]).toBe("山田,なし");
  });

  it("wraps fields with commas in double quotes", () => {
    const tmpl = createTemplate(
      "T",
      "custom",
      [makeTextField({ id: "desc", label: "説明" })],
      "org-1",
      "user-1",
    );
    const rec = fillRecord(makeRecord(tmpl.id), { desc: "A, B, C" });
    const csv = exportRecordsCSV(tmpl, [rec]);
    expect(csv).toContain('"A, B, C"');
  });

  it("escapes double quotes in CSV values", () => {
    const tmpl = createTemplate(
      "T",
      "custom",
      [makeTextField({ id: "val", label: "値" })],
      "org-1",
      "user-1",
    );
    const rec = fillRecord(makeRecord(tmpl.id), { val: 'say "hello"' });
    const csv = exportRecordsCSV(tmpl, [rec]);
    expect(csv).toContain('"say ""hello"""');
  });

  it("exports multiple records as multiple rows", () => {
    const tmpl = createTemplate(
      "T",
      "custom",
      [makeTextField({ id: "x", label: "X" })],
      "org-1",
      "user-1",
    );
    const rec1 = fillRecord(makeRecord(tmpl.id), { x: "row1" });
    const rec2 = fillRecord(makeRecord(tmpl.id), { x: "row2" });
    const csv = exportRecordsCSV(tmpl, [rec1, rec2]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3); // header + 2 data rows
    expect(lines[1]).toBe("row1");
    expect(lines[2]).toBe("row2");
  });

  it("outputs only header when records array is empty", () => {
    const tmpl = makeTemplate();
    const csv = exportRecordsCSV(tmpl, []);
    expect(csv.trim()).toBe("テキスト");
  });
});

// ---------------------------------------------------------------------------
// cloneTemplate
// ---------------------------------------------------------------------------

describe("cloneTemplate", () => {
  it("clones a template with new id and new name", () => {
    const tmpl = makeTemplate();
    const cloned = cloneTemplate(tmpl, "コピーテンプレ");
    expect(cloned.id).not.toBe(tmpl.id);
    expect(cloned.name).toBe("コピーテンプレ");
    expect(cloned.category).toBe(tmpl.category);
    expect(cloned.orgId).toBe(tmpl.orgId);
  });

  it("resets version to 1", () => {
    const tmpl = addField(makeTemplate(), makeTextField({ id: "extra", label: "追加" }));
    expect(tmpl.version).toBe(2);
    const cloned = cloneTemplate(tmpl, "新テンプレ");
    expect(cloned.version).toBe(1);
  });

  it("copies all fields", () => {
    const tmpl = makeTemplate();
    const cloned = cloneTemplate(tmpl, "コピー");
    expect(cloned.fields).toHaveLength(tmpl.fields.length);
    expect(cloned.fields[0].id).toBe(tmpl.fields[0].id);
  });

  it("does not share field references with original", () => {
    const tmpl = makeTemplate();
    const cloned = cloneTemplate(tmpl, "コピー");
    cloned.fields[0].label = "変更後";
    expect(tmpl.fields[0].label).toBe("テキスト");
  });
});
