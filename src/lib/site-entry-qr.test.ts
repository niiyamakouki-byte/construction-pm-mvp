import { describe, expect, it } from "vitest";
import {
  generateSiteEntryUrl,
  generateSiteEntryQR,
  generateSiteEntryPrintHtml,
} from "./site-entry-qr.js";

describe("site-entry-qr", () => {
  describe("generateSiteEntryUrl", () => {
    it("generates URL with base and projectId", () => {
      const url = generateSiteEntryUrl("proj-123", "https://app.genbahub.com");
      expect(url).toBe("https://app.genbahub.com/entry/proj-123");
    });

    it("generates URL without base", () => {
      const url = generateSiteEntryUrl("proj-456");
      expect(url).toBe("/entry/proj-456");
    });

    it("encodes special characters in projectId", () => {
      const url = generateSiteEntryUrl("proj with spaces");
      expect(url).toBe("/entry/proj%20with%20spaces");
    });

    it("throws if projectId is empty", () => {
      expect(() => generateSiteEntryUrl("")).toThrow("projectId is required");
    });
  });

  describe("generateSiteEntryQR", () => {
    it("returns an SVG string", () => {
      const svg = generateSiteEntryQR("proj-123", "テスト現場");
      expect(svg).toMatch(/^<svg /);
      expect(svg).toMatch(/<\/svg>$/);
    });

    it("embeds the entry URL in metadata", () => {
      const svg = generateSiteEntryQR("proj-123", "テスト現場", "https://example.com");
      expect(svg).toContain("https://example.com/entry/proj-123");
    });

    it("includes the project name in the title", () => {
      const svg = generateSiteEntryQR("proj-123", "南青山現場");
      expect(svg).toContain("南青山現場");
    });

    it("throws if projectId is empty", () => {
      expect(() => generateSiteEntryQR("", "name")).toThrow("projectId is required");
    });
  });

  describe("generateSiteEntryPrintHtml", () => {
    it("returns an HTML string containing the project name", () => {
      const html = generateSiteEntryPrintHtml("proj-1", "南青山リノベ");
      expect(html).toContain("南青山リノベ");
    });

    it("includes the entry URL", () => {
      const html = generateSiteEntryPrintHtml("proj-1", "現場A", "https://app.genbahub.com");
      expect(html).toContain("https://app.genbahub.com/entry/proj-1");
    });

    it("includes print CSS with A4 page size", () => {
      const html = generateSiteEntryPrintHtml("proj-1", "現場A");
      expect(html).toContain("A4");
    });

    it("throws if projectId is empty", () => {
      expect(() => generateSiteEntryPrintHtml("", "name")).toThrow("projectId is required");
    });
  });
});
