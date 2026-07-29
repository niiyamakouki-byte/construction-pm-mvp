import { describe, expect, it } from "vitest";
import {
  generateSiteEntryUrl,
  generateSiteEntryQR,
  generateSiteEntryPrintHtml,
  generateSiteEntryPosterPdf,
} from "./site-entry-qr.js";

describe("site-entry-qr", () => {
  describe("generateSiteEntryUrl", () => {
    it("generates a hash-router URL with base and projectId", () => {
      // The app is a hash-router SPA (see src/hooks/useHashRouter.ts), so the
      // route must live after "#" to actually be navigable.
      const url = generateSiteEntryUrl("proj-123", "https://app.genbahub.com");
      expect(url).toBe("https://app.genbahub.com/#/entry/proj-123");
    });

    it("generates URL without base", () => {
      const url = generateSiteEntryUrl("proj-456");
      expect(url).toBe("/#/entry/proj-456");
    });

    it("encodes special characters in projectId", () => {
      const url = generateSiteEntryUrl("proj with spaces");
      expect(url).toBe("/#/entry/proj%20with%20spaces");
    });

    it("throws if projectId is empty", () => {
      expect(() => generateSiteEntryUrl("")).toThrow("projectId is required");
    });

    // laporta-beads-g6sf: entry_token 方式 — QRに埋め込むanon書込み用トークン
    it("appends ?token= when entryToken is provided", () => {
      const url = generateSiteEntryUrl("proj-123", "https://app.genbahub.com", "abc123");
      expect(url).toBe("https://app.genbahub.com/#/entry/proj-123?token=abc123");
    });

    it("omits ?token= when entryToken is undefined or empty", () => {
      expect(generateSiteEntryUrl("proj-123", "", undefined)).toBe("/#/entry/proj-123");
      expect(generateSiteEntryUrl("proj-123", "", "")).toBe("/#/entry/proj-123");
    });

    it("encodes special characters in entryToken", () => {
      const url = generateSiteEntryUrl("proj-123", "", "a&b=c");
      expect(url).toBe("/#/entry/proj-123?token=a%26b%3Dc");
    });
  });

  describe("generateSiteEntryQR", () => {
    it("returns an SVG string with explicit width/height (not size-0)", async () => {
      const svg = await generateSiteEntryQR("proj-123", "テスト現場");
      expect(svg).toMatch(/^<svg /);
      expect(svg).toMatch(/width="\d+"/);
      expect(svg).toMatch(/height="\d+"/);
      expect(svg.trim()).toMatch(/<\/svg>$/);
    });

    it("embeds the entry URL in metadata", async () => {
      const svg = await generateSiteEntryQR("proj-123", "テスト現場", "https://example.com");
      expect(svg).toContain("https://example.com/#/entry/proj-123");
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

    it("embeds the entry token in the encoded URL when provided", async () => {
      const svg = await generateSiteEntryQR("proj-123", "テスト現場", "https://example.com", "tok-1");
      expect(svg).toContain("https://example.com/#/entry/proj-123?token=tok-1");
    });
  });

  describe("generateSiteEntryPrintHtml", () => {
    it("returns an HTML string containing the project name", async () => {
      const html = await generateSiteEntryPrintHtml("proj-1", "南青山リノベ");
      expect(html).toContain("南青山リノベ");
    });

    it("includes the hash-router entry URL", async () => {
      const html = await generateSiteEntryPrintHtml("proj-1", "現場A", "https://app.genbahub.com");
      expect(html).toContain("https://app.genbahub.com/#/entry/proj-1");
    });

    it("includes print CSS with A4 page size", async () => {
      const html = await generateSiteEntryPrintHtml("proj-1", "現場A");
      expect(html).toContain("A4");
    });

    it("throws if projectId is empty", async () => {
      await expect(generateSiteEntryPrintHtml("", "name")).rejects.toThrow("projectId is required");
    });

    it("includes the entry token in the printed URL when provided", async () => {
      const html = await generateSiteEntryPrintHtml("proj-1", "現場A", "https://app.genbahub.com", "tok-2");
      expect(html).toContain("https://app.genbahub.com/#/entry/proj-1?token=tok-2");
    });
  });

  describe("generateSiteEntryPosterPdf", () => {
    it("returns a non-empty PDF blob", async () => {
      const blob = await generateSiteEntryPosterPdf("proj-1", "南青山リノベ", "https://app.genbahub.com");
      expect(blob.type).toBe("application/pdf");
      expect(blob.size).toBeGreaterThan(1000);
    });

    it("throws if projectId is empty", async () => {
      await expect(generateSiteEntryPosterPdf("", "name")).rejects.toThrow("projectId is required");
    });

    it("accepts an entryToken as the 5th argument and still returns a valid PDF", async () => {
      const blob = await generateSiteEntryPosterPdf(
        "proj-1",
        "南青山リノベ",
        "https://app.genbahub.com",
        undefined,
        "tok-3",
      );
      expect(blob.type).toBe("application/pdf");
      expect(blob.size).toBeGreaterThan(1000);
    });
  });
});
