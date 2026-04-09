import { describe, expect, it } from "vitest";
import {
  generateProjectQR,
  parseProjectQR,
  generateFieldModeUrl,
} from "./qr-code.js";

describe("qr-code", () => {
  describe("generateFieldModeUrl", () => {
    it("generates URL with base and projectId", () => {
      const url = generateFieldModeUrl("proj-123", "https://app.genbahub.com");
      expect(url).toBe("https://app.genbahub.com/field/proj-123");
    });

    it("generates URL without base", () => {
      const url = generateFieldModeUrl("proj-456");
      expect(url).toBe("/field/proj-456");
    });

    it("encodes special characters in projectId", () => {
      const url = generateFieldModeUrl("proj with spaces");
      expect(url).toBe("/field/proj%20with%20spaces");
    });

    it("throws if projectId is empty", () => {
      expect(() => generateFieldModeUrl("")).toThrow("projectId is required");
    });
  });

  describe("generateProjectQR", () => {
    it("returns a data URL", () => {
      const qr = generateProjectQR("proj-123");
      expect(qr).toMatch(/^data:image\/svg\+xml;base64,/);
    });

    it("encodes the field mode URL in the SVG", () => {
      const qr = generateProjectQR("proj-123", "https://example.com");
      const decoded = atob(qr.replace("data:image/svg+xml;base64,", ""));
      expect(decoded).toContain("https://example.com/field/proj-123");
    });

    it("throws if projectId is empty", () => {
      expect(() => generateProjectQR("")).toThrow("projectId is required");
    });

    it("uses default base URL", () => {
      const qr = generateProjectQR("test-1");
      const decoded = atob(qr.replace("data:image/svg+xml;base64,", ""));
      expect(decoded).toContain("https://app.genbahub.com/field/test-1");
    });
  });

  describe("parseProjectQR", () => {
    it("parses field mode URL", () => {
      const id = parseProjectQR("https://app.genbahub.com/field/proj-123");
      expect(id).toBe("proj-123");
    });

    it("parses genbahub:// protocol", () => {
      const id = parseProjectQR("genbahub://project/proj-456");
      expect(id).toBe("proj-456");
    });

    it("parses URL-encoded projectId", () => {
      const id = parseProjectQR("/field/proj%20with%20spaces");
      expect(id).toBe("proj with spaces");
    });

    it("returns null for empty input", () => {
      expect(parseProjectQR("")).toBeNull();
    });

    it("returns null for unrecognized format", () => {
      expect(parseProjectQR("https://example.com/other")).toBeNull();
    });

    it("returns null for genbahub:// with no id", () => {
      expect(parseProjectQR("genbahub://project/")).toBeNull();
    });

    it("handles field URL with query params", () => {
      const id = parseProjectQR("https://app.genbahub.com/field/abc?mode=view");
      expect(id).toBe("abc");
    });

    it("roundtrips with generateFieldModeUrl", () => {
      const url = generateFieldModeUrl("roundtrip-1", "https://app.genbahub.com");
      const id = parseProjectQR(url);
      expect(id).toBe("roundtrip-1");
    });
  });
});
