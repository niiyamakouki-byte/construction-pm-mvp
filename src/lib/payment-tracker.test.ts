import { describe, it, expect, beforeEach } from "vitest";
import {
  recordPayment,
  getPaymentSchedule,
  calculateOutstanding,
  generatePaymentReport,
  clearPayments,
} from "./payment-tracker.js";

describe("payment-tracker", () => {
  beforeEach(() => clearPayments());

  it("records a payment", () => {
    const p = recordPayment("proj-1", 100000, "Vendor A", "2026-04-01");
    expect(p.projectId).toBe("proj-1");
    expect(p.amount).toBe(100000);
    expect(p.status).toBe("paid");
  });

  it("records pending payment", () => {
    const p = recordPayment("proj-1", 50000, "Vendor B", "2026-05-01", "pending");
    expect(p.status).toBe("pending");
  });

  it("returns payment schedule", () => {
    recordPayment("proj-1", 100000, "A", "2026-04-01");
    recordPayment("proj-1", 50000, "B", "2026-05-01", "pending");
    const schedule = getPaymentSchedule("proj-1");
    expect(schedule).toHaveLength(2);
    expect(schedule[0].dueDate).toBe("2026-04-01");
  });

  it("calculates outstanding amount", () => {
    recordPayment("proj-1", 100000, "A", "2026-04-01", "paid");
    recordPayment("proj-1", 50000, "B", "2026-05-01", "pending");
    recordPayment("proj-1", 30000, "C", "2026-04-15", "overdue");
    expect(calculateOutstanding("proj-1")).toBe(80000);
  });

  it("returns 0 outstanding for unknown project", () => {
    expect(calculateOutstanding("none")).toBe(0);
  });

  it("generates payment report as HTML", () => {
    recordPayment("proj-1", 100000, "Vendor A", "2026-04-01");
    recordPayment("proj-1", 50000, "Vendor B", "2026-05-01", "pending");
    const html = generatePaymentReport("proj-1");
    expect(html).toContain("Payment Report");
    expect(html).toContain("proj-1");
    expect(html).toContain("Vendor A");
    expect(html).toContain("<table>");
  });

  it("returns empty report for unknown project", () => {
    const html = generatePaymentReport("none");
    expect(html).toContain("none");
  });
});
