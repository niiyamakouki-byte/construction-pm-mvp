import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { SafetyInspectionPage } from "./SafetyInspectionPage.js";

vi.mock("../contexts/OrganizationContext.js", () => ({
  useOrganizationContext: () => ({ organizationId: "org-1" }),
}));

vi.mock("../lib/safety-records.js", () => ({
  listKyActivities: vi.fn().mockReturnValue([]),
  listNearMissReports: vi.fn().mockReturnValue([]),
  addKyActivity: vi.fn().mockImplementation((data) => ({ id: "ky-1", ...data })),
  addNearMissReport: vi.fn().mockImplementation((data) => ({ id: "nm-1", ...data })),
}));

vi.mock("../lib/safety-documents.js", () => ({
  listDocuments: vi.fn().mockReturnValue([]),
  createFromTemplate: vi.fn(),
  copyDocumentToProject: vi.fn(),
  deleteDocument: vi.fn(),
  generateDocumentHtml: vi.fn().mockReturnValue("<html></html>"),
}));

vi.mock("../lib/report-generator.js", () => ({
  generateInspectionReport: vi.fn().mockResolvedValue(new Blob()),
}));

describe("SafetyInspectionPage accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("checklist setup form has accessible labels for 工事種別 and 点検者名", () => {
    render(<SafetyInspectionPage />);
    expect(screen.getByLabelText("工事種別")).toBeDefined();
    expect(screen.getByLabelText("点検者名")).toBeDefined();
  });

  it("checklist notes inputs get aria-label after inspection starts", async () => {
    render(<SafetyInspectionPage />);
    fireEvent.click(screen.getByText("点検を開始"));
    // At least one notes input should have an aria-label containing 備考
    const notesInputs = screen.getAllByRole("textbox").filter(
      (el) => el.getAttribute("aria-label")?.includes("備考"),
    );
    expect(notesInputs.length).toBeGreaterThan(0);
  });

  it("KY tab — 参加者 and 危険予知 fields have accessible labels", async () => {
    render(<SafetyInspectionPage />);
    fireEvent.click(screen.getByText("KY活動"));
    expect(screen.getByLabelText("参加者（カンマ区切り）")).toBeDefined();
    expect(screen.getByLabelText("危険予知項目（1行1項目）")).toBeDefined();
    expect(screen.getByLabelText("対策（1行1項目）")).toBeDefined();
  });

  it("ヒヤリハット tab — 場所 and 内容 fields have accessible labels", () => {
    render(<SafetyInspectionPage />);
    fireEvent.click(screen.getByText("ヒヤリハット"));
    expect(screen.getByLabelText("場所")).toBeDefined();
    expect(screen.getByLabelText("内容")).toBeDefined();
  });
});
