/**
 * assistantParser テスト
 */
import { describe, it, expect } from "vitest";
import { parseMessage } from "../lib/assistantParser.js";

describe("parseMessage", () => {
  it("/estimate 壁紙 LDK 30㎡ → command parse 正常", () => {
    const result = parseMessage("/estimate 壁紙 LDK 30㎡");
    expect(result.type).toBe("command");
    if (result.type === "command") {
      expect(result.command).toBe("estimate");
      expect(result.args).toEqual(["壁紙", "LDK", "30㎡"]);
    }
  });

  it("/schedule 南青山 内装 → command parse 正常", () => {
    const result = parseMessage("/schedule 南青山 内装");
    expect(result.type).toBe("command");
    if (result.type === "command") {
      expect(result.command).toBe("schedule");
      expect(result.args).toEqual(["南青山", "内装"]);
    }
  });

  it("/help → command parse 正常 (args 空)", () => {
    const result = parseMessage("/help");
    expect(result.type).toBe("command");
    if (result.type === "command") {
      expect(result.command).toBe("help");
      expect(result.args).toEqual([]);
    }
  });

  it("自然文 → type=natural", () => {
    const result = parseMessage("おはようございます");
    expect(result.type).toBe("natural");
    if (result.type === "natural") {
      expect(result.text).toBe("おはようございます");
    }
  });

  it("空文字列 → type=natural", () => {
    const result = parseMessage("");
    expect(result.type).toBe("natural");
    if (result.type === "natural") {
      expect(result.text).toBe("");
    }
  });

  it("スペースのみ → type=natural (trimmed)", () => {
    const result = parseMessage("   ");
    expect(result.type).toBe("natural");
  });

  it("/cost 南青山案件 → command parse 正常", () => {
    const result = parseMessage("/cost 南青山案件");
    expect(result.type).toBe("command");
    if (result.type === "command") {
      expect(result.command).toBe("cost");
      expect(result.args).toEqual(["南青山案件"]);
    }
  });

  it("/safety 南青山 → command parse 正常", () => {
    const result = parseMessage("/safety 南青山");
    expect(result.type).toBe("command");
    if (result.type === "command") {
      expect(result.command).toBe("safety");
      expect(result.args).toEqual(["南青山"]);
    }
  });
});
