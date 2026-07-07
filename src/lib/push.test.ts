import { describe, expect, it } from "vitest";
import { urlBase64ToUint8Array } from "./push.js";

describe("urlBase64ToUint8Array", () => {
  it("decodes a URL-safe base64 VAPID key into bytes", () => {
    // Standard base64 "SGVsbG8=" -> "Hello"; URL-safe form drops padding.
    const bytes = urlBase64ToUint8Array("SGVsbG8");
    expect(Array.from(bytes)).toEqual([72, 101, 108, 108, 111]);
  });

  it("handles URL-safe chars (- and _) used by real VAPID keys", () => {
    // "+/" in standard base64 becomes "-_" URL-safe. "-_" -> bytes 0xFB 0xFF.
    const bytes = urlBase64ToUint8Array("-_8");
    expect(Array.from(bytes)).toEqual([251, 255]);
  });

  it("produces the 65-byte P-256 key length for a real VAPID public key", () => {
    const realKey =
      "BOdpdEh4SDrVyxR5gkL1512c2DDfQAwTlNcty48KABqanSUFQwBVHXRO0UdTodIinPFl3Vhh6-mpx-oidcDYG9w";
    expect(urlBase64ToUint8Array(realKey).length).toBe(65);
  });
});
