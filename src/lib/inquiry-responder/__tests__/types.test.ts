/**
 * Types sanity — DEFAULT_RESPONDER_CONFIG のデフォルト値検証.
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_RESPONDER_CONFIG } from "../types.js";

describe("DEFAULT_RESPONDER_CONFIG", () => {
  it("businessHoursStart は 9", () => {
    expect(DEFAULT_RESPONDER_CONFIG.businessHoursStart).toBe(9);
  });

  it("businessHoursEnd は 18", () => {
    expect(DEFAULT_RESPONDER_CONFIG.businessHoursEnd).toBe(18);
  });

  it("leadDays は 3", () => {
    expect(DEFAULT_RESPONDER_CONFIG.leadDays).toBe(3);
  });

  it("proposalCount は 3", () => {
    expect(DEFAULT_RESPONDER_CONFIG.proposalCount).toBe(3);
  });

  it("includeWeekend は true", () => {
    expect(DEFAULT_RESPONDER_CONFIG.includeWeekend).toBe(true);
  });
});
