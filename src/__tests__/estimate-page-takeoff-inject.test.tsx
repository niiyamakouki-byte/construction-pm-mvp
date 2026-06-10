/**
 * EstimatePage — 拾い出し流し込み機能のコンポーネントテスト
 *
 * DrawingViewer が localStorage に書いた takeoff_estimate_inject を
 * EstimatePage が mount 時に読み取って品目に追加する動作を検証する。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TAKEOFF_INJECT_KEY } from "../lib/takeoff-to-estimate.js";

// ── localStorage mock ─────────────────────────────────────────────────────────

const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => mockStorage[key] ?? null),
  setItem: vi.fn((key: string, val: string) => { mockStorage[key] = val; }),
  removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
  get length() { return Object.keys(mockStorage).length; },
  key: vi.fn((i: number) => Object.keys(mockStorage)[i] ?? null),
  clear: vi.fn(() => { for (const k of Object.keys(mockStorage)) delete mockStorage[k]; }),
};

// ── Page mocks ────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  generateEstimate: vi.fn(),
  projectFindAll: vi.fn(),
}));

vi.mock("../estimate/estimate-generator.js", async () => {
  const actual = await vi.importActual<typeof import("../estimate/estimate-generator.js")>(
    "../estimate/estimate-generator.js",
  );
  mocks.generateEstimate.mockImplementation(actual.generateEstimate);
  return { ...actual, generateEstimate: mocks.generateEstimate };
});

vi.mock("../estimate/pdf-estimate.js", () => ({
  generateEstimatePdf: vi.fn(),
}));

vi.mock("../stores/project-store.js", () => ({
  createProjectRepository: () => ({ findAll: mocks.projectFindAll }),
}));

vi.mock("../contexts/OrganizationContext.js", () => ({
  useOrganizationContext: () => ({ organizationId: "test-org" }),
}));

// ── helpers ───────────────────────────────────────────────────────────────────

async function renderEstimatePage() {
  const { EstimatePage } = await import("../pages/EstimatePage.js");
  render(<EstimatePage />);
  await screen.findByText("品目カタログ");
}

describe("EstimatePage — 拾い出し流し込み", () => {
  beforeEach(() => {
    cleanup();
    vi.resetModules();
    for (const k of Object.keys(mockStorage)) delete mockStorage[k];
    vi.stubGlobal("localStorage", localStorageMock);
    mocks.generateEstimate.mockClear();
    mocks.projectFindAll.mockReset();
    mocks.projectFindAll.mockResolvedValue([]);
    vi.doUnmock("react");
  });

  it("localStorage に inject データがなければバナーも品目追加もない", async () => {
    await renderEstimatePage();
    expect(screen.queryByTestId("takeoff-inject-banner")).toBeNull();
    expect(screen.queryByText(/選択済み品目/)).toBeNull();
  });

  it("localStorage に inject データがあればバナーが表示され品目が追加される", async () => {
    const injectedItems = [
      { code: "TAKEOFF_壁_area", name: "壁（面積）", unit: "㎡", unitPrice: 0, quantity: 20 },
      { code: "TAKEOFF_床_area", name: "床（面積）", unit: "㎡", unitPrice: 0, quantity: 12.5 },
    ];
    mockStorage[TAKEOFF_INJECT_KEY] = JSON.stringify(injectedItems);

    await renderEstimatePage();

    // バナーが表示される
    await waitFor(() =>
      expect(screen.getByTestId("takeoff-inject-banner")).toBeDefined(),
    );

    // 品目が選択済みリストに現れる
    await waitFor(() =>
      expect(screen.getByText(/選択済み品目 \(2件\)/)).toBeDefined(),
    );
    expect(screen.getByText("壁（面積）")).toBeDefined();
    expect(screen.getByText("床（面積）")).toBeDefined();
  });

  it("inject 後に localStorage のキーが削除される", async () => {
    mockStorage[TAKEOFF_INJECT_KEY] = JSON.stringify([
      { code: "TAKEOFF_天井_area", name: "天井（面積）", unit: "㎡", unitPrice: 0, quantity: 8 },
    ]);

    await renderEstimatePage();

    await waitFor(() =>
      expect(screen.getByTestId("takeoff-inject-banner")).toBeDefined(),
    );

    // キーが消えている
    expect(mockStorage[TAKEOFF_INJECT_KEY]).toBeUndefined();
  });

  it("バナーの ✕ ボタンでバナーが非表示になる", async () => {
    mockStorage[TAKEOFF_INJECT_KEY] = JSON.stringify([
      { code: "TAKEOFF_床_area", name: "床（面積）", unit: "㎡", unitPrice: 0, quantity: 5 },
    ]);

    const user = userEvent.setup();
    await renderEstimatePage();

    await waitFor(() =>
      expect(screen.getByTestId("takeoff-inject-banner")).toBeDefined(),
    );

    await user.click(screen.getByLabelText("閉じる"));
    expect(screen.queryByTestId("takeoff-inject-banner")).toBeNull();
    // 品目は残る
    expect(screen.getByText("床（面積）")).toBeDefined();
  });
});
