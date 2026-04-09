/**
 * Document generator — render templates, batch generate, export.
 */

import type { Template } from "./document-templates.js";

export type DocumentData = Record<string, unknown>;

export type GeneratedDocument = {
  templateId: string;
  content: string;
  generatedAt: string;
};

const templates: Map<string, Template> = new Map();

export function registerTemplate(template: Template): void {
  templates.set(template.id, template);
}

export function getTemplateList(): Template[] {
  return Array.from(templates.values());
}

/**
 * Generate a document by substituting {{key}} placeholders with data values.
 */
export function generateDocument(
  templateHtml: string,
  data: DocumentData,
): string {
  let result = templateHtml;
  for (const [key, value] of Object.entries(data)) {
    const placeholder = `{{${key}}}`;
    result = result.split(placeholder).join(String(value ?? ""));
  }
  return result;
}

/**
 * Generate multiple documents from an array of template+data pairs.
 */
export function batchGenerate(
  items: Array<{ template: string; data: DocumentData }>,
): string[] {
  return items.map((item) => generateDocument(item.template, item.data));
}

/**
 * Placeholder for PDF export — returns a Buffer with the HTML bytes.
 * In production this would use puppeteer / wkhtmltopdf.
 */
export function exportToPDF(html: string): Buffer {
  // Placeholder: return raw HTML as buffer
  return Buffer.from(html, "utf-8");
}

export function clearTemplates(): void {
  templates.clear();
}
