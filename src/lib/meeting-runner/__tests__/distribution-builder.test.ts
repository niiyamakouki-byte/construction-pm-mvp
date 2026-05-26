/**
 * distribution-builder unit tests.
 */

import { describe, it, expect } from "vitest";
import {
  buildDiscordMessage,
  buildEmailHtml,
  buildMarkdown,
  buildDistribution,
} from "../distribution-builder.js";
import type { MeetingSession, MeetingMinutes } from "../types.js";
import { makeMeetingId } from "../types.js";

function makeSession(overrides: Partial<MeetingSession> = {}): MeetingSession {
  return {
    id: makeMeetingId("m-dist-test"),
    projectId: "proj-123",
    scheduledAt: "2026-05-09T10:00:00Z",
    kind: "weekly_progress",
    agendaItems: [],
    participants: ["新山", "田中"],
    ...overrides,
  };
}

function makeMinutes(overrides: Partial<MeetingMinutes> = {}): MeetingMinutes {
  return {
    meetingId: makeMeetingId("m-dist-test"),
    decisions: ["外壁材をAパネルに決定"],
    actionItems: [
      {
        id: "a-1",
        description: "図面修正",
        assignee: "田中",
        dueDate: "2026-05-15",
        status: "open",
      },
    ],
    unresolvedItems: [
      {
        id: "u-1",
        title: "設備仕様の確認",
        source: "previous_unresolved",
        priority: 2,
        estimatedMinutes: 10,
        owner: "鈴木",
        status: "deferred",
      },
    ],
    ...overrides,
  };
}

describe("buildDiscordMessage", () => {
  it("週次工程会議のヘッダが含まれる", () => {
    const msg = buildDiscordMessage(makeSession(), makeMinutes());
    expect(msg).toContain("週次工程会議");
    expect(msg).toContain("議事録");
  });

  it("決定事項が含まれる", () => {
    const msg = buildDiscordMessage(makeSession(), makeMinutes());
    expect(msg).toContain("外壁材をAパネルに決定");
  });

  it("アクションアイテムが含まれる", () => {
    const msg = buildDiscordMessage(makeSession(), makeMinutes());
    expect(msg).toContain("田中");
    expect(msg).toContain("図面修正");
  });

  it("次回持越しが含まれる", () => {
    const msg = buildDiscordMessage(makeSession(), makeMinutes());
    expect(msg).toContain("設備仕様の確認");
  });

  it("決定事項がなければセクションが省略される", () => {
    const msg = buildDiscordMessage(makeSession(), makeMinutes({ decisions: [] }));
    expect(msg).not.toContain("決定事項");
  });
});

describe("buildEmailHtml", () => {
  it("有効なHTMLを生成する", () => {
    const html = buildEmailHtml(makeSession(), makeMinutes());
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
  });

  it("セージグリーンが使われている", () => {
    const html = buildEmailHtml(makeSession(), makeMinutes());
    expect(html).toContain("#6B8E5A");
  });

  it("決定事項テーブルが含まれる", () => {
    const html = buildEmailHtml(makeSession(), makeMinutes());
    expect(html).toContain("外壁材をAパネルに決定");
  });

  it("アクションテーブルが含まれる", () => {
    const html = buildEmailHtml(makeSession(), makeMinutes());
    expect(html).toContain("<table");
    expect(html).toContain("田中");
  });
});

describe("buildMarkdown", () => {
  it("Markdown形式で出力される", () => {
    const md = buildMarkdown(makeSession(), makeMinutes());
    expect(md).toContain("# 週次工程会議");
    expect(md).toContain("## 決定事項");
    expect(md).toContain("## アクションアイテム");
  });

  it("テーブル形式でアクションアイテムが出力される", () => {
    const md = buildMarkdown(makeSession(), makeMinutes());
    expect(md).toContain("| 担当者 |");
    expect(md).toContain("| 田中 |");
  });

  it("参加者リストが含まれる", () => {
    const md = buildMarkdown(makeSession(), makeMinutes());
    expect(md).toContain("新山");
    expect(md).toContain("田中");
  });
});

describe("buildDistribution", () => {
  it("discord フォーマットを正しくルーティングする", () => {
    const result = buildDistribution(makeSession(), makeMinutes(), "discord");
    expect(result).toContain("##");
  });

  it("email_html フォーマットを正しくルーティングする", () => {
    const result = buildDistribution(makeSession(), makeMinutes(), "email_html");
    expect(result).toContain("<!DOCTYPE html>");
  });

  it("markdown フォーマットを正しくルーティングする", () => {
    const result = buildDistribution(makeSession(), makeMinutes(), "markdown");
    expect(result).toContain("# 週次工程会議");
  });
});
