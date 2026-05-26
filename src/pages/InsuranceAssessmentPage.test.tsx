import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { InsuranceAssessmentPage } from "./InsuranceAssessmentPage.js";

afterEach(() => {
  cleanup();
});

describe("InsuranceAssessmentPage", () => {
  it("renders the page title", () => {
    const { container } = render(<InsuranceAssessmentPage />);
    const h1 = container.querySelector("h1");
    expect(h1?.textContent).toBe("工事保険AI査定");
  });

  it("renders all 4 tab buttons", () => {
    const { container } = render(<InsuranceAssessmentPage />);
    const tabBar = container.querySelector(".rounded-xl.bg-slate-100");
    expect(tabBar).not.toBeNull();
    const buttons = tabBar!.querySelectorAll("button");
    expect(buttons).toHaveLength(4);
  });

  it("assessment tab is active by default and shows form", () => {
    const { container } = render(<InsuranceAssessmentPage />);
    const h2s = container.querySelectorAll("h2");
    const titles = Array.from(h2s).map((el) => el.textContent);
    expect(titles).toContain("損害情報入力");
  });

  it("shows damage type selector in assessment tab", () => {
    const { container } = render(<InsuranceAssessmentPage />);
    const selects = container.querySelectorAll("select");
    expect(selects.length).toBeGreaterThan(0);
  });

  it("switches to drone tab on click", () => {
    const { container } = render(<InsuranceAssessmentPage />);
    const tabBar = container.querySelector(".rounded-xl.bg-slate-100")!;
    const buttons = tabBar.querySelectorAll("button");
    // tab order: assessment(0), drone(1), pml(2), pricing(3)
    fireEvent.click(buttons[1]);
    const h2s = container.querySelectorAll("h2");
    const titles = Array.from(h2s).map((el) => el.textContent);
    expect(titles).toContain("ドローン撮影条件");
  });

  it("switches to PML tab on click", () => {
    const { container } = render(<InsuranceAssessmentPage />);
    const tabBar = container.querySelector(".rounded-xl.bg-slate-100")!;
    const buttons = tabBar.querySelectorAll("button");
    fireEvent.click(buttons[2]);
    const h2s = container.querySelectorAll("h2");
    const titles = Array.from(h2s).map((el) => el.textContent);
    expect(titles).toContain("建物情報入力");
  });

  it("switches to pricing tab on click", () => {
    const { container } = render(<InsuranceAssessmentPage />);
    const tabBar = container.querySelector(".rounded-xl.bg-slate-100")!;
    const buttons = tabBar.querySelectorAll("button");
    fireEvent.click(buttons[3]);
    const h2s = container.querySelectorAll("h2");
    const titles = Array.from(h2s).map((el) => el.textContent);
    expect(titles).toContain("プラン診断");
  });

  it("shows 3 plan cards in pricing tab", () => {
    const { container } = render(<InsuranceAssessmentPage />);
    const tabBar = container.querySelector(".rounded-xl.bg-slate-100")!;
    fireEvent.click(tabBar.querySelectorAll("button")[3]);
    const allText = container.textContent ?? "";
    expect(allText).toContain("スターター");
    expect(allText).toContain("プロフェッショナル");
    expect(allText).toContain("エンタープライズ");
  });

  it("submits assessment form and shows result card", () => {
    const { container } = render(<InsuranceAssessmentPage />);
    const form = container.querySelector("form")!;
    const submitBtn = form.querySelector("button[type='submit']")!;
    fireEvent.click(submitBtn);
    const h2s = container.querySelectorAll("h2");
    const titles = Array.from(h2s).map((el) => el.textContent);
    expect(titles).toContain("査定結果");
  });

  it("submits drone form and shows result card", () => {
    const { container } = render(<InsuranceAssessmentPage />);
    const tabBar = container.querySelector(".rounded-xl.bg-slate-100")!;
    fireEvent.click(tabBar.querySelectorAll("button")[1]);
    const form = container.querySelector("form")!;
    fireEvent.click(form.querySelector("button[type='submit']")!);
    const h2s = container.querySelectorAll("h2");
    const titles = Array.from(h2s).map((el) => el.textContent);
    expect(titles).toContain("ドローン査定結果");
  });

  it("submits PML form and shows result", () => {
    const { container } = render(<InsuranceAssessmentPage />);
    const tabBar = container.querySelector(".rounded-xl.bg-slate-100")!;
    fireEvent.click(tabBar.querySelectorAll("button")[2]);
    const form = container.querySelector("form")!;
    fireEvent.click(form.querySelector("button[type='submit']")!);
    const h2s = container.querySelectorAll("h2");
    const titles = Array.from(h2s).map((el) => el.textContent);
    expect(titles).toContain("PML算出結果");
  });
});
