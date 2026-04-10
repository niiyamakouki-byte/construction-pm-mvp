import { describe, expect, it, beforeEach } from "vitest";
import {
  createDocument,
  updateDocument,
  deleteDocument,
  listDocuments,
  getDocument,
  copyDocumentToProject,
  createFromTemplate,
  generateDocumentHtml,
  clearAllDocuments,
  DOCUMENT_TEMPLATE_DATA,
  type SafetyDocument,
  type SafetyDocumentType,
} from "./safety-documents.js";

beforeEach(() => {
  clearAllDocuments();
});

const ALL_TYPES: SafetyDocumentType[] = [
  "作業員名簿",
  "新規入場者教育",
  "工事安全衛生計画書",
  "作業手順書",
  "有資格者一覧",
];

function makeDoc(overrides?: Partial<Omit<SafetyDocument, "id" | "createdAt" | "updatedAt">>): SafetyDocument {
  return createDocument({
    projectId: "proj-1",
    type: "作業員名簿",
    title: "作業員名簿",
    data: DOCUMENT_TEMPLATE_DATA["作業員名簿"],
    ...overrides,
  });
}

describe("safety-documents", () => {
  describe("createDocument", () => {
    it("creates a document with generated id and timestamps", () => {
      const doc = makeDoc();
      expect(doc.id).toMatch(/^sdoc-/);
      expect(doc.createdAt).toBeTruthy();
      expect(doc.updatedAt).toBeTruthy();
    });

    it("stores the document in the list", () => {
      makeDoc();
      expect(listDocuments("proj-1")).toHaveLength(1);
    });
  });

  describe("listDocuments", () => {
    it("returns all documents when no projectId given", () => {
      makeDoc({ projectId: "proj-1" });
      makeDoc({ projectId: "proj-2" });
      expect(listDocuments()).toHaveLength(2);
    });

    it("filters by projectId", () => {
      makeDoc({ projectId: "proj-1" });
      makeDoc({ projectId: "proj-2" });
      expect(listDocuments("proj-1")).toHaveLength(1);
      expect(listDocuments("proj-2")).toHaveLength(1);
    });

    it("returns empty array for unknown project", () => {
      expect(listDocuments("unknown")).toHaveLength(0);
    });
  });

  describe("getDocument", () => {
    it("retrieves document by id", () => {
      const doc = makeDoc();
      expect(getDocument(doc.id)).toEqual(doc);
    });

    it("returns undefined for unknown id", () => {
      expect(getDocument("nonexistent")).toBeUndefined();
    });
  });

  describe("updateDocument", () => {
    it("updates title and data", () => {
      const doc = makeDoc();
      const updated = updateDocument(doc.id, { title: "更新後タイトル" });
      expect(updated?.title).toBe("更新後タイトル");
    });

    it("updates updatedAt timestamp", () => {
      const doc = makeDoc();
      const before = doc.updatedAt;
      // small delay not needed; just verify field changes
      const updated = updateDocument(doc.id, { title: "変更" });
      expect(updated?.updatedAt).toBeDefined();
      // updatedAt should be >= createdAt
      expect(updated!.updatedAt >= before).toBe(true);
    });

    it("returns undefined for unknown id", () => {
      expect(updateDocument("nonexistent", { title: "x" })).toBeUndefined();
    });
  });

  describe("deleteDocument", () => {
    it("removes document and returns true", () => {
      const doc = makeDoc();
      expect(deleteDocument(doc.id)).toBe(true);
      expect(listDocuments("proj-1")).toHaveLength(0);
    });

    it("returns false for unknown id", () => {
      expect(deleteDocument("nonexistent")).toBe(false);
    });
  });

  describe("copyDocumentToProject", () => {
    it("creates a copy in target project", () => {
      const source = makeDoc({ projectId: "proj-1", title: "元書類" });
      const copy = copyDocumentToProject(source.id, "proj-2");
      expect(copy).toBeDefined();
      expect(copy!.projectId).toBe("proj-2");
      expect(copy!.title).toContain("コピー");
      expect(copy!.id).not.toBe(source.id);
    });

    it("copies data independently (no shared reference)", () => {
      const source = makeDoc({ projectId: "proj-1" });
      const copy = copyDocumentToProject(source.id, "proj-2");
      expect(copy).toBeDefined();
      expect(copy!.data).toEqual(source.data);
      expect(copy!.data).not.toBe(source.data);
    });

    it("returns undefined for unknown source id", () => {
      expect(copyDocumentToProject("nonexistent", "proj-2")).toBeUndefined();
    });
  });

  describe("createFromTemplate", () => {
    it.each(ALL_TYPES)("creates document from template: %s", (type) => {
      const doc = createFromTemplate("proj-1", type);
      expect(doc.type).toBe(type);
      expect(doc.projectId).toBe("proj-1");
      expect(doc.data.type).toBe(type);
    });

    it("creates independent copies (not shared references)", () => {
      const a = createFromTemplate("proj-1", "作業員名簿");
      const b = createFromTemplate("proj-1", "作業員名簿");
      expect(a.id).not.toBe(b.id);
      expect(a.data).not.toBe(b.data);
    });
  });

  describe("generateDocumentHtml", () => {
    it.each(ALL_TYPES)("generates valid HTML for type: %s", (type) => {
      const doc = createFromTemplate("proj-test", type);
      const html = generateDocumentHtml(doc);
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("</html>");
      expect(html).toContain("GenbaHub Safety Documents Module");
    });

    it("escapes HTML in user content", () => {
      const doc = createDocument({
        projectId: "proj-1",
        type: "作業員名簿",
        title: '<script>alert("xss")</script>',
        data: DOCUMENT_TEMPLATE_DATA["作業員名簿"],
      });
      const html = generateDocumentHtml(doc);
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });

    it("includes project id in output", () => {
      const doc = createFromTemplate("proj-99", "有資格者一覧");
      const html = generateDocumentHtml(doc);
      expect(html).toContain("proj-99");
    });
  });

  describe("DOCUMENT_TEMPLATE_DATA", () => {
    it.each(ALL_TYPES)("template has correct type field: %s", (type) => {
      expect(DOCUMENT_TEMPLATE_DATA[type].type).toBe(type);
    });
  });
});
