import { describe, it, expect } from "vitest";
import { isIpAllowed } from "../lib/ip-allowlist.js";

describe("isIpAllowed", () => {
  it("returns true when allowedIps is empty (全許可)", () => {
    expect(isIpAllowed("1.2.3.4", [])).toBe(true);
    expect(isIpAllowed("192.168.0.1", [])).toBe(true);
  });

  it("exact IP match returns true", () => {
    expect(isIpAllowed("10.0.0.1", ["10.0.0.1"])).toBe(true);
  });

  it("exact IP mismatch returns false", () => {
    expect(isIpAllowed("10.0.0.2", ["10.0.0.1"])).toBe(false);
  });

  it("CIDR /24 match returns true for address in range", () => {
    expect(isIpAllowed("192.168.1.100", ["192.168.1.0/24"])).toBe(true);
    expect(isIpAllowed("192.168.1.1", ["192.168.1.0/24"])).toBe(true);
    expect(isIpAllowed("192.168.1.255", ["192.168.1.0/24"])).toBe(true);
  });

  it("CIDR /24 match returns false for address outside range", () => {
    expect(isIpAllowed("192.168.2.1", ["192.168.1.0/24"])).toBe(false);
    expect(isIpAllowed("10.0.0.1", ["192.168.1.0/24"])).toBe(false);
  });

  it("CIDR /8 match works for class A networks", () => {
    expect(isIpAllowed("10.99.88.77", ["10.0.0.0/8"])).toBe(true);
    expect(isIpAllowed("11.0.0.1", ["10.0.0.0/8"])).toBe(false);
  });

  it("CIDR /32 exact match", () => {
    expect(isIpAllowed("203.0.113.5", ["203.0.113.5/32"])).toBe(true);
    expect(isIpAllowed("203.0.113.6", ["203.0.113.5/32"])).toBe(false);
  });

  it("multiple entries: matches first applicable rule", () => {
    expect(
      isIpAllowed("172.16.5.10", ["10.0.0.0/8", "172.16.0.0/12"]),
    ).toBe(true);
  });

  it("no match among multiple entries returns false", () => {
    expect(
      isIpAllowed("8.8.8.8", ["192.168.1.0/24", "10.0.0.0/8"]),
    ).toBe(false);
  });

  it("invalid IP format returns false (not in any range)", () => {
    expect(isIpAllowed("not-an-ip", ["192.168.0.0/24"])).toBe(false);
  });
});
