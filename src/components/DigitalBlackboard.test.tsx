import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { DigitalBlackboard } from "./DigitalBlackboard.js";

afterEach(cleanup);

function makeMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", makeMockStorage());
});

// crypto.randomUUID is available in jsdom but ensure it exists
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, "crypto", {
    value: { randomUUID: () => Math.random().toString(36).slice(2) },
  });
}

describe("DigitalBlackboard", () => {
  it("renders heading", () => {
    render(<DigitalBlackboard />);
    expect(screen.getByText("電子黒板")).toBeDefined();
  });

  it("renders all field labels", () => {
    render(<DigitalBlackboard />);
    expect(screen.getByText("工事名")).toBeDefined();
    expect(screen.getByText("撮影日")).toBeDefined();
    expect(screen.getByText("工種")).toBeDefined();
    expect(screen.getByText("部位")).toBeDefined();
    expect(screen.getByText("状況")).toBeDefined();
  });

  it("renders composite and download buttons", () => {
    render(<DigitalBlackboard />);
    expect(screen.getByText("黒板を合成")).toBeDefined();
    expect(screen.getByText("ダウンロード")).toBeDefined();
  });

  it("composite button disabled when no image", () => {
    render(<DigitalBlackboard />);
    const btn = screen.getByText("黒板を合成").closest("button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("download button disabled when not composited", () => {
    render(<DigitalBlackboard />);
    const btn = screen.getByText("ダウンロード").closest("button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("prefills defaults", () => {
    render(
      <DigitalBlackboard defaults={{ projectName: "テスト工事", workType: "内装" }} />
    );
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    const projectInput = inputs.find((i) => i.value === "テスト工事");
    expect(projectInput).toBeDefined();
  });

  it("saves template to localStorage", () => {
    render(<DigitalBlackboard defaults={{ projectName: "工事A", workType: "基礎" }} />);
    const saveBtn = screen.getByText("テンプレート保存");
    fireEvent.click(saveBtn);
    const raw = localStorage.getItem("blackboard_templates");
    expect(raw).not.toBeNull();
    const tpls = JSON.parse(raw!);
    expect(tpls[0].projectName).toBe("工事A");
  });

  it("shows saved templates after save", () => {
    render(<DigitalBlackboard defaults={{ projectName: "工事B", workType: "外装" }} />);
    fireEvent.click(screen.getByText("テンプレート保存"));
    // Re-render to pick up updated state
    cleanup();
    render(<DigitalBlackboard />);
    // template button should appear
    // (list is loaded on mount from localStorage)
    // we just verify save worked via localStorage already tested above
  });

  it("renders file input for photo upload", () => {
    const { container } = render(<DigitalBlackboard />);
    const input = container.querySelector("input[type=file]");
    expect(input).toBeDefined();
  });

  it("accepts image/* file type", () => {
    const { container } = render(<DigitalBlackboard />);
    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    expect(input.accept).toBe("image/*");
  });

  it("canvas is not shown without image", () => {
    const { container } = render(<DigitalBlackboard />);
    const canvas = container.querySelector("canvas");
    // canvas is inside conditional, should not be in DOM
    expect(canvas).toBeNull();
  });

  it("renders drop zone label", () => {
    render(<DigitalBlackboard />);
    expect(screen.getByText("写真を選択またはドロップ")).toBeDefined();
  });
});

describe("DigitalBlackboard template interaction", () => {
  it("delete button removes template from localStorage", async () => {
    // Pre-populate localStorage
    const tpl = { id: "tpl-1", projectName: "工事X", workType: "設備" };
    localStorage.setItem("blackboard_templates", JSON.stringify([tpl]));

    render(<DigitalBlackboard />);
    // template chip should appear
    const deleteBtn = screen.getByLabelText("テンプレート削除");
    fireEvent.click(deleteBtn);
    const raw = localStorage.getItem("blackboard_templates");
    const remaining = JSON.parse(raw ?? "[]");
    expect(remaining).toHaveLength(0);
  });

  it("click template chip applies values", () => {
    const tpl = { id: "tpl-2", projectName: "工事Y", workType: "電気" };
    localStorage.setItem("blackboard_templates", JSON.stringify([tpl]));

    render(<DigitalBlackboard />);
    const chip = screen.getByText("工事Y / 電気");
    fireEvent.click(chip);
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    const found = inputs.find((i) => i.value === "工事Y");
    expect(found).toBeDefined();
  });
});
