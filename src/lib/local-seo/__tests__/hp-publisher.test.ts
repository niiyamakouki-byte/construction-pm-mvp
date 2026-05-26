import { beforeEach, describe, expect, it, vi } from "vitest";

const execFileSyncMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
  default: {
    execFileSync: execFileSyncMock,
  },
  execFileSync: execFileSyncMock,
}));

import {
  buildDynamicImportScript,
  isSlugCollisionError,
  publishHpPost,
} from "../hp-publisher.js";

const PARAMS = {
  slug: "art-001",
  title: "世田谷区の内装リノベーション事例",
  description: "世田谷区で実施した内装リノベーションの施工事例です。",
  keywords: ["世田谷区 マンション リフォーム"],
  category: "interior-seo",
  body: "# 世田谷区の内装リノベーション事例\n\n本文",
};

beforeEach(() => {
  execFileSyncMock.mockReset();
  delete process.env["LAPORTA_HP_BLOG_MCP_PATH"];
});

describe("publishHpPost", () => {
  it("LAPORTA_HP_BLOG_MCP_PATH 配下の dist/tools.js を dynamic import して createPost を呼ぶ", () => {
    execFileSyncMock.mockReturnValue(JSON.stringify({ slug: "art-001", sha: "abc1234" }));
    process.env["LAPORTA_HP_BLOG_MCP_PATH"] = "/Users/koki/laporta-hp-blog-mcp";

    const result = publishHpPost(PARAMS);

    expect(result).toEqual({ slug: "art-001", sha: "abc1234" });
    expect(execFileSyncMock).toHaveBeenCalledTimes(1);
    const call = execFileSyncMock.mock.calls[0];
    expect(call[0]).toBe(process.execPath);
    expect(call[1]).toEqual([
      "--input-type=module",
      "-e",
      expect.stringContaining('await import("/Users/koki/laporta-hp-blog-mcp/dist/tools.js")'),
    ]);
    expect(call[2]).toMatchObject({
      cwd: "/Users/koki/laporta-hp-blog-mcp",
      input: JSON.stringify(PARAMS),
    });
  });

  it("環境変数が未設定の場合は明示エラーにする", () => {
    expect(() => publishHpPost(PARAMS)).toThrow(
      "LAPORTA_HP_BLOG_MCP_PATH is required",
    );
    expect(execFileSyncMock).not.toHaveBeenCalled();
  });

  it("createPost 呼び出し失敗を明示エラーとして投げる", () => {
    execFileSyncMock.mockImplementation(() => {
      throw new Error("Cannot find module dist/tools.js");
    });
    process.env["LAPORTA_HP_BLOG_MCP_PATH"] = "/missing/mcp";

    expect(() => publishHpPost(PARAMS)).toThrow(
      'laporta-hp-blog-mcp createPost failed for slug "art-001"',
    );
  });
});

describe("isSlugCollisionError", () => {
  it("laporta-hp-blog-mcp の slug 衝突エラーを判定する", () => {
    expect(isSlugCollisionError(new Error("Slug already exists: art-001"))).toBe(true);
    expect(isSlugCollisionError(new Error("Cannot find module"))).toBe(false);
  });
});

describe("buildDynamicImportScript", () => {
  it("createPost export を dynamic import 経由で参照するスクリプトを生成する", () => {
    const script = buildDynamicImportScript("/tmp/mcp/dist/tools.js");

    expect(script).toContain('await import("/tmp/mcp/dist/tools.js")');
    expect(script).toContain("module.createPost(params)");
  });
});
