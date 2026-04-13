/**
 * CCUSWorkerProfile拡張機能のテスト（Buildee蒸留 - プロフィール版）
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  registerWorkerCCUS,
  lookupWorkerCCUS,
  recordSiteEntry,
  recordSiteExit,
  getWorkerSiteHistory,
  checkCertificationExpiry,
  getExpiringCertifications,
  calculateWorkerGrade,
  _resetCCUSProfiles,
  type CCUSCertification,
  type CCUSWorkerProfile,
} from "../lib/ccus-integration.js";

const makeCert = (overrides: Partial<CCUSCertification> = {}): CCUSCertification => ({
  name: "内装技能士2級",
  certNumber: "CERT-001",
  issueDate: "2020-01-01",
  expiryDate: "2030-01-01",
  category: "skill",
  ...overrides,
});

const makeProfile = (overrides: Partial<Omit<CCUSWorkerProfile, "id" | "siteHistory" | "currentGrade">> = {}) => ({
  name: "山田太郎",
  ccusId: "12345678901234",
  certifications: [makeCert()],
  registeredSince: "2020-04-01",
  ...overrides,
});

describe("ccus-integration - CCUSWorkerProfile拡張", () => {
  beforeEach(() => {
    _resetCCUSProfiles();
  });

  // ── registerWorkerCCUS ────────────────────────────

  describe("registerWorkerCCUS", () => {
    it("技能者プロフィールを登録して返す", () => {
      const profile = registerWorkerCCUS(makeProfile());

      expect(profile.id).toMatch(/^ccus-profile-/);
      expect(profile.ccusId).toBe("12345678901234");
      expect(profile.name).toBe("山田太郎");
      expect(profile.siteHistory).toEqual([]);
      expect(profile.currentGrade).toBeGreaterThanOrEqual(1);
    });

    it("ccusId が14桁でない場合エラーを投げる", () => {
      expect(() => registerWorkerCCUS(makeProfile({ ccusId: "123" }))).toThrow("ccusId は14桁");
    });

    it("name が空の場合エラーを投げる", () => {
      expect(() => registerWorkerCCUS(makeProfile({ name: "  " }))).toThrow("name は必須");
    });

    it("name のトリミングが行われる", () => {
      const profile = registerWorkerCCUS(makeProfile({ name: "  佐藤花子  " }));
      expect(profile.name).toBe("佐藤花子");
    });

    it("1級施工管理技士保有者はグレード4で登録される", () => {
      const profile = registerWorkerCCUS(
        makeProfile({
          certifications: [makeCert({ name: "1級施工管理技士", category: "skill" })],
          registeredSince: "2020-01-01",
        }),
      );
      expect(profile.currentGrade).toBe(4);
    });
  });

  // ── lookupWorkerCCUS ──────────────────────────────

  describe("lookupWorkerCCUS", () => {
    it("CCUS IDで技能者を検索できる", () => {
      registerWorkerCCUS(makeProfile());
      const found = lookupWorkerCCUS("12345678901234");
      expect(found?.name).toBe("山田太郎");
    });

    it("存在しない CCUS ID は null を返す", () => {
      expect(lookupWorkerCCUS("00000000000000")).toBeNull();
    });
  });

  // ── recordSiteEntry / recordSiteExit ──────────────

  describe("recordSiteEntry / recordSiteExit", () => {
    it("現場入場を記録できる", () => {
      registerWorkerCCUS(makeProfile());
      const timestamp = "2025-04-13T08:00:00.000Z";
      const profile = recordSiteEntry("12345678901234", "proj-001", timestamp);

      expect(profile.siteHistory).toHaveLength(1);
      expect(profile.siteHistory[0].projectId).toBe("proj-001");
      expect(profile.siteHistory[0].entryTimestamp).toBe(timestamp);
      expect(profile.siteHistory[0].exitTimestamp).toBeUndefined();
    });

    it("現場退場を記録すると exitTimestamp が設定される", () => {
      registerWorkerCCUS(makeProfile());
      recordSiteEntry("12345678901234", "proj-001", "2025-04-13T08:00:00.000Z");
      const profile = recordSiteExit("12345678901234", "proj-001", "2025-04-13T17:00:00.000Z");

      expect(profile.siteHistory[0].exitTimestamp).toBe("2025-04-13T17:00:00.000Z");
    });

    it("複数現場への入場を記録できる", () => {
      registerWorkerCCUS(makeProfile());
      recordSiteEntry("12345678901234", "proj-001", "2025-04-13T08:00:00.000Z");
      recordSiteEntry("12345678901234", "proj-002", "2025-04-14T08:00:00.000Z");

      const history = getWorkerSiteHistory("12345678901234");
      expect(history).toHaveLength(2);
    });

    it("未登録技能者の入場はエラーを投げる", () => {
      expect(() =>
        recordSiteEntry("00000000000000", "proj-001", "2025-04-13T08:00:00.000Z"),
      ).toThrow("技能者プロフィールが見つかりません");
    });

    it("入場記録のない現場への退場はエラーを投げる", () => {
      registerWorkerCCUS(makeProfile());
      expect(() =>
        recordSiteExit("12345678901234", "proj-999", "2025-04-13T17:00:00.000Z"),
      ).toThrow("入場記録が見つかりません");
    });

    it("projectId が空の場合エラーを投げる", () => {
      registerWorkerCCUS(makeProfile());
      expect(() =>
        recordSiteEntry("12345678901234", "", "2025-04-13T08:00:00.000Z"),
      ).toThrow("projectId は必須");
    });
  });

  // ── getWorkerSiteHistory ──────────────────────────

  describe("getWorkerSiteHistory", () => {
    it("技能者の現場履歴を返す", () => {
      registerWorkerCCUS(makeProfile());
      recordSiteEntry("12345678901234", "proj-001", "2025-04-13T08:00:00.000Z");

      const history = getWorkerSiteHistory("12345678901234");
      expect(history).toHaveLength(1);
      expect(history[0].projectId).toBe("proj-001");
    });

    it("未登録技能者は空配列を返す", () => {
      expect(getWorkerSiteHistory("00000000000000")).toEqual([]);
    });
  });

  // ── checkCertificationExpiry ──────────────────────

  describe("checkCertificationExpiry", () => {
    it("閾値以内に期限切れになる資格を返す", () => {
      const soonExpiry = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      registerWorkerCCUS(
        makeProfile({
          certifications: [
            makeCert({ name: "特別教育A", expiryDate: soonExpiry }),
            makeCert({ name: "技能士2級", expiryDate: "2099-12-31" }),
          ],
        }),
      );

      const expiring = checkCertificationExpiry("12345678901234", 30);
      expect(expiring).toHaveLength(1);
      expect(expiring[0].name).toBe("特別教育A");
    });

    it("閾値外の資格は含まれない", () => {
      registerWorkerCCUS(
        makeProfile({
          certifications: [makeCert({ expiryDate: "2099-12-31" })],
        }),
      );

      const expiring = checkCertificationExpiry("12345678901234", 30);
      expect(expiring).toHaveLength(0);
    });

    it("未登録技能者は空配列を返す", () => {
      expect(checkCertificationExpiry("00000000000000", 30)).toEqual([]);
    });
  });

  // ── getExpiringCertifications ─────────────────────

  describe("getExpiringCertifications", () => {
    it("複数技能者の期限切れ資格を一括取得できる", () => {
      const soonExpiry = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

      const p1 = registerWorkerCCUS(
        makeProfile({
          ccusId: "11111111111111",
          certifications: [makeCert({ name: "特別教育A", expiryDate: soonExpiry })],
        }),
      );
      const p2 = registerWorkerCCUS(
        makeProfile({
          ccusId: "22222222222222",
          certifications: [makeCert({ expiryDate: "2099-12-31" })],
        }),
      );

      const result = getExpiringCertifications([p1, p2], 30);
      expect(result.size).toBe(1);
      expect(result.has("11111111111111")).toBe(true);
      expect(result.has("22222222222222")).toBe(false);
    });

    it("期限切れ資格がない場合は空のMapを返す", () => {
      const p = registerWorkerCCUS(
        makeProfile({
          certifications: [makeCert({ expiryDate: "2099-12-31" })],
        }),
      );

      const result = getExpiringCertifications([p], 30);
      expect(result.size).toBe(0);
    });
  });

  // ── calculateWorkerGrade ──────────────────────────

  describe("calculateWorkerGrade", () => {
    it("1級施工管理技士 → グレード4", () => {
      registerWorkerCCUS(
        makeProfile({
          certifications: [makeCert({ name: "1級施工管理技士" })],
          registeredSince: "2023-01-01",
        }),
      );
      expect(calculateWorkerGrade("12345678901234")).toBe(4);
    });

    it("経験10年以上 → グレード4", () => {
      registerWorkerCCUS(
        makeProfile({
          certifications: [],
          registeredSince: "2010-01-01",
        }),
      );
      expect(calculateWorkerGrade("12345678901234")).toBe(4);
    });

    it("2級施工管理技士 → グレード3", () => {
      registerWorkerCCUS(
        makeProfile({
          certifications: [makeCert({ name: "2級施工管理技士" })],
          registeredSince: "2023-01-01",
        }),
      );
      expect(calculateWorkerGrade("12345678901234")).toBe(3);
    });

    it("技能士資格 → グレード2", () => {
      registerWorkerCCUS(
        makeProfile({
          certifications: [makeCert({ name: "内装技能士2級" })],
          registeredSince: "2023-01-01",
        }),
      );
      expect(calculateWorkerGrade("12345678901234")).toBe(2);
    });

    it("資格なし・経験1年未満 → グレード1", () => {
      registerWorkerCCUS(
        makeProfile({
          certifications: [],
          registeredSince: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10),
        }),
      );
      expect(calculateWorkerGrade("12345678901234")).toBe(1);
    });

    it("未登録技能者はエラーを投げる", () => {
      expect(() => calculateWorkerGrade("00000000000000")).toThrow(
        "技能者プロフィールが見つかりません",
      );
    });
  });
});
