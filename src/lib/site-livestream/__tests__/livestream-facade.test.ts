/**
 * livestream-facade.test.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createSession,
  addPost,
  markPostPublished,
  archivePost,
  getSessionByProject,
  listAllSessions,
  getSession,
  removeSession,
} from "../livestream-facade.js";
import { _resetLivestreamStore } from "../livestream-store.js";
import { _clearNotificationQueue } from "../owner-notifier.js";
import type { LivestreamPost, OwnerNotificationPreference } from "../types.js";
import { makeLivestreamSessionId } from "../types.js";

// ── localStorage mock ──────────────────────────────────────────────────────

const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
});

const defaultPrefs: OwnerNotificationPreference = {
  ownerName: "田中施主",
  projectId: "proj-001",
  channels: ["email"],
  digestFrequency: "immediate",
  quietHours: { start: "22:00", end: "07:00" },
};

function makePostData(overrides: Partial<LivestreamPost> = {}): LivestreamPost {
  return {
    id: `post-${Date.now()}-${Math.random()}`,
    projectId: "proj-001",
    channelKind: "recorded_highlight",
    postedByName: "田中",
    postedByRole: "supervisor",
    title: "解体作業の進捗",
    description: "1F解体完了",
    mediaKind: "video",
    durationSec: 300,
    capturedAt: "2026-05-09T10:00:00.000Z",
    status: "pending_review",
    autoCaptionsJa: "",
    ownerNotificationSent: false,
    viewCount: 0,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  _resetLivestreamStore();
  _clearNotificationQueue();
});

describe("createSession", () => {
  it("セッションが作成される", () => {
    const session = createSession("proj-001", "田中施主", defaultPrefs);
    expect(session.id).toMatch(/^ls-/);
    expect(session.projectId).toBe("proj-001");
    expect(session.ownerName).toBe("田中施主");
    expect(session.posts).toHaveLength(0);
  });

  it("ストアに保存される", () => {
    const session = createSession("proj-001", "田中施主", defaultPrefs);
    expect(getSession(session.id)).not.toBeNull();
  });

  it("now パラメータが lastActivityAt に反映される", () => {
    const now = new Date("2026-05-09T12:00:00.000Z");
    const session = createSession("proj-001", "田中施主", defaultPrefs, now);
    expect(session.lastActivityAt).toBe("2026-05-09T12:00:00.000Z");
  });
});

describe("addPost", () => {
  it("投稿が追加される", () => {
    const session = createSession("proj-001", "田中施主", defaultPrefs);
    const post = makePostData();
    const updated = addPost(session.id, post);
    expect(updated?.posts).toHaveLength(1);
  });

  it("キャプションが自動生成される", () => {
    const session = createSession("proj-001", "田中施主", defaultPrefs);
    const post = makePostData();
    const updated = addPost(session.id, post);
    expect(updated?.posts[0].autoCaptionsJa).not.toBe("");
  });

  it("totalDurationSec が更新される", () => {
    const session = createSession("proj-001", "田中施主", defaultPrefs);
    const post = makePostData({ durationSec: 300 });
    const updated = addPost(session.id, post);
    expect(updated?.totalDurationSec).toBe(300);
  });

  it("NGワード含む投稿は flagged になる", () => {
    const session = createSession("proj-001", "田中施主", defaultPrefs);
    const post = makePostData({ title: "バカな施工" });
    const updated = addPost(session.id, post);
    expect(updated?.posts[0].status).toBe("flagged");
  });

  it("存在しないセッションIDは null", () => {
    const result = addPost(makeLivestreamSessionId("nonexistent"), makePostData());
    expect(result).toBeNull();
  });
});

describe("markPostPublished", () => {
  it("投稿が published になる", () => {
    const session = createSession("proj-001", "田中施主", defaultPrefs);
    const post = makePostData({ id: "post-abc" });
    addPost(session.id, post);
    const updated = markPostPublished(session.id, "post-abc");
    const p = updated?.posts.find((x) => x.id === "post-abc");
    expect(p?.status).toBe("published");
  });

  it("存在しないセッションIDは null", () => {
    expect(markPostPublished(makeLivestreamSessionId("nonexistent"), "post-abc")).toBeNull();
  });
});

describe("archivePost", () => {
  it("投稿が archived になる", () => {
    const session = createSession("proj-001", "田中施主", defaultPrefs);
    const post = makePostData({ id: "post-xyz" });
    addPost(session.id, post);
    const updated = archivePost(session.id, "post-xyz");
    const p = updated?.posts.find((x) => x.id === "post-xyz");
    expect(p?.status).toBe("archived");
  });
});

describe("getSessionByProject", () => {
  it("プロジェクトIDでセッションを取得できる", () => {
    createSession("proj-999", "施主X", { ...defaultPrefs, projectId: "proj-999" });
    const found = getSessionByProject("proj-999");
    expect(found?.projectId).toBe("proj-999");
  });

  it("存在しないプロジェクトは null", () => {
    expect(getSessionByProject("nonexistent")).toBeNull();
  });
});

describe("listAllSessions", () => {
  it("全セッションを返す", () => {
    createSession("proj-A", "施主A", defaultPrefs);
    createSession("proj-B", "施主B", { ...defaultPrefs, projectId: "proj-B" });
    expect(listAllSessions()).toHaveLength(2);
  });
});

describe("removeSession", () => {
  it("削除後は getSession で null", () => {
    const session = createSession("proj-001", "田中施主", defaultPrefs);
    removeSession(session.id);
    expect(getSession(session.id)).toBeNull();
  });
});
