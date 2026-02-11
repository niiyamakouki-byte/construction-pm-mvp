import { describe, expect, it } from "vitest";

describe("smoke", () => {
  it("ci runs", () => {
    expect(1 + 1).toBe(2);
  });
});
