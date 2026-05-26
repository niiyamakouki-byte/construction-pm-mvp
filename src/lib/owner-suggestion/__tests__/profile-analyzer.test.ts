/**
 * profile-analyzer.test.ts
 */

import { describe, it, expect } from "vitest";
import { analyzeProfile } from "../profile-analyzer.js";
import type { OwnerProfile } from "../types.js";

function makeProfile(overrides: Partial<OwnerProfile> = {}): OwnerProfile {
  return {
    ownerName: "テスト施主",
    budget: 8000000,
    familySize: 2,
    ageRange: "40s",
    lifestyle: [],
    priorityRanking: "qualityFirst",
    ...overrides,
  };
}

describe("analyzeProfile", () => {
  it("ライフスタイルなしの場合、推奨優先項目は空", () => {
    const result = analyzeProfile(makeProfile({ lifestyle: [] }));
    expect(result.recommendedPrioritiesJa).toHaveLength(0);
    expect(result.emphasizeElderlycare).toBe(false);
    expect(result.emphasizePetFriendly).toBe(false);
  });

  it("cooking タグで IH 関連の優先項目が含まれる", () => {
    const result = analyzeProfile(makeProfile({ lifestyle: ["cooking"] }));
    expect(result.recommendedPrioritiesJa.some((p) => p.includes("IH"))).toBe(true);
  });

  it("pet_owner タグで emphasizePetFriendly が true", () => {
    const result = analyzeProfile(makeProfile({ lifestyle: ["pet_owner"] }));
    expect(result.emphasizePetFriendly).toBe(true);
  });

  it("elderly_care タグで emphasizeElderlycare が true", () => {
    const result = analyzeProfile(makeProfile({ lifestyle: ["elderly_care"] }));
    expect(result.emphasizeElderlycare).toBe(true);
  });

  it("ageRange 60s+ で elderly_care なしでも emphasizeElderlycare が true", () => {
    const result = analyzeProfile(makeProfile({ ageRange: "60s+", lifestyle: [] }));
    expect(result.emphasizeElderlycare).toBe(true);
  });

  it("work_from_home タグで防音関連の材料推奨が含まれる", () => {
    const result = analyzeProfile(makeProfile({ lifestyle: ["work_from_home"] }));
    expect(result.materialRecommendations.some((r) => r.location.includes("書斎"))).toBe(true);
  });

  it("複数タグで推奨項目が重複なくまとめられる", () => {
    const result = analyzeProfile(
      makeProfile({ lifestyle: ["cooking", "pet_owner", "work_from_home"] }),
    );
    const unique = new Set(result.recommendedPrioritiesJa);
    expect(unique.size).toBe(result.recommendedPrioritiesJa.length);
  });

  it("entertain_guests タグで材料推奨にLDK壁紙が含まれる", () => {
    const result = analyzeProfile(makeProfile({ lifestyle: ["entertain_guests"] }));
    expect(result.materialRecommendations.some((r) => r.location.includes("LDK"))).toBe(true);
  });
});
