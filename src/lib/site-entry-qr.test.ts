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
    it("returns an SVG string", async () => {
      const svg = await generateSiteEntryQR("proj-123", "テスト現場");
      expect(svg).toMatch(/^<svg /);
      expect(svg.trim()).toMatch(/<\/svg>$/);
    });

    it("embeds the entry URL in metadata", async () => {
      const svg = await generateSiteEntryQR("proj-123", "テスト現場", "https://example.com");
      expect(svg).toContain("https://example.com/entry/proj-123");
    });

    it("includes the project name in the title", async () => {
      const svg = await generateSiteEntryQR("proj-123", "南青山現場");
      expect(svg).toContain("南青山現場");
    });

    it("throws if projectId is empty", async () => {
      await expect(generateSiteEntryQR("", "name")).rejects.toThrow("projectId is required");
    });

    it("contains real QR path elements (not placeholder)", async () => {
      const svg = await generateSiteEntryQR("proj-123", "テスト現場");
      expect(svg).toMatch(/<path /);
    });
  });

  describe("generateSiteEntryPrintHtml", () => {
    it("returns an HTML string containing the project name", async () => {
      const html = await generateSiteEntryPrintHtml("proj-1", "南青山リノベ");
      expect(html).toContain("南青山リノベ");
    });

    it("includes the entry URL", async () => {
      const html = await generateSiteEntryPrintHtml("proj-1", "現場A", "https://app.genbahub.com");
      expect(html).toContain("https://app.genbahub.com/entry/proj-1");
    });

    it("includes print CSS with A4 page size", async () => {
      const html = await generateSiteEntryPrintHtml("proj-1", "現場A");
      expect(html).toContain("A4");
    });

    it("throws if projectId is empty", async () => {
      await expect(generateSiteEntryPrintHtml("", "name")).rejects.toThrow("projectId is required");
    });
  });
});
