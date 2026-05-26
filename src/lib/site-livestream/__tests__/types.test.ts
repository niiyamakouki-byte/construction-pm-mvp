/**
 * types.test.ts — site-livestream 型定義テスト
 */

import { describe, it, expect } from "vitest";
import {
  makeLivestreamSessionId,
  CHANNEL_KIND_LABELS,
  POST_STATUS_LABELS,
  POSTED_BY_ROLE_LABELS,
  NOTIFICATION_METHOD_LABELS,
  DIGEST_FREQUENCY_LABELS,
} from "../types.js";

describe("makeLivestreamSessionId", () => {
  it("ブランド型IDを生成できる", () => {
    const id = makeLivestreamSessionId("ls-001");
    expect(id).toBe("ls-001");
  });

  it("型アサーションが機能する", () => {
    const raw = "ls-abc-123";
    const id = makeLivestreamSessionId(raw);
    expect(typeof id).toBe("string");
  });
});

describe("CHANNEL_KIND_LABELS", () => {
  it("全チャネル種別のラベルが存在する", () => {
    expect(CHANNEL_KIND_LABELS.live_broadcast).toBe("ライブ配信");
    expect(CHANNEL_KIND_LABELS.fixed_camera).toBe("定点カメラ");
    expect(CHANNEL_KIND_LABELS.recorded_highlight).toBe("録画ハイライト");
    expect(CHANNEL_KIND_LABELS.milestone_summary).toBe("マイルストーン");
  });
});

describe("POST_STATUS_LABELS", () => {
  it("全ステータスのラベルが存在する", () => {
    expect(POST_STATUS_LABELS.pending_review).toBe("審査待ち");
    expect(POST_STATUS_LABELS.published).toBe("公開中");
    expect(POST_STATUS_LABELS.archived).toBe("アーカイブ");
    expect(POST_STATUS_LABELS.flagged).toBe("要確認");
  });
});

describe("POSTED_BY_ROLE_LABELS", () => {
  it("全ロールのラベルが存在する", () => {
    expect(POSTED_BY_ROLE_LABELS.craftsman).toBe("職人");
    expect(POSTED_BY_ROLE_LABELS.supervisor).toBe("監督");
    expect(POSTED_BY_ROLE_LABELS.site_manager).toBe("現場管理者");
  });
});

describe("NOTIFICATION_METHOD_LABELS", () => {
  it("全通知方法のラベルが存在する", () => {
    expect(NOTIFICATION_METHOD_LABELS.email).toBe("メール");
    expect(NOTIFICATION_METHOD_LABELS.discord).toBe("Discord");
    expect(NOTIFICATION_METHOD_LABELS.line).toBe("LINE");
    expect(NOTIFICATION_METHOD_LABELS.push).toBe("プッシュ通知");
  });
});

describe("DIGEST_FREQUENCY_LABELS", () => {
  it("全配信頻度のラベルが存在する", () => {
    expect(DIGEST_FREQUENCY_LABELS.immediate).toBe("即時");
    expect(DIGEST_FREQUENCY_LABELS.daily).toBe("日次");
    expect(DIGEST_FREQUENCY_LABELS.weekly).toBe("週次");
  });
});
