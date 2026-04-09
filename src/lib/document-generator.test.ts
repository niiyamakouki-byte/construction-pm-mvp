import { describe, it, expect, beforeEach } from "vitest";
import {
  generateDocument,
  batchGenerate,
  exportToPDF,
  registerTemplate,
  getTemplateList,
  clearTemplates,
} from "./document-generator.js";

describe("document-generator", () => {
  beforeEach(() => clearTemplates());

  it("substitutes placeholders", () => {
    const result = generateDocument(
      "<h1>{{title}}</h1><p>{{body}}</p>",
      { title: "Test", body: "Hello" },
    );
    expect(result).toBe("<h1>Test</h1><p>Hello</p>");
  });

  it("handles missing placeholders gracefully", () => {
    const result = generateDocument("<p>{{name}}</p>", {});
    expect(result).toBe("<p>{{name}}</p>");
  });

  it("batch generates multiple documents", () => {
    const results = batchGenerate([
      { template: "Hello {{who}}", data: { who: "A" } },
      { template: "Hello {{who}}", data: { who: "B" } },
    ]);
    expect(results).toEqual(["Hello A", "Hello B"]);
  });

  it("exportToPDF returns a Buffer", () => {
    const buf = exportToPDF("<html></html>");
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.toString()).toContain("<html>");
  });

  it("registers and lists templates", () => {
    registerTemplate({
      id: "t1",
      name: "Invoice",
      type: "invoice",
      createdAt: "2026-04-09",
    });
    const list = getTemplateList();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("t1");
  });
});
