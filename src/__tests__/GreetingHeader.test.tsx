import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import { GreetingHeader, getGreeting } from "../components/GreetingHeader.js";

// framer-motion をスタブ (jsdom では AnimationFrame が動かない)
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...rest}>{children}</div>
    ),
  },
}));

afterEach(() => cleanup());

describe("getGreeting()", () => {
  it("5〜10時 → おはようございます", () => {
    expect(getGreeting(5)).toBe("おはようございます");
    expect(getGreeting(10)).toBe("おはようございます");
  });

  it("11〜16時 → お疲れ様です", () => {
    expect(getGreeting(11)).toBe("お疲れ様です");
    expect(getGreeting(16)).toBe("お疲れ様です");
  });

  it("17〜22時 → お疲れ様でした", () => {
    expect(getGreeting(17)).toBe("お疲れ様でした");
    expect(getGreeting(22)).toBe("お疲れ様でした");
  });

  it("23〜4時 → 夜遅くまでお疲れ様です", () => {
    expect(getGreeting(23)).toBe("夜遅くまでお疲れ様です");
    expect(getGreeting(0)).toBe("夜遅くまでお疲れ様です");
    expect(getGreeting(4)).toBe("夜遅くまでお疲れ様です");
  });
});

describe("GreetingHeader", () => {
  it("デフォルト userName が表示される", () => {
    const now = new Date("2026-04-29T09:00:00");
    render(<GreetingHeader now={now} />);
    expect(screen.getByText(/光輝さん/)).toBeDefined();
  });

  it("カスタム userName が表示される", () => {
    const now = new Date("2026-04-29T09:00:00");
    render(<GreetingHeader userName="テストさん" now={now} />);
    expect(screen.getByText(/テストさん/)).toBeDefined();
  });

  it("朝の挨拶が表示される (9時)", () => {
    const now = new Date("2026-04-29T09:00:00");
    render(<GreetingHeader now={now} />);
    expect(screen.getByText(/おはようございます/)).toBeDefined();
  });

  it("昼の挨拶が表示される (14時)", () => {
    const now = new Date("2026-04-29T14:00:00");
    render(<GreetingHeader now={now} />);
    expect(screen.getByText(/お疲れ様です/)).toBeDefined();
  });

  it("夕方の挨拶が表示される (19時)", () => {
    const now = new Date("2026-04-29T19:00:00");
    render(<GreetingHeader now={now} />);
    expect(screen.getByText(/お疲れ様でした/)).toBeDefined();
  });

  it("深夜の挨拶が表示される (2時)", () => {
    const now = new Date("2026-04-29T02:00:00");
    render(<GreetingHeader now={now} />);
    expect(screen.getByText(/夜遅くまでお疲れ様です/)).toBeDefined();
  });

  it("日付と曜日が表示される", () => {
    const now = new Date("2026-04-29T09:00:00");
    render(<GreetingHeader now={now} />);
    expect(screen.getByText(/2026年4月29日/)).toBeDefined();
    expect(screen.getByText(/水曜日/)).toBeDefined();
  });
});
