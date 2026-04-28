/**
 * assistantCommands テスト
 */
import { describe, it, expect } from "vitest";
import { handleInput } from "../lib/assistantCommands.js";

describe("handleInput - /estimate", () => {
  it("壁紙・LDK・30㎡ で見積テキストを返す", () => {
    const result = handleInput("/estimate 壁紙 LDK 30㎡");
    expect(result.text).toContain("LDK");
    expect(result.text).toContain("壁紙");
    expect(result.text).toContain("見積");
  });

  it("引数省略時もデフォルト値で動作する", () => {
    const result = handleInput("/estimate");
    expect(result.text).toContain("見積");
  });
});

describe("handleInput - /schedule", () => {
  it("現場・工程を含む返答を返す", () => {
    const result = handleInput("/schedule 南青山 内装");
    expect(result.text).toContain("南青山");
    expect(result.text).toContain("内装");
  });

  it("引数省略時もデフォルト値で動作する", () => {
    const result = handleInput("/schedule");
    expect(result.text).toContain("工程");
  });
});

describe("handleInput - /cost", () => {
  it("案件名を含むコスト報告を返す", () => {
    const result = handleInput("/cost 南青山案件");
    expect(result.text).toContain("南青山案件");
    expect(result.text).toContain("予算");
  });

  it("引数省略時もデフォルト値で動作する", () => {
    const result = handleInput("/cost");
    expect(result.text).toContain("予算");
  });
});

describe("handleInput - /safety", () => {
  it("現場名を含むKY項目を返す", () => {
    const result = handleInput("/safety 南青山");
    expect(result.text).toContain("南青山");
    expect(result.text).toContain("KY");
  });

  it("引数省略時もデフォルト値で動作する", () => {
    const result = handleInput("/safety");
    expect(result.text).toContain("KY");
  });
});

describe("handleInput - /help", () => {
  it("全コマンドリストを含む返答を返す", () => {
    const result = handleInput("/help");
    expect(result.text).toContain("/estimate");
    expect(result.text).toContain("/schedule");
    expect(result.text).toContain("/cost");
    expect(result.text).toContain("/safety");
    expect(result.text).toContain("/help");
  });
});

describe("handleInput - 自然文", () => {
  it("自然文は自然言語未対応メッセージを返す", () => {
    const result = handleInput("おはようございます");
    expect(result.text).toContain("/help");
    expect(result.text).toContain("自然言語");
  });

  it("空文字列は自然言語未対応メッセージを返す", () => {
    const result = handleInput("");
    expect(result.text).toContain("/help");
  });
});

describe("handleInput - 未知コマンド", () => {
  it("未定義コマンドは未対応メッセージを返す", () => {
    const result = handleInput("/unknown");
    expect(result.text).toContain("/help");
    expect(result.text).toContain("未対応");
  });
});
