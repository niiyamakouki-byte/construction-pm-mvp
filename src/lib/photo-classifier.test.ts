import { describe, expect, it } from "vitest";
import {
  classifyByFilename,
  classifyByMetadata,
  autoSortPhotos,
  groupPhotosByCategory,
  groupPhotosByDate,
  groupPhotosByFloor,
  createAlbumFromGroup,
  generatePhotoIndex,
  searchPhotos,
  getPhotoStats,
  detectDuplicates,
  suggestMissingPhotos,
  getDefaultSortRules,
  type ClassifiedPhoto,
  type PhotoAlbum,
  type PhotoCategory,
} from "./photo-classifier.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePhoto(
  overrides: Partial<ClassifiedPhoto> & { filename: string },
): ClassifiedPhoto {
  const classification = overrides.classification ?? classifyByFilename(overrides.filename);
  return {
    id: `photo_${Math.random().toString(36).slice(2)}`,
    projectId: "proj_001",
    takenAt: new Date("2025-06-15T10:00:00Z"),
    ...overrides,
    classification,
  };
}

// ── classifyByFilename ────────────────────────────────────────────────────────

describe("classifyByFilename", () => {
  describe("Japanese construction terminology", () => {
    it("基礎 → foundation", () => {
      const r = classifyByFilename("基礎工事_001.jpg");
      expect(r.category).toBe("foundation");
    });

    it("杭打 → foundation", () => {
      const r = classifyByFilename("杭打工事_B1.jpg");
      expect(r.category).toBe("foundation");
    });

    it("根切 → foundation", () => {
      const r = classifyByFilename("根切り作業_2025.jpg");
      expect(r.category).toBe("foundation");
    });

    it("配筋 → framing", () => {
      const r = classifyByFilename("配筋検査_3F.jpg");
      expect(r.category).toBe("framing");
    });

    it("型枠 → framing", () => {
      const r = classifyByFilename("型枠組立_2F.jpg");
      expect(r.category).toBe("framing");
    });

    it("コンクリ → framing", () => {
      const r = classifyByFilename("コンクリート打設_スラブ.jpg");
      expect(r.category).toBe("framing");
    });

    it("配管 → mep_rough", () => {
      const r = classifyByFilename("配管工事_衛生.jpg");
      expect(r.category).toBe("mep_rough");
    });

    it("ダクト → mep_rough", () => {
      const r = classifyByFilename("空調ダクト設置.jpg");
      expect(r.category).toBe("mep_rough");
    });

    it("照明 → mep_finish", () => {
      const r = classifyByFilename("照明器具取付.jpg");
      expect(r.category).toBe("mep_finish");
    });

    it("スイッチ → mep_finish", () => {
      const r = classifyByFilename("スイッチ設置_1F.jpg");
      expect(r.category).toBe("mep_finish");
    });

    it("LGS → interior_rough", () => {
      const r = classifyByFilename("LGS下地組み.jpg");
      expect(r.category).toBe("interior_rough");
    });

    it("ボード → interior_rough", () => {
      const r = classifyByFilename("石膏ボード貼り_2F.jpg");
      expect(r.category).toBe("interior_rough");
    });

    it("クロス → interior_finish", () => {
      const r = classifyByFilename("クロス張り_完了.jpg");
      expect(r.category).toBe("interior_finish");
    });

    it("フローリング → interior_finish", () => {
      const r = classifyByFilename("フローリング施工_3F.jpg");
      expect(r.category).toBe("interior_finish");
    });

    it("外壁 → exterior", () => {
      const r = classifyByFilename("外壁タイル_南面.jpg");
      expect(r.category).toBe("exterior");
    });

    it("サッシ → exterior", () => {
      const r = classifyByFilename("サッシ取付_東側.jpg");
      expect(r.category).toBe("exterior");
    });

    it("防水 → waterproof", () => {
      const r = classifyByFilename("防水工事_屋上.jpg");
      expect(r.category).toBe("waterproof");
    });

    it("シーリング → waterproof", () => {
      const r = classifyByFilename("シーリング施工_外壁目地.jpg");
      expect(r.category).toBe("waterproof");
    });

    it("安全 → safety", () => {
      const r = classifyByFilename("安全確認_朝礼.jpg");
      expect(r.category).toBe("safety");
    });

    it("KY → safety", () => {
      const r = classifyByFilename("KY活動_2025.jpg");
      expect(r.category).toBe("safety");
    });

    it("全景 → progress", () => {
      const r = classifyByFilename("全景_2025-04.jpg");
      expect(r.category).toBe("progress");
    });

    it("進捗 → progress", () => {
      const r = classifyByFilename("施工状況_進捗.jpg");
      expect(r.category).toBe("progress");
    });

    it("是正 → defect", () => {
      const r = classifyByFilename("是正箇所_B1F.jpg");
      expect(r.category).toBe("defect");
    });

    it("手直 → defect", () => {
      const r = classifyByFilename("手直し_クロス.jpg");
      expect(r.category).toBe("defect");
    });

    it("搬入 → material", () => {
      const r = classifyByFilename("資材搬入_鉄骨.jpg");
      expect(r.category).toBe("material");
    });

    it("荷受 → material", () => {
      const r = classifyByFilename("荷受検査_木材.jpg");
      expect(r.category).toBe("material");
    });

    it("クレーン → equipment", () => {
      const r = classifyByFilename("タワークレーン_設置.jpg");
      expect(r.category).toBe("equipment");
    });

    it("足場 → equipment", () => {
      const r = classifyByFilename("足場組立_外周.jpg");
      expect(r.category).toBe("equipment");
    });

    it("unrecognized → other", () => {
      const r = classifyByFilename("IMG_20250101_001.jpg");
      expect(r.category).toBe("other");
    });
  });

  describe("confidence score", () => {
    it("matched photo has confidence > 0", () => {
      const r = classifyByFilename("基礎工事.jpg");
      expect(r.confidence).toBeGreaterThan(0);
      expect(r.confidence).toBeLessThanOrEqual(1.0);
    });

    it("unmatched photo has confidence 0", () => {
      const r = classifyByFilename("IMG_001.jpg");
      expect(r.confidence).toBe(0);
    });
  });

  describe("tags", () => {
    it("attaches floor tag from filename", () => {
      const r = classifyByFilename("配筋_3F.jpg");
      expect(r.tags).toContain("3F");
    });

    it("attaches before tag", () => {
      const r = classifyByFilename("施工前_外観.jpg");
      expect(r.tags).toContain("before");
    });

    it("attaches after tag", () => {
      const r = classifyByFilename("施工後_内装.jpg");
      expect(r.tags).toContain("after");
    });

    it("attaches inspection tag", () => {
      const r = classifyByFilename("配筋検査_2F.jpg");
      expect(r.tags).toContain("inspection");
    });

    it("tags is always an array", () => {
      const r = classifyByFilename("IMG_999.jpg");
      expect(Array.isArray(r.tags)).toBe(true);
    });
  });
});

// ── classifyByMetadata ────────────────────────────────────────────────────────

describe("classifyByMetadata", () => {
  it("classifies based on filename when no exif", () => {
    const r = classifyByMetadata({ filename: "基礎_001.jpg" });
    expect(r.category).toBe("foundation");
  });

  it("boosts confidence with exif data present", () => {
    const base = classifyByFilename("基礎_001.jpg");
    const enhanced = classifyByMetadata({
      filename: "基礎_001.jpg",
      exifData: { Make: "Canon", Model: "EOS R5" },
    });
    expect(enhanced.confidence).toBeGreaterThanOrEqual(base.confidence);
  });

  it("adds gps tag when GPS coordinates present", () => {
    const r = classifyByMetadata({
      filename: "現場_001.jpg",
      exifData: {
        GPSLatitude: 35.6762,
        GPSLongitude: 139.6503,
      },
    });
    expect(r.tags).toContain("gps");
  });

  it("adds seasonal phase tag from exif date", () => {
    const r = classifyByMetadata({
      filename: "工事_001.jpg",
      exifData: { DateTimeOriginal: "2025-07-15T10:00:00Z" },
    });
    expect(r.tags).toContain("phase:summer");
  });

  it("adds seasonal phase tag from takenAt date", () => {
    const r = classifyByMetadata({
      filename: "工事_001.jpg",
      takenAt: new Date("2025-11-01T10:00:00Z"),
    });
    expect(r.tags).toContain("phase:autumn");
  });
});

// ── autoSortPhotos ────────────────────────────────────────────────────────────

describe("autoSortPhotos", () => {
  const rawPhotos = [
    { id: "p1", filename: "基礎工事_001.jpg", takenAt: new Date("2025-04-01"), projectId: "proj_001" },
    { id: "p2", filename: "クロス張り_2F.jpg", takenAt: new Date("2025-06-01"), projectId: "proj_001" },
    { id: "p3", filename: "安全確認.jpg", takenAt: new Date("2025-05-01"), projectId: "proj_001" },
    { id: "p4", filename: "IMG_999.jpg", takenAt: new Date("2025-03-01"), projectId: "proj_001" },
  ];

  it("returns same count as input", () => {
    const result = autoSortPhotos(rawPhotos);
    expect(result).toHaveLength(4);
  });

  it("classifies each photo", () => {
    const result = autoSortPhotos(rawPhotos);
    expect(result[0].classification.category).toBe("foundation");
    expect(result[1].classification.category).toBe("interior_finish");
    expect(result[2].classification.category).toBe("safety");
    expect(result[3].classification.category).toBe("other");
  });

  it("preserves original photo fields", () => {
    const result = autoSortPhotos(rawPhotos);
    expect(result[0].id).toBe("p1");
    expect(result[0].filename).toBe("基礎工事_001.jpg");
    expect(result[0].projectId).toBe("proj_001");
  });

  it("extracts floor from filename when not provided", () => {
    const photos = [
      { id: "pf1", filename: "配筋検査_3F.jpg", takenAt: new Date(), projectId: "proj_001" },
    ];
    const result = autoSortPhotos(photos);
    expect(result[0].floor).toBe(3);
  });

  it("accepts custom sort rules", () => {
    const customRules = getDefaultSortRules().slice(0, 2);
    const result = autoSortPhotos(rawPhotos, customRules);
    expect(result).toHaveLength(4);
  });
});

// ── groupPhotosByCategory ─────────────────────────────────────────────────────

describe("groupPhotosByCategory", () => {
  const photos = [
    makePhoto({ filename: "基礎_001.jpg" }),
    makePhoto({ filename: "基礎_002.jpg" }),
    makePhoto({ filename: "クロス_001.jpg" }),
    makePhoto({ filename: "安全_001.jpg" }),
  ];

  it("groups photos by category", () => {
    const groups = groupPhotosByCategory(photos);
    expect(groups["foundation"]).toHaveLength(2);
    expect(groups["interior_finish"]).toHaveLength(1);
    expect(groups["safety"]).toHaveLength(1);
  });

  it("returns empty object for empty input", () => {
    const groups = groupPhotosByCategory([]);
    expect(Object.keys(groups)).toHaveLength(0);
  });

  it("each photo appears in exactly one group", () => {
    const groups = groupPhotosByCategory(photos);
    const allPhotos = Object.values(groups).flat();
    expect(allPhotos).toHaveLength(photos.length);
  });
});

// ── groupPhotosByDate ─────────────────────────────────────────────────────────

describe("groupPhotosByDate", () => {
  const photos = [
    makePhoto({ filename: "a.jpg", takenAt: new Date("2025-04-01T09:00:00Z") }),
    makePhoto({ filename: "b.jpg", takenAt: new Date("2025-04-01T15:00:00Z") }),
    makePhoto({ filename: "c.jpg", takenAt: new Date("2025-04-02T10:00:00Z") }),
  ];

  it("groups photos by YYYY-MM-DD key", () => {
    const groups = groupPhotosByDate(photos);
    expect(Object.keys(groups)).toContain("2025-04-01");
    expect(Object.keys(groups)).toContain("2025-04-02");
  });

  it("same-day photos go in same group", () => {
    const groups = groupPhotosByDate(photos);
    expect(groups["2025-04-01"]).toHaveLength(2);
    expect(groups["2025-04-02"]).toHaveLength(1);
  });
});

// ── groupPhotosByFloor ────────────────────────────────────────────────────────

describe("groupPhotosByFloor", () => {
  const photos = [
    makePhoto({ filename: "配筋_1F.jpg", floor: 1 }),
    makePhoto({ filename: "クロス_2F.jpg", floor: 2 }),
    makePhoto({ filename: "設備_2F.jpg", floor: 2 }),
    makePhoto({ filename: "安全.jpg" }), // no floor
  ];

  it("groups by floor number", () => {
    const groups = groupPhotosByFloor(photos);
    expect(groups[1]).toHaveLength(1);
    expect(groups[2]).toHaveLength(2);
  });

  it("excludes photos with no floor", () => {
    const groups = groupPhotosByFloor(photos);
    const allPhotos = Object.values(groups).flat();
    expect(allPhotos).toHaveLength(3);
  });
});

// ── createAlbumFromGroup ──────────────────────────────────────────────────────

describe("createAlbumFromGroup", () => {
  const photos = [
    makePhoto({ filename: "基礎_001.jpg" }),
    makePhoto({ filename: "基礎_002.jpg" }),
  ];

  it("creates album with correct fields", () => {
    const album = createAlbumFromGroup("proj_001", "基礎工事アルバム", "foundation", photos);
    expect(album.projectId).toBe("proj_001");
    expect(album.name).toBe("基礎工事アルバム");
    expect(album.category).toBe("foundation");
    expect(album.photos).toHaveLength(2);
    expect(album.createdAt).toBeInstanceOf(Date);
  });

  it("album id contains projectId and category", () => {
    const album = createAlbumFromGroup("proj_001", "test", "safety", photos);
    expect(album.id).toContain("proj_001");
    expect(album.id).toContain("safety");
  });
});

// ── generatePhotoIndex ────────────────────────────────────────────────────────

describe("generatePhotoIndex", () => {
  const photos = [
    makePhoto({ filename: "基礎_001.jpg", takenAt: new Date("2025-04-01") }),
    makePhoto({ filename: "基礎_002.jpg", takenAt: new Date("2025-04-15") }),
  ];
  const album: PhotoAlbum = {
    id: "album_001",
    projectId: "proj_001",
    name: "基礎工事写真",
    category: "foundation",
    photos,
    createdAt: new Date("2025-04-01"),
  };

  it("returns valid HTML", () => {
    const html = generatePhotoIndex([album]);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<table>");
    expect(html).toContain("</html>");
  });

  it("includes album name in output", () => {
    const html = generatePhotoIndex([album]);
    expect(html).toContain("基礎工事写真");
  });

  it("includes photo count", () => {
    const html = generatePhotoIndex([album]);
    expect(html).toContain("2");
  });

  it("includes date range", () => {
    const html = generatePhotoIndex([album]);
    expect(html).toContain("2025-04-01");
    expect(html).toContain("2025-04-15");
  });

  it("escapes HTML in album name (XSS prevention)", () => {
    const xssAlbum: PhotoAlbum = {
      ...album,
      name: '<script>alert("xss")</script>',
    };
    const html = generatePhotoIndex([xssAlbum]);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("returns empty table body for empty albums", () => {
    const html = generatePhotoIndex([]);
    expect(html).toContain("<tbody>");
    expect(html).toContain("0");
  });

  it("shows thumbnail placeholder", () => {
    const html = generatePhotoIndex([album]);
    expect(html).toContain("thumbnail placeholder");
  });
});

// ── searchPhotos ──────────────────────────────────────────────────────────────

describe("searchPhotos", () => {
  const photos = [
    makePhoto({ filename: "基礎工事_001.jpg", location: "南青山" }),
    makePhoto({ filename: "クロス張り.jpg", note: "2F廊下のクロス" }),
    makePhoto({ filename: "安全確認.jpg", room: "会議室" }),
    makePhoto({ filename: "IMG_001.jpg" }),
  ];

  it("searches by filename", () => {
    const results = searchPhotos(photos, "基礎");
    expect(results).toHaveLength(1);
    expect(results[0].filename).toBe("基礎工事_001.jpg");
  });

  it("searches by category", () => {
    const results = searchPhotos(photos, "foundation");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((p) => p.classification.category === "foundation")).toBe(true);
  });

  it("searches by location", () => {
    const results = searchPhotos(photos, "南青山");
    expect(results).toHaveLength(1);
    expect(results[0].location).toBe("南青山");
  });

  it("searches by note", () => {
    const results = searchPhotos(photos, "廊下");
    expect(results).toHaveLength(1);
    expect(results[0].note).toContain("廊下");
  });

  it("searches by room", () => {
    const results = searchPhotos(photos, "会議室");
    expect(results).toHaveLength(1);
  });

  it("returns all photos for empty query", () => {
    const results = searchPhotos(photos, "");
    expect(results).toHaveLength(photos.length);
  });

  it("is case-insensitive", () => {
    const results = searchPhotos(photos, "FOUNDATION");
    expect(results.length).toBeGreaterThan(0);
  });
});

// ── getPhotoStats ─────────────────────────────────────────────────────────────

describe("getPhotoStats", () => {
  const photos = [
    makePhoto({ filename: "基礎_001.jpg", takenAt: new Date("2025-04-01"), floor: 1 }),
    makePhoto({ filename: "基礎_002.jpg", takenAt: new Date("2025-04-15"), floor: 1 }),
    makePhoto({ filename: "クロス_001.jpg", takenAt: new Date("2025-06-01"), floor: 2 }),
  ];

  it("returns total count", () => {
    const stats = getPhotoStats(photos);
    expect(stats.total).toBe(3);
  });

  it("counts by category", () => {
    const stats = getPhotoStats(photos);
    expect(stats.byCategory["foundation"]).toBe(2);
    expect(stats.byCategory["interior_finish"]).toBe(1);
  });

  it("returns date range", () => {
    const stats = getPhotoStats(photos);
    expect(stats.dateRange.earliest?.toISOString().slice(0, 10)).toBe("2025-04-01");
    expect(stats.dateRange.latest?.toISOString().slice(0, 10)).toBe("2025-06-01");
  });

  it("counts by floor", () => {
    const stats = getPhotoStats(photos);
    expect(stats.byFloor[1]).toBe(2);
    expect(stats.byFloor[2]).toBe(1);
  });

  it("handles empty array", () => {
    const stats = getPhotoStats([]);
    expect(stats.total).toBe(0);
    expect(stats.dateRange.earliest).toBeNull();
    expect(stats.dateRange.latest).toBeNull();
  });
});

// ── detectDuplicates ──────────────────────────────────────────────────────────

describe("detectDuplicates", () => {
  const baseTime = new Date("2025-04-01T10:00:00Z");

  it("detects duplicates with same filename pattern and timestamp within 5s", () => {
    const photos = [
      makePhoto({ id: "d1", filename: "基礎_001.jpg", takenAt: baseTime }),
      makePhoto({ id: "d2", filename: "基礎_001.jpg", takenAt: new Date(baseTime.getTime() + 2000) }),
      makePhoto({ id: "d3", filename: "クロス_001.jpg", takenAt: new Date("2025-05-01") }),
    ];
    const groups = detectDuplicates(photos);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);
  });

  it("does not flag photos with same name but far apart timestamps", () => {
    const photos = [
      makePhoto({ id: "e1", filename: "基礎_001.jpg", takenAt: new Date("2025-04-01") }),
      makePhoto({ id: "e2", filename: "基礎_001.jpg", takenAt: new Date("2025-05-01") }),
    ];
    const groups = detectDuplicates(photos);
    expect(groups).toHaveLength(0);
  });

  it("returns empty array when no duplicates", () => {
    const photos = [
      makePhoto({ id: "f1", filename: "a.jpg", takenAt: new Date("2025-04-01") }),
      makePhoto({ id: "f2", filename: "b.jpg", takenAt: new Date("2025-04-02") }),
    ];
    const groups = detectDuplicates(photos);
    expect(groups).toHaveLength(0);
  });

  it("handles empty input", () => {
    const groups = detectDuplicates([]);
    expect(groups).toHaveLength(0);
  });
});

// ── suggestMissingPhotos ──────────────────────────────────────────────────────

describe("suggestMissingPhotos", () => {
  it("suggests missing waterproof photos for renovation project", () => {
    const photos = [
      makePhoto({ filename: "クロス_001.jpg" }),
      makePhoto({ filename: "安全_001.jpg" }),
    ];
    const suggestions = suggestMissingPhotos(photos, "renovation");
    expect(suggestions.some((s) => s.includes("防水"))).toBe(true);
  });

  it("suggests missing foundation photos for new_build project", () => {
    const photos = [makePhoto({ filename: "安全_001.jpg" })];
    const suggestions = suggestMissingPhotos(photos, "new_build");
    expect(suggestions.some((s) => s.includes("基礎"))).toBe(true);
  });

  it("returns no suggestions when all required categories are present for interior", () => {
    const photos = [
      makePhoto({ filename: "下地ボード_001.jpg" }),       // interior_rough
      makePhoto({ filename: "クロス張り_001.jpg" }),       // interior_finish
      makePhoto({ filename: "配管工事_001.jpg" }),          // mep_rough
      makePhoto({ filename: "照明器具取付_001.jpg" }),     // mep_finish
      makePhoto({ filename: "防水工事_001.jpg" }),          // waterproof
      makePhoto({ filename: "安全確認_001.jpg" }),          // safety
      makePhoto({ filename: "全景_001.jpg" }),              // progress
    ];
    const suggestions = suggestMissingPhotos(photos, "interior");
    expect(suggestions).toHaveLength(0);
  });

  it("returns string messages in Japanese", () => {
    const photos: ClassifiedPhoto[] = [];
    const suggestions = suggestMissingPhotos(photos, "interior");
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]).toMatch(/ありません/);
  });

  it("handles empty photo list for all project types", () => {
    expect(suggestMissingPhotos([], "interior").length).toBeGreaterThan(0);
    expect(suggestMissingPhotos([], "new_build").length).toBeGreaterThan(0);
    expect(suggestMissingPhotos([], "renovation").length).toBeGreaterThan(0);
  });
});

// ── getDefaultSortRules ───────────────────────────────────────────────────────

describe("getDefaultSortRules", () => {
  it("returns an array of rules", () => {
    const rules = getDefaultSortRules();
    expect(Array.isArray(rules)).toBe(true);
    expect(rules.length).toBeGreaterThan(0);
  });

  it("each rule has pattern, category, and tags", () => {
    const rules = getDefaultSortRules();
    for (const rule of rules) {
      expect(rule.pattern).toBeDefined();
      expect(rule.category).toBeDefined();
      expect(Array.isArray(rule.tags)).toBe(true);
    }
  });

  it("covers all major construction categories", () => {
    const rules = getDefaultSortRules();
    const categories = new Set(rules.map((r) => r.category));
    const expected: PhotoCategory[] = [
      "foundation", "framing", "mep_rough", "mep_finish",
      "interior_rough", "interior_finish", "exterior", "waterproof",
      "safety", "progress", "defect", "material", "equipment",
    ];
    for (const cat of expected) {
      expect(categories.has(cat)).toBe(true);
    }
  });
});
